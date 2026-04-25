import uuid

from django.db import models


class Merchant(models.Model):
    """
    Represents a merchant in the payout system.

    IMPORTANT: There is NO balance field on this model by design.
    A merchant's available balance is always computed dynamically by summing
    all LedgerEntry rows for that merchant:
        LedgerEntry.objects.filter(merchant=merchant).aggregate(Sum('amount_paise'))
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "merchants"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class BankAccount(models.Model):
    """Bank account registered by a merchant for payouts."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    merchant = models.ForeignKey(
        Merchant, on_delete=models.PROTECT, related_name="bank_accounts"
    )
    account_number = models.CharField(max_length=20)
    ifsc = models.CharField(max_length=11)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "bank_accounts"

    def __str__(self) -> str:
        return f"{self.account_number} / {self.ifsc}"


class LedgerEntry(models.Model):
    """
    Double-entry ledger row for a merchant.

    Rules:
      - CREDIT        → positive amount_paise   (money in)
      - PAYOUT_HOLD   → negative amount_paise   (funds reserved for payout)
      - PAYOUT_REFUND → positive amount_paise   (hold released on failure)

    The merchant's real-time balance is:
        SUM(amount_paise) WHERE merchant = <id>
    """

    class EntryType(models.TextChoices):
        CREDIT = "CREDIT", "Credit"
        PAYOUT_HOLD = "PAYOUT_HOLD", "Payout Hold"
        PAYOUT_REFUND = "PAYOUT_REFUND", "Payout Refund"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    merchant = models.ForeignKey(
        Merchant, on_delete=models.PROTECT, related_name="ledger_entries"
    )
    # ⚠️  MUST be paise (BigInt). Never use float or Decimal here.
    amount_paise = models.BigIntegerField(
        help_text="Positive = credit/inflow. Negative = debit/hold. Unit: paise (1 INR = 100 paise)."
    )
    type = models.CharField(max_length=20, choices=EntryType.choices, db_index=True)
    reference_id = models.UUIDField(
        null=True,
        blank=True,
        db_index=True,
        help_text="Optional link to a Payout or external transaction.",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "ledger_entries"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"[{self.type}] {self.amount_paise}p → Merchant({self.merchant_id})"


class Payout(models.Model):
    """
    Represents a payout request from a merchant to one of their bank accounts.

    Status lifecycle:
        PENDING → PROCESSING → COMPLETED
                             ↘ FAILED
    """

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PROCESSING = "PROCESSING", "Processing"
        COMPLETED = "COMPLETED", "Completed"
        FAILED = "FAILED", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    merchant = models.ForeignKey(
        Merchant, on_delete=models.PROTECT, related_name="payouts"
    )
    bank_account = models.ForeignKey(
        BankAccount, on_delete=models.PROTECT, related_name="payouts"
    )
    # ⚠️  MUST be paise (BigInt). Never use float or Decimal here.
    amount_paise = models.BigIntegerField(
        help_text="Amount to disburse in paise. Unit: paise."
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    idempotency_key = models.UUIDField(
        unique=True,
        db_index=True,
        help_text="Client-supplied UUID to prevent duplicate submissions.",
    )
    attempt_count = models.IntegerField(
        default=0,
        help_text="Number of times this payout has been attempted against the bank API.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "payouts"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Payout({self.id}) [{self.status}] {self.amount_paise}p"


class IdempotencyRecord(models.Model):
    """
    Records the outcome of an idempotent API request.

    When a client replays a request with the same (key, merchant) pair,
    we return the stored response_status + response_body verbatim without
    re-executing any business logic.

    locked_at is set when a request is in-flight to prevent concurrent
    duplicate processing (optimistic lock sentinel).
    """

    key = models.UUIDField(db_index=True)
    merchant = models.ForeignKey(
        Merchant, on_delete=models.PROTECT, related_name="idempotency_records"
    )
    response_status = models.IntegerField(
        null=True,
        blank=True,
        help_text="HTTP status code of the completed response.",
    )
    response_body = models.JSONField(
        null=True,
        blank=True,
        help_text="Serialised JSON response body for replay.",
    )
    locked_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Set when a request is being processed; cleared on completion.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "idempotency_records"
        constraints = [
            models.UniqueConstraint(
                fields=["key", "merchant"],
                name="unique_idempotency_key_per_merchant",
            )
        ]

    def __str__(self) -> str:
        return f"IdempotencyRecord({self.key}) for Merchant({self.merchant_id})"
