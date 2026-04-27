# Playto Pay System Architecture Explainer

## 1. The Ledger

```python
    result = (
        LedgerEntry.objects
        .filter(merchant_id=merchant_id)
        # The aggregation happens in PostgreSQL, not Python.
        # SQL: SELECT COALESCE(SUM(amount_paise), 0) FROM ledger_entries ...
        .aggregate(balance=Sum("amount_paise"))
    )
```

**Why an Immutable Ledger?**  
Storing a single mutable integer (`Merchant.balance`) introduces destructive check-then-deduct race conditions and offers zero financial traceability. By modeling credits and debits as an immutable, append-only ledger of events, we gain a perfect cryptographic-like audit trail. Reconstructing the balance dynamically via `Sum` aggregation delegates the math to Postgres and guarantees absolute truth that never drifts from historical action execution.

## 2. The Lock

```python
    with transaction.atomic():
        # ...
        # ── 2. ROW-LEVEL LOCK ON MERCHANT ────────────────────────────────
        # `select_for_update()` acquires a PostgreSQL row-level exclusive lock
        merchant = Merchant.objects.select_for_update().get(id=merchant_id)
```

**Double Spend Prevention:**  
This guarantees our critical concurrency control. `select_for_update()` requests a strict PostgreSQL Row-Level Lock (`FOR UPDATE`). When two independent payout threads concurrently access the same merchant, the first thread locks the database row. The second thread is proactively blocked at the SQL level until the first transaction safely completes checking the balance, inserting the negative hold `LedgerEntry`, and fully committing/releasing the lock.

## 3. The Idempotency

**Idempotency Processing:**  
Every incoming payout carries an `Idempotency-Key` header, saved dynamically alongside the Merchant ID via `IdempotencyRecord.objects.create(...)`. When a second identical request comes in later, the database-level unique constraint on `(key, merchant_id)` throws an `IntegrityError`, instantly alerting our service it has seen this key before and returning the cached response inside.

**In-Flight Handling:**  
If the first request is still "in flight" and hasn't finished rendering an HTTP response when the duplicate arrives, its DB record has a `locked_at` timestamp but a blank `response_body`. Upon catching the `IntegrityError`, our service explicitly acquires a `select_for_update()` lock on the idempotency record. By inspecting `locked_at` (and seeing it is < 24 hours old), the service recognizes the original transaction is actively locking tables. It cleanly aborts the second thread with a `409 Conflict` instead of waiting or retrying, eliminating duplicate overhead.

## 4. The State Machine

```python
    # 1. State Machine Guard - Prevent going backwards
    if payout.status not in (Payout.Status.PENDING, Payout.Status.PROCESSING):
        return
```

**Protective Boundaries:**  
This guard blocks illegal state transitions executed by out-of-order cron tasks, network latency retries, or ghost workers. It essentially guarantees that a `FAILED` or `COMPLETED` payout can never be spuriously re-awakened to mutate state logic backward.

## 5. The AI Audit

**AI-Generated Configuration Pitfall:**  
During our async pipeline implementation, an AI agent originally authored the retry background task using the relative import reference `async_task("core.tasks.sweep_stuck_payouts_task")`. Because the top-level Django module context is `payout_engine`, the Django-Q task runner failed dynamically at runtime with a `ValueError: Function is not defined`. This failure occurred completely silently in the background processes, permanently stranding payouts in the `PROCESSING` state as the sweeper itself instantly crashed upon invocation. We pinpointed and resolved this by standardizing strict absolute module paths (`payout_engine.core.tasks.sweep_stuck_payouts_task`) and utilizing the Django console to explicitly wipe the broken, infinitely-crashing task backlog out of the `OrmQ` database tables.
