from django.db import transaction
from django.core.management.base import BaseCommand

from payout_engine.core.models import (
    BankAccount,
    IdempotencyRecord,
    LedgerEntry,
    Merchant,
    Payout,
)

# ─── Seed data definitions ────────────────────────────────────────────────────

MERCHANTS = [
    {"name": "Acme Payments Pvt. Ltd."},
    {"name": "SwiftPay Solutions"},
    {"name": "NovaMerchant Technologies"},
]

BANK_ACCOUNTS = [
    # Acme
    [
        {"account_number": "1234567890123456", "ifsc": "HDFC0001234"},
        {"account_number": "9876543210987654", "ifsc": "ICIC0005678"},
    ],
    # SwiftPay
    [
        {"account_number": "1122334455667788", "ifsc": "SBIN0009876"},
    ],
    # NovaMerchant
    [
        {"account_number": "2233445566778899", "ifsc": "AXIS0001111"},
        {"account_number": "3344556677889900", "ifsc": "KKBK0002222"},
    ],
]

# Credits in paise:  5_000_000 paise = ₹50,000
CREDITS_PER_MERCHANT = [
    [5_000_000, 3_000_000, 2_000_000],  # Acme         → ₹1,00,000 total
    [5_000_000, 5_000_000],             # SwiftPay      → ₹1,00,000 total
    [5_000_000, 4_000_000, 1_000_000],  # NovaMerchant  → ₹1,00,000 total
]


class Command(BaseCommand):
    help = "Wipe existing data and seed the database with initial merchant, bank account, and ledger data."

    @transaction.atomic
    def handle(self, *args, **options) -> None:
        # ── 1. Wipe in reverse FK dependency order ────────────────────────────
        self.stdout.write(self.style.WARNING("⚠  Wiping existing data..."))
        IdempotencyRecord.objects.all().delete()
        Payout.objects.all().delete()
        LedgerEntry.objects.all().delete()
        BankAccount.objects.all().delete()
        Merchant.objects.all().delete()
        self.stdout.write(self.style.SUCCESS("✓  All tables cleared.\n"))

        # ── 2. Seed merchants, accounts, and ledger entries ───────────────────
        for idx, merchant_data in enumerate(MERCHANTS):
            merchant: Merchant = Merchant.objects.create(**merchant_data)
            self.stdout.write(
                self.style.HTTP_INFO(f"Merchant: {merchant.name}")
                + f"  [{merchant.id}]"
            )

            # Bank accounts
            for account_data in BANK_ACCOUNTS[idx]:
                account = BankAccount.objects.create(merchant=merchant, **account_data)
                self.stdout.write(
                    f"  └─ BankAccount  {account.account_number}  {account.ifsc}"
                )

            # Ledger credits
            total_credited = 0
            for amount_paise in CREDITS_PER_MERCHANT[idx]:
                LedgerEntry.objects.create(
                    merchant=merchant,
                    amount_paise=amount_paise,
                    type=LedgerEntry.EntryType.CREDIT,
                    reference_id=None,
                )
                total_credited += amount_paise

            self.stdout.write(
                self.style.SUCCESS(
                    f"  └─ Credited {total_credited:,} paise  "
                    f"(₹{total_credited / 100:,.2f})\n"
                )
            )

        # ── 3. Summary ────────────────────────────────────────────────────────
        self.stdout.write(self.style.SUCCESS("✓  Seed complete."))
        self.stdout.write(
            f"   Merchants:      {Merchant.objects.count()}\n"
            f"   Bank Accounts:  {BankAccount.objects.count()}\n"
            f"   Ledger Entries: {LedgerEntry.objects.count()}"
        )
