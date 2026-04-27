import uuid
import concurrent.futures

import pytest
from rest_framework.test import APIClient
from rest_framework import status
from django.db.models import Sum
from django.db import connection

from payout_engine.core.models import Merchant, BankAccount, LedgerEntry, Payout


@pytest.fixture
def setup_merchant_data():
    """
    Setup method that creates a dummy Merchant, a linked BankAccount,
    and directly injects a LedgerEntry CREDIT of ₹1,000 (100,000 paise).
    """
    merchant = Merchant.objects.create(name="Test Merchant")
    
    bank_account = BankAccount.objects.create(
        merchant=merchant,
        account_number="123456789",
        ifsc="TEST0000123"
    )
    
    LedgerEntry.objects.create(
        merchant=merchant,
        amount_paise=100000,
        type=LedgerEntry.EntryType.CREDIT
    )
    
    return merchant, bank_account


@pytest.mark.django_db(transaction=True)
def test_payout_idempotency(setup_merchant_data):
    """
    Test 1: The Idempotency Test
    Ensures that identical requests (same idempotency key) 
    do not result in duplicate payouts.
    """
    merchant, bank_account = setup_merchant_data
    api_client = APIClient()
    
    # Generate a random UUID to use as the Idempotency-Key
    idemp_key = str(uuid.uuid4())
    
    payload = {
        "bank_account_id": str(bank_account.id),
        "amount_paise": 50000  # ₹500
    }
    
    headers = {
        "HTTP_X_MERCHANT_ID": str(merchant.id),
        "HTTP_IDEMPOTENCY_KEY": idemp_key,
    }
    
    # Request 1
    response1 = api_client.post("/api/v1/payouts/", payload, format="json", **headers)
    assert response1.status_code == status.HTTP_201_CREATED
    
    # Request 2 (Exact same payload and headers)
    response2 = api_client.post("/api/v1/payouts/", payload, format="json", **headers)
    assert response2.status_code == status.HTTP_201_CREATED
    
    # Response body of the second matches the first exactly
    assert response1.json() == response2.json()
    
    # Prove only 1 payout was actually created in the DB
    assert Payout.objects.count() == 1


@pytest.mark.django_db(transaction=True)
def test_payout_concurrency_double_spend(setup_merchant_data):
    """
    Test 2: The Concurrency Test (Double Spend Prevention)
    Fires 5 simultaneous requests for ₹1,000 using different idempotency keys.
    Validates that the database select_for_update() locks correctly, ensuring
    only 1 request succeeds and the available balance never drops below zero.
    """
    merchant, bank_account = setup_merchant_data
    
    # Define a helper function to execute a single request in a thread
    def make_request():
        # New APIClient per thread. Threads must manage their own DB connections 
        # seamlessly, so we close it after execution to prevent pool starvation.
        thread_client = APIClient()
        
        # Unique idempotency key so we bypass the idempotency record check
        # allowing us to test the actual ledger lock race condition!
        idemp_key = str(uuid.uuid4())
        payload = {
            "bank_account_id": str(bank_account.id),
            "amount_paise": 100000  # ₹1,000 (the full balance)
        }
        headers = {
            "HTTP_X_MERCHANT_ID": str(merchant.id),
            "HTTP_IDEMPOTENCY_KEY": idemp_key,
        }
        
        res = thread_client.post("/api/v1/payouts/", payload, format="json", **headers)
        
        # Close connection for this thread explicitly when finished.
        connection.close()
        return res.status_code
        
    NUM_REQUESTS = 5
    
    # We use ThreadPoolExecutor to simulate a real-world network race condition
    # where multiple requests hit the server at the exact same millisecond.
    with concurrent.futures.ThreadPoolExecutor(max_workers=NUM_REQUESTS) as executor:
        # Submit all requests concurrently
        futures = [executor.submit(make_request) for _ in range(NUM_REQUESTS)]
        results = [future.result() for future in concurrent.futures.as_completed(futures)]
        
    # Analyze results
    successes = [res for res in results if res == status.HTTP_201_CREATED]
    failures = [res for res in results if res == status.HTTP_400_BAD_REQUEST]
    
    # Assertions
    assert len(successes) == 1, f"Expected exactly 1 success, got {len(successes)}"
    assert len(failures) == NUM_REQUESTS - 1, f"Expected {NUM_REQUESTS - 1} failures, got {len(failures)}"
    
    # Verify the merchant's ledger balance never drops below 0.
    final_balance = LedgerEntry.objects.filter(merchant=merchant).aggregate(Sum('amount_paise'))['amount_paise__sum'] or 0
    assert final_balance >= 0, "Double spend occurred! Ledger balance dropped below 0."
    assert final_balance == 0, "Balance should be exactly 0 after successfully withdrawing the full balance."
