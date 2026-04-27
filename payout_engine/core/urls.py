from django.urls import path

from .views import MerchantBalanceView, PayoutView, MerchantListView, BankAccountListView

urlpatterns = [
    path("merchants/", MerchantListView.as_view(), name="merchants"),
    path("merchants/balance/", MerchantBalanceView.as_view(), name="merchant-balance"),
    path("bank-accounts/", BankAccountListView.as_view(), name="bank-accounts"),
    path("payouts/", PayoutView.as_view(), name="payouts"),
]
