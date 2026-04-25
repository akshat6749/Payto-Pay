from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    # Dotted path reflects location inside the payout_engine package.
    name = "payout_engine.core"
    label = "core"
