"""
API views for the payout engine.

Authentication is simulated via the X-Merchant-Id header.
All endpoints are unauthenticated at the DRF level (AllowAny),
but require a valid X-Merchant-Id UUID to function.
"""

from __future__ import annotations

import uuid

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .exceptions import IdempotencyConflict, InsufficientFunds
from .models import BankAccount, Merchant, Payout
from .serializers import PayoutRequestSerializer, PayoutSerializer, MerchantSerializer, BankAccountSerializer
from .services import get_merchant_balance, process_payout_request


# ─────────────────────────────────────────────────────────────────────────────
# Header Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _extract_merchant_id(request: Request) -> uuid.UUID:
    """
    Read and validate the X-Merchant-Id header.
    Raises ValueError if missing or not a valid UUID.
    """
    raw = request.headers.get("X-Merchant-Id")
    if not raw:
        raise ValueError("Missing X-Merchant-Id header.")
    return uuid.UUID(raw)


def _extract_idempotency_key(request: Request) -> uuid.UUID:
    """
    Read and validate the Idempotency-Key header.
    Raises ValueError if missing or not a valid UUID.
    """
    raw = request.headers.get("Idempotency-Key")
    if not raw:
        raise ValueError("Missing Idempotency-Key header.")
    return uuid.UUID(raw)


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/v1/merchants/balance/
# ─────────────────────────────────────────────────────────────────────────────

class MerchantBalanceView(APIView):
    """
    Returns the merchant's dynamically-computed available balance.

    The balance is NEVER read from a stored field — it is always
    calculated as SUM(LedgerEntry.amount_paise) for the merchant.
    """

    permission_classes = [AllowAny]

    def get(self, request: Request) -> Response:
        try:
            merchant_id = _extract_merchant_id(request)
        except ValueError as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verify the merchant exists
        if not Merchant.objects.filter(id=merchant_id).exists():
            return Response(
                {"error": "Merchant not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        balance = get_merchant_balance(merchant_id)

        return Response({"available_balance_paise": balance})


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/v1/payouts/   (create)
# GET  /api/v1/payouts/   (list history)
# ─────────────────────────────────────────────────────────────────────────────

class PayoutView(APIView):
    """
    POST – Create a new payout (with idempotency + concurrency protection).
    GET  – List payout history for the merchant.
    """

    permission_classes = [AllowAny]

    # ── POST: Create Payout ──────────────────────────────────────────────

    def post(self, request: Request) -> Response:
        # 1. Extract headers
        try:
            merchant_id = _extract_merchant_id(request)
            idempotency_key = _extract_idempotency_key(request)
        except ValueError as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 2. Validate request body
        serializer = PayoutRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # 3. Delegate to service layer
        try:
            result = process_payout_request(
                merchant_id=merchant_id,
                bank_account_id=serializer.validated_data["bank_account_id"],
                amount_paise=serializer.validated_data["amount_paise"],
                idempotency_key=idempotency_key,
            )
        except Merchant.DoesNotExist:
            return Response(
                {"error": "Merchant not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        except BankAccount.DoesNotExist:
            return Response(
                {"error": "Bank account not found or does not belong to this merchant."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except InsufficientFunds as exc:
            return Response(
                {
                    "error": "Insufficient funds.",
                    "available_balance_paise": exc.available,
                    "requested_paise": exc.requested,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except IdempotencyConflict:
            return Response(
                {"error": "A request with this idempotency key is already being processed."},
                status=status.HTTP_409_CONFLICT,
            )

        return Response(result, status=status.HTTP_201_CREATED)

    # ── GET: List Payouts ────────────────────────────────────────────────

    def get(self, request: Request) -> Response:
        try:
            merchant_id = _extract_merchant_id(request)
        except ValueError as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verify the merchant exists
        if not Merchant.objects.filter(id=merchant_id).exists():
            return Response(
                {"error": "Merchant not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        payouts = Payout.objects.filter(merchant_id=merchant_id).order_by("-created_at")
        serializer = PayoutSerializer(payouts, many=True)

        return Response(serializer.data)

# ─────────────────────────────────────────────────────────────────────────────
# GET /api/v1/merchants/
# GET /api/v1/bank-accounts/
# ─────────────────────────────────────────────────────────────────────────────

class MerchantListView(APIView):
    """List all merchants for the dashboard dynamic switcher."""

    permission_classes = [AllowAny]

    def get(self, request: Request) -> Response:
        merchants = Merchant.objects.all().order_by("name")
        serializer = MerchantSerializer(merchants, many=True)
        return Response(serializer.data)


class BankAccountListView(APIView):
    """List bank accounts belonging to the authenticated merchant."""

    permission_classes = [AllowAny]

    def get(self, request: Request) -> Response:
        try:
            merchant_id = _extract_merchant_id(request)
        except ValueError as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verify the merchant exists
        if not Merchant.objects.filter(id=merchant_id).exists():
            return Response(
                {"error": "Merchant not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        bank_accounts = BankAccount.objects.filter(merchant_id=merchant_id).order_by("-created_at")
        serializer = BankAccountSerializer(bank_accounts, many=True)
        return Response(serializer.data)

