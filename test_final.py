import os, sys, time, uuid
os.environ['DJANGO_SETTINGS_MODULE']='payout_engine.settings'
import django; django.setup()
from payout_engine.core.models import Payout

payout = Payout.objects.order_by('-created_at').first()
print('FINAL PAYOUT STATUS:', payout.status)
