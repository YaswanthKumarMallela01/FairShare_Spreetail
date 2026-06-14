"""
DRF serializers for every model in the FairShare API.
"""

from django.contrib.auth.models import User
from rest_framework import serializers

from .models import (
    Expense,
    ExpenseSplit,
    Group,
    GroupMembership,
    ImportAnomaly,
    ImportReport,
    Settlement,
)


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email"]


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)

    def validate_username(self, value: str) -> str:
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already taken.")
        return value

    def validate_email(self, value: str) -> str:
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Email already registered.")
        return value

    def create(self, validated_data: dict) -> User:
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=validated_data["password"],
        )
        return user


# ---------------------------------------------------------------------------
# Group & Membership
# ---------------------------------------------------------------------------
class GroupMembershipSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    user_id = serializers.IntegerField(source="user.id", read_only=True)

    class Meta:
        model = GroupMembership
        fields = [
            "id",
            "user_id",
            "username",
            "group",
            "joined_at",
            "left_at",
            "is_active",
            "pending_leave_request",
        ]
        read_only_fields = ["id"]


class GroupSerializer(serializers.ModelSerializer):
    memberships = GroupMembershipSerializer(many=True, read_only=True)
    created_by_username = serializers.CharField(
        source="created_by.username", read_only=True
    )

    class Meta:
        model = Group
        fields = [
            "id",
            "name",
            "description",
            "invite_code",
            "created_by",
            "created_by_username",
            "memberships",
            "created_at",
        ]
        read_only_fields = ["id", "invite_code", "created_by", "created_at"]

    def to_representation(self, instance):
        if not instance.invite_code:
            import random
            import string
            while True:
                code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
                if not Group.objects.filter(invite_code=code).exists():
                    instance.invite_code = code
                    instance.save(update_fields=["invite_code"])
                    break
        return super().to_representation(instance)


# ---------------------------------------------------------------------------
# Expense & Splits
# ---------------------------------------------------------------------------
class ExpenseSplitSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = ExpenseSplit
        fields = ["id", "expense", "user", "username", "amount_owed"]
        read_only_fields = ["id"]


class ExpenseSerializer(serializers.ModelSerializer):
    splits = ExpenseSplitSerializer(many=True, read_only=True)
    paid_by_username = serializers.CharField(
        source="paid_by.username", read_only=True
    )
    # Accept split data on create/update
    split_data = serializers.ListField(
        child=serializers.DictField(), write_only=True, required=False
    )

    class Meta:
        model = Expense
        fields = [
            "id",
            "group",
            "description",
            "amount",
            "original_currency",
            "original_amount",
            "exchange_rate",
            "date",
            "paid_by",
            "paid_by_username",
            "split_type",
            "notes",
            "is_settlement",
            "splits",
            "split_data",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def create(self, validated_data: dict) -> Expense:
        split_data = validated_data.pop("split_data", [])
        expense = Expense.objects.create(**validated_data)
        for sd in split_data:
            ExpenseSplit.objects.create(
                expense=expense,
                user_id=sd["user_id"],
                amount_owed=sd["amount_owed"],
            )
        return expense

    def update(self, instance: Expense, validated_data: dict) -> Expense:
        split_data = validated_data.pop("split_data", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if split_data is not None:
            instance.splits.all().delete()
            for sd in split_data:
                ExpenseSplit.objects.create(
                    expense=instance,
                    user_id=sd["user_id"],
                    amount_owed=sd["amount_owed"],
                )
        return instance


# ---------------------------------------------------------------------------
# Settlement
# ---------------------------------------------------------------------------
class SettlementSerializer(serializers.ModelSerializer):
    paid_by_username = serializers.CharField(
        source="paid_by.username", read_only=True
    )
    paid_to_username = serializers.CharField(
        source="paid_to.username", read_only=True
    )

    class Meta:
        model = Settlement
        fields = [
            "id",
            "group",
            "paid_by",
            "paid_by_username",
            "paid_to",
            "paid_to_username",
            "amount",
            "date",
            "notes",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


# ---------------------------------------------------------------------------
# Import Report & Anomalies
# ---------------------------------------------------------------------------
class ImportAnomalySerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportAnomaly
        fields = [
            "id",
            "import_report",
            "row_number",
            "anomaly_type",
            "severity",
            "description",
            "original_data",
            "action_taken",
            "requires_review",
            "reviewed",
            "resolved_action",
        ]
        read_only_fields = ["id"]


class ImportReportSerializer(serializers.ModelSerializer):
    anomalies = ImportAnomalySerializer(many=True, read_only=True)
    imported_by_username = serializers.CharField(
        source="imported_by.username", read_only=True
    )

    class Meta:
        model = ImportReport
        fields = [
            "id",
            "group",
            "imported_by",
            "imported_by_username",
            "filename",
            "total_rows",
            "imported_count",
            "anomaly_count",
            "anomalies",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]
