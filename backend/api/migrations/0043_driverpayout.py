from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0042_ride_stopovers"),
    ]

    operations = [
        migrations.CreateModel(
            name="DriverPayout",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("amount", models.IntegerField(help_text="Montant net du au conducteur en XOF")),
                ("phone_number", models.CharField(help_text="Numero Mobile Money du conducteur", max_length=30)),
                ("status", models.CharField(
                    choices=[
                        ("pending", "En attente"),
                        ("processing", "En cours de traitement"),
                        ("paid", "Verse"),
                        ("failed", "Echoue"),
                    ],
                    default="pending",
                    max_length=20,
                )),
                ("admin_note", models.TextField(blank=True, null=True)),
                ("requested_at", models.DateTimeField(auto_now_add=True)),
                ("paid_at", models.DateTimeField(blank=True, null=True)),
                ("driver", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="driver_payouts",
                    to="api.user",
                )),
                ("ride", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="driver_payouts",
                    to="api.ride",
                )),
            ],
            options={
                "verbose_name": "Demande de virement conducteur",
                "verbose_name_plural": "Demandes de virement conducteurs",
                "ordering": ["-requested_at"],
                "unique_together": {("driver", "ride")},
            },
        ),
    ]
