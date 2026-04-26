import uuid
from django.db import transaction
from django.utils import timezone
from django_q.tasks import async_task

from .models import Payout, LedgerEntry
from .bank_simulator import simulate_bank_transfer


def process_payout_task(payout_id: uuid.UUID) -> None:
    """
    Background worker that executes the payout against the bank.
    
    CRITICAL INVARIANTS:
    - Guard against illegal state transitions (must be PENDING or PROCESSING).
    - If failed, MUST execute an atomic refund creating a PAYOUT_REFUND LedgerEntry.
    """
    try:
        payout = Payout.objects.get(id=payout_id)
    except Payout.DoesNotExist:
        return

    # 1. State Machine Guard - Prevent going backwards
    if payout.status not in (Payout.Status.PENDING, Payout.Status.PROCESSING):
        return

    # 2. Transition to PROCESSING
    payout.status = Payout.Status.PROCESSING
    payout.save(update_fields=["status", "updated_at"])

    # 3. Simulate Bank Call
    try:
        success = simulate_bank_transfer(payout.id, payout.amount_paise, payout.bank_account.account_number)
    except TimeoutError:
        # Do nothing - leave it in PROCESSING. 
        # The sweep_stuck_payouts_task will catch and retry it later.
        return

    # 4. State Updates & Atomic Refund
    if success:
        payout.status = Payout.Status.COMPLETED
        payout.save(update_fields=["status", "updated_at"])
    else:
        # ATOMIC REFUND
        # If the payout fails, we must reverse the original hold. We wrap
        # the status change and the ledger refund in a single atomic transaction.
        with transaction.atomic():
            payout.status = Payout.Status.FAILED
            payout.save(update_fields=["status", "updated_at"])
            
            # Reversing the hold means inserting a POSITIVE amount
            LedgerEntry.objects.create(
                merchant=payout.merchant,
                amount_paise=payout.amount_paise,
                type=LedgerEntry.EntryType.PAYOUT_REFUND,
                reference_id=payout.id,
            )


def sweep_stuck_payouts_task() -> None:
    """
    Sweeper job intended to run on a cron schedule.
    Finds payouts that have been stuck in the PROCESSING state for > 30s.
    Retries up to 3 times, then executes an atomic refund to fail it permanently.
    """
    stale_cutoff = timezone.now() - timezone.timedelta(seconds=30)
    
    stuck_payouts = Payout.objects.filter(
        status=Payout.Status.PROCESSING, 
        updated_at__lt=stale_cutoff
    )

    for payout in stuck_payouts:
        payout.attempt_count += 1
        payout.save(update_fields=["attempt_count", "updated_at"])

        if payout.attempt_count < 3:
            # Re-enqueue process task
            async_task("payout_engine.core.tasks.process_payout_task", payout.id)
        else:
            # Exhausted retries -> mark failed and refund
            with transaction.atomic():
                payout.status = Payout.Status.FAILED
                payout.save(update_fields=["status", "updated_at"])
                
                LedgerEntry.objects.create(
                    merchant=payout.merchant,
                    amount_paise=payout.amount_paise,
                    type=LedgerEntry.EntryType.PAYOUT_REFUND,
                    reference_id=payout.id,
                )
