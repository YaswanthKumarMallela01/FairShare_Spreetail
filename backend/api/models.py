"""
FairShare data models.
"""

from django.conf import settings
from django.db import models


class Group(models.Model):
    """A shared-expense group (e.g. a flat, a trip)."""

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    invite_code = models.CharField(max_length=12, unique=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_groups",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.invite_code:
            import random
            import string
            while True:
                code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
                if not Group.objects.filter(invite_code=code).exists():
                    self.invite_code = code
                    break
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name


class GroupMembership(models.Model):
    """Tracks which users belong to a group and when."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="group_memberships",
    )
    group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    joined_at = models.DateField()
    left_at = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("user", "group", "joined_at")
        ordering = ["joined_at"]

    def __str__(self) -> str:
        return f"{self.user.username} in {self.group.name}"


class Expense(models.Model):
    """A single expense within a group."""

    SPLIT_TYPE_CHOICES = [
        ("equal", "Equal"),
        ("unequal", "Unequal"),
        ("percentage", "Percentage"),
        ("share", "Share"),
    ]

    group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE,
        related_name="expenses",
    )
    description = models.CharField(max_length=500)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    original_currency = models.CharField(max_length=3, default="INR")
    original_amount = models.DecimalField(max_digits=12, decimal_places=2)
    exchange_rate = models.DecimalField(max_digits=10, decimal_places=4, default=1.0)
    date = models.DateField()
    paid_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="expenses_paid",
    )
    split_type = models.CharField(max_length=20, choices=SPLIT_TYPE_CHOICES)
    notes = models.TextField(blank=True, default="")
    is_settlement = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["date", "created_at"]

    def __str__(self) -> str:
        return f"{self.description} — ₹{self.amount}"


class ExpenseSplit(models.Model):
    """How much each participant owes for a given expense."""

    expense = models.ForeignKey(
        Expense,
        on_delete=models.CASCADE,
        related_name="splits",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="expense_splits",
    )
    amount_owed = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        unique_together = ("expense", "user")

    def __str__(self) -> str:
        return f"{self.user.username} owes ₹{self.amount_owed} for {self.expense.description}"


class Settlement(models.Model):
    """Direct payment between two members to settle debts."""

    group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE,
        related_name="settlements",
    )
    paid_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="settlements_paid",
    )
    paid_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="settlements_received",
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    date = models.DateField()
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["date"]

    def __str__(self) -> str:
        return f"{self.paid_by.username} → {self.paid_to.username}: ₹{self.amount}"


class ImportReport(models.Model):
    """Summary of a CSV import run."""

    group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE,
        related_name="import_reports",
    )
    imported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="import_reports",
    )
    filename = models.CharField(max_length=255)
    total_rows = models.IntegerField(default=0)
    imported_count = models.IntegerField(default=0)
    anomaly_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Import {self.filename} — {self.imported_count}/{self.total_rows} rows"


class ImportAnomaly(models.Model):
    """A single anomaly detected during CSV import."""

    SEVERITY_CHOICES = [
        ("fatal", "Fatal"),
        ("critical", "Critical"),
        ("warning", "Warning"),
        ("auto_fixed", "Auto-Fixed"),
        ("info", "Info"),
    ]

    import_report = models.ForeignKey(
        ImportReport,
        on_delete=models.CASCADE,
        related_name="anomalies",
    )
    row_number = models.IntegerField()
    anomaly_type = models.CharField(max_length=100)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES)
    description = models.TextField()
    original_data = models.TextField(blank=True, default="")
    action_taken = models.TextField(blank=True, default="")
    requires_review = models.BooleanField(default=False)
    reviewed = models.BooleanField(default=False)
    resolved_action = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["row_number"]

    def __str__(self) -> str:
        return f"Row {self.row_number}: [{self.severity}] {self.anomaly_type}"


class OTPVerification(models.Model):
    """Stores OTP codes for forgot password verification."""

    email = models.EmailField()
    otp = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    is_verified = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def is_expired(self) -> bool:
        from django.utils import timezone
        from datetime import timedelta
        return timezone.now() > self.created_at + timedelta(minutes=10)

    def __str__(self) -> str:
        return f"OTP for {self.email} — {self.otp} (Verified: {self.is_verified})"
