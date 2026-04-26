from django.urls import path

from .views import MerchantBalanceView, PayoutView

urlpatterns = [
    path("merchants/balance/", MerchantBalanceView.as_view(), name="merchant-balance"),
    path("payouts/", PayoutView.as_view(), name="payouts"),
]
