"""
Admin site registration for all FairShare models.
"""

from django.contrib import admin

from .models import (
    Expense,
    ExpenseSplit,
    Group,
    GroupMembership,
    ImportAnomaly,
    ImportReport,
    Settlement,
)


class GroupMembershipInline(admin.TabularInline):
    model = GroupMembership
    extra = 0


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ("name", "created_by", "created_at")
    search_fields = ("name",)
    inlines = [GroupMembershipInline]


@admin.register(GroupMembership)
class GroupMembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "group", "joined_at", "left_at", "is_active")
    list_filter = ("is_active", "group")


class ExpenseSplitInline(admin.TabularInline):
    model = ExpenseSplit
    extra = 0


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = (
        "description",
        "amount",
        "original_currency",
        "date",
        "paid_by",
        "split_type",
        "is_settlement",
        "group",
    )
    list_filter = ("group", "split_type", "original_currency", "is_settlement")
    search_fields = ("description",)
    date_hierarchy = "date"
    inlines = [ExpenseSplitInline]


@admin.register(ExpenseSplit)
class ExpenseSplitAdmin(admin.ModelAdmin):
    list_display = ("expense", "user", "amount_owed")
    list_filter = ("expense__group",)


@admin.register(Settlement)
class SettlementAdmin(admin.ModelAdmin):
    list_display = ("paid_by", "paid_to", "amount", "date", "group")
    list_filter = ("group",)
    date_hierarchy = "date"


class ImportAnomalyInline(admin.TabularInline):
    model = ImportAnomaly
    extra = 0
    readonly_fields = (
        "row_number",
        "anomaly_type",
        "severity",
        "description",
        "original_data",
        "action_taken",
    )


@admin.register(ImportReport)
class ImportReportAdmin(admin.ModelAdmin):
    list_display = (
        "filename",
        "group",
        "imported_by",
        "total_rows",
        "imported_count",
        "anomaly_count",
        "created_at",
    )
    list_filter = ("group",)
    inlines = [ImportAnomalyInline]


@admin.register(ImportAnomaly)
class ImportAnomalyAdmin(admin.ModelAdmin):
    list_display = (
        "import_report",
        "row_number",
        "anomaly_type",
        "severity",
        "requires_review",
        "reviewed",
    )
    list_filter = ("severity", "anomaly_type", "requires_review", "reviewed")
