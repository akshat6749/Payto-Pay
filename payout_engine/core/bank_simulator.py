import random
import time
import uuid


def simulate_bank_transfer(payout_id: uuid.UUID, amount: int, account: str) -> bool:
    """
    Simulates sending a payout to the banking network.
    
    Outcomes (simulated via random.choices):
      - 70% success       -> returns True
      - 20% decline/fail  -> returns False
      - 10% network hang  -> raises TimeoutError
    """
    time.sleep(2)  # Simulate network latency
    
    # Weights match indices of the population list
    outcome = random.choices(
        population=["success", "fail", "hang"],
        weights=[70, 20, 10],
        k=1
    )[0]
    
    if outcome == "success":
        return True
    elif outcome == "fail":
        return False
    else:
        # Simulate a crash, unreachable API, or hung socket
        raise TimeoutError(f"Bank transfer timeout for payout {payout_id}")
