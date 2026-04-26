"""
Custom exceptions for the core payout engine.

These are raised in the service layer and caught in the view layer
to produce the correct HTTP responses.
"""


class InsufficientFunds(Exception):
    """
    Raised when a merchant's dynamically-calculated balance
    (SUM of LedgerEntry.amount_paise) is less than the requested payout.
    """

    def __init__(self, available: int, requested: int) -> None:
        self.available = available
        self.requested = requested
        super().__init__(
            f"Insufficient funds: available {available}p, requested {requested}p"
        )


class IdempotencyConflict(Exception):
    """
    Raised when a request with the same idempotency key is already
    in-flight (locked_at is set but response_body is still None).
    The caller should respond with HTTP 409 Conflict.
    """
    pass
