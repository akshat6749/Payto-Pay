import os, sys, time, uuid
os.environ['DJANGO_SETTINGS_MODULE']='payout_engine.settings'
import django; django.setup()
from payout_engine.core.models import Merchant, Payout
from payout_engine.core.services import process_payout_request

m = Merchant.objects.first()
b = m.bank_accounts.first()
ikey = uuid.uuid4()
print('Initial Balance:', sum(l.amount_paise for l in m.ledger_entries.all()))
process_payout_request(m.id, b.id, 50000, ikey)
payout = Payout.objects.order_by('-created_at').first()
print('After Request Payout Status:', payout.status)
time.sleep(3)
payout.refresh_from_db()
print('After 3s Payout Status:', payout.status)
