"""
Service layer for the payout engine.

All business logic lives here — views simply validate input, call a service
function, and map the result/exception to an HTTP response.

ARCHITECTURE INVARIANTS (do not violate):
  1. Monetary amounts are ALWAYS in paise (BigIntegerField). No floats.
  2. Merchant balance is NEVER stored. It is derived:
         SUM(LedgerEntry.amount_paise) WHERE merchant_id = X
  3. Before touching the balance we MUST acquire a row-level lock on the
     Merchant row via `select_for_update()` inside `transaction.atomic()`.
  4. To deduct funds we INSERT a LedgerEntry with a negative amount_paise
     (type=PAYOUT_HOLD). We never update or delete existing entries.
"""

from __future__ import annotations

import uuid
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.utils import timezone
from django_q.tasks import async_task

from .exceptions import IdempotencyConflict, InsufficientFunds
from .models import (
    BankAccount,
    IdempotencyRecord,
    LedgerEntry,
    Merchant,
    Payout,
)


# ── Idempotency key TTL ──────────────────────────────────────────────────────
IDEMPOTENCY_KEY_TTL = timedelta(hours=24)


# ─────────────────────────────────────────────────────────────────────────────
# Balance Service
# ─────────────────────────────────────────────────────────────────────────────

def get_merchant_balance(merchant_id: uuid.UUID) -> int:
    """
    Derive the merchant's current available balance by aggregating all
    ledger entries in the database.

    This is the ONLY correct way to obtain a balance.  We never cache it
    or store it on the Merchant model.

    Returns:
        int – balance in paise (can be negative if over-debited, though
              business rules should prevent that).
    """
    result = (
        LedgerEntry.objects
        .filter(merchant_id=merchant_id)
        # The aggregation happens in PostgreSQL, not Python.
        # SQL: SELECT COALESCE(SUM(amount_paise), 0) FROM ledger_entries ...
        .aggregate(balance=Sum("amount_paise"))
    )
    # aggregate() returns {"balance": None} when no rows exist → coalesce to 0
    return result["balance"] or 0


# ─────────────────────────────────────────────────────────────────────────────
# Payout Service
# ─────────────────────────────────────────────────────────────────────────────

