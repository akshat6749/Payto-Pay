from django.contrib import admin

from .models import BankAccount, IdempotencyRecord, LedgerEntry, Merchant, Payout


@admin.register(Merchant)
class MerchantAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "created_at")
    search_fields = ("name",)
    readonly_fields = ("id", "created_at")


@admin.register(BankAccount)
class BankAccountAdmin(admin.ModelAdmin):
    list_display = ("id", "merchant", "account_number", "ifsc", "created_at")
    list_filter = ("merchant",)
    search_fields = ("account_number", "ifsc", "merchant__name")
    readonly_fields = ("id", "created_at")


@admin.register(LedgerEntry)
class LedgerEntryAdmin(admin.ModelAdmin):
    list_display = ("id", "merchant", "type", "amount_paise", "reference_id", "created_at")
    list_filter = ("type", "merchant")
    search_fields = ("reference_id",)
    readonly_fields = ("id", "created_at")


@admin.register(Payout)
class PayoutAdmin(admin.ModelAdmin):
    list_display = (
        "id", "merchant", "bank_account", "amount_paise",
        "status", "attempt_count", "created_at",
    )
    list_filter = ("status", "merchant")
    search_fields = ("idempotency_key", "merchant__name")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(IdempotencyRecord)
class IdempotencyRecordAdmin(admin.ModelAdmin):
    list_display = ("key", "merchant", "response_status", "locked_at", "created_at")
    list_filter = ("merchant",)
    search_fields = ("key",)
    readonly_fields = ("created_at",)
