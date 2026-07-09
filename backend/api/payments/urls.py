from django.urls import path
from .views import InitiatePaymentView, VerifyPaymentView, payment_checkout
from .webhook import feexpay_webhook

urlpatterns = [
    path('initiate/', InitiatePaymentView.as_view(), name='initiate_payment'),
    path('verify/', VerifyPaymentView.as_view(), name='verify_payment'),
    path('webhook/', feexpay_webhook, name='feexpay_webhook'),
    path('checkout/', payment_checkout, name='payment_checkout'),
]