def process_payout_request(
    merchant_id: uuid.UUID,
    bank_account_id: uuid.UUID,
    amount_paise: int,
    idempotency_key: uuid.UUID,
) -> dict:
    """
    Execute a payout request in a single atomic database transaction.

    The flow:
        1. Idempotency gate  – deduplicate or detect in-flight collisions.
        2. Row-level lock    – SELECT … FOR UPDATE on the Merchant row.
        3. Balance check     – aggregate LedgerEntry (DB-side Sum).
        4. Hold funds        – INSERT a PAYOUT_HOLD LedgerEntry (negative).
        5. Create Payout     – INSERT the Payout record (status=PENDING).
        6. Seal idempotency  – save the response so replays are instant.

    Returns:
        dict – serializable payout representation.

    Raises:
        Merchant.DoesNotExist   – unknown merchant_id.
        BankAccount.DoesNotExist – unknown or mismatched bank_account_id.
        InsufficientFunds       – balance < requested amount.
        IdempotencyConflict     – duplicate key currently in-flight (409).
    """
    with transaction.atomic():
        # ── 1. IDEMPOTENCY GATE ──────────────────────────────────────────
        # Try to atomically create a new record for this (key, merchant)
        # pair.  If the row already exists we inspect its state:
        #   • response_body is populated → return the cached response.
        #   • response_body is None AND locked_at is recent → 409.
        #   • response_body is None AND locked_at is stale (>24 h) →
        #     treat as a new request (reclaim the lock).
        now = timezone.now()

        try:
            # Wrap in its own atomic block so the Postgres transaction
            # isn't irrevocably broken by the IntegrityError.
            with transaction.atomic():
                idem_record = IdempotencyRecord.objects.create(
                    key=idempotency_key,
                    merchant_id=merchant_id,
                    locked_at=now,
                )
        except IntegrityError:
            # Row already exists — fetch it to decide what to do.
            idem_record = (
                IdempotencyRecord.objects
                .select_for_update()
                .get(key=idempotency_key, merchant_id=merchant_id)
            )

            # Case A: completed before → replay the stored response.
            if idem_record.response_body is not None:
                return idem_record.response_body

            # Case B: locked recently → another request is processing.
            if (
                idem_record.locked_at is not None
                and now - idem_record.locked_at < IDEMPOTENCY_KEY_TTL
            ):
                raise IdempotencyConflict(
                    "A request with this idempotency key is already being processed."
                )

            # Case C: stale lock (>24 h) → reclaim it.
            idem_record.locked_at = now
            idem_record.save(update_fields=["locked_at"])

        # ── 2. ROW-LEVEL LOCK ON MERCHANT ────────────────────────────────
        # This is the critical concurrency control point.
        # `select_for_update()` acquires a PostgreSQL row-level exclusive
        # lock (FOR UPDATE) which blocks any other transaction that tries
        # to lock the same Merchant row.  This serialises all payout
        # attempts for the same merchant, preventing double-spend.
        merchant = Merchant.objects.select_for_update().get(id=merchant_id)

        # ── 3. BALANCE CHECK (DB-level aggregation) ──────────────────────
        # The balance query runs INSIDE the same transaction that holds the
        # row-level lock, so no other concurrent transaction can insert a
        # PAYOUT_HOLD between our read and our write.
        balance = get_merchant_balance(merchant_id)

        if balance < amount_paise:
            raise InsufficientFunds(available=balance, requested=amount_paise)

        # ── 4. VALIDATE BANK ACCOUNT ─────────────────────────────────────
        # Ensure the bank account exists AND belongs to this merchant.
        bank_account = BankAccount.objects.get(
            id=bank_account_id, merchant_id=merchant_id
        )

        # ── 5. HOLD FUNDS ────────────────────────────────────────────────
        # We do NOT subtract from any variable or update any balance column.
        # Instead we INSERT a new LedgerEntry with negative amount_paise.
        # The invariant: the merchant's balance is always
        #     SUM(amount_paise) across ALL their LedgerEntry rows.
        payout_id = uuid.uuid4()

        LedgerEntry.objects.create(
            merchant=merchant,
            amount_paise=-amount_paise,  # ← negative = hold/debit
            type=LedgerEntry.EntryType.PAYOUT_HOLD,
            reference_id=payout_id,       # links this ledger row to the Payout
        )

        # ── 6. CREATE PAYOUT (status=PENDING) ───────────────────────────
        # The payout stays PENDING until an async worker transitions it to
        # PROCESSING → COMPLETED (or FAILED, in which case we insert a
        # PAYOUT_REFUND LedgerEntry to reverse the hold).
        payout = Payout.objects.create(
            id=payout_id,
            merchant=merchant,
            bank_account=bank_account,
            amount_paise=amount_paise,
            status=Payout.Status.PENDING,
            idempotency_key=idempotency_key,
        )

        # ── 7. SEAL IDEMPOTENCY RECORD ───────────────────────────────────
        # Store the complete response so any identical future request
        # returns this exact payload without re-executing the pipeline.
        response_body = _serialise_payout(payout)

        idem_record.response_status = 201
        idem_record.response_body = response_body
        idem_record.locked_at = None  # release the processing lock
        idem_record.save(update_fields=["response_status", "response_body", "locked_at"])

    # ── 8. KICK OFF BACKGROUND TASK ──────────────────────────────────────────
    # Trigger the worker asynchronously now that the transaction is committed
    async_task('payout_engine.core.tasks.process_payout_task', payout_id)

    return response_body


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _serialise_payout(payout: Payout) -> dict:
    """
    Produce a JSON-safe dict for a Payout instance.
    Kept separate so the service layer doesn't depend on DRF serializers.
    """
    return {
        "id": str(payout.id),
        "merchant_id": str(payout.merchant_id),
        "bank_account_id": str(payout.bank_account_id),
        "amount_paise": payout.amount_paise,
        "status": payout.status,
        "idempotency_key": str(payout.idempotency_key),
        "attempt_count": payout.attempt_count,
        "created_at": payout.created_at.isoformat(),
        "updated_at": payout.updated_at.isoformat(),
    }
