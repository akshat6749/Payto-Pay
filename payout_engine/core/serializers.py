"""
DRF serializers for the payout engine.

PayoutSerializer        – read-only, used for outgoing responses.
PayoutRequestSerializer – write-only, used for incoming POST body validation.
"""

from rest_framework import serializers

from .models import Merchant, BankAccount, Payout


class PayoutSerializer(serializers.ModelSerializer):
    """Read-only serializer for Payout responses."""

    class Meta:
        model = Payout
        fields = [
            "id",
            "merchant_id",
            "bank_account_id",
            "amount_paise",
            "status",
            "idempotency_key",
            "attempt_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class PayoutRequestSerializer(serializers.Serializer):
    """
    Write-only serializer for incoming payout creation requests.

    Expected JSON body:
        {
            "bank_account_id": "<uuid>",
            "amount_paise": 500000
        }
    """

    bank_account_id = serializers.UUIDField()
    amount_paise = serializers.IntegerField(min_value=1)

class MerchantSerializer(serializers.ModelSerializer):
    """Read-only serializer for Merchant list."""
    class Meta:
        model = Merchant
        fields = ["id", "name", "created_at"]
        read_only_fields = fields

class BankAccountSerializer(serializers.ModelSerializer):
    """Read-only serializer for Bank Account list."""
    class Meta:
        model = BankAccount
        fields = ["id", "merchant_id", "account_number", "ifsc", "created_at"]
        read_only_fields = fields
