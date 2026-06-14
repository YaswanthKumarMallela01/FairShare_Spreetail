"""
Balance calculator for FairShare.

Provides:
    - Per-member net balances for a group
    - Pairwise "who owes whom" debts
    - Debt simplification (minimum transactions via greedy algorithm)
    - Date-range filtering for timeline playback
    - Membership-date awareness
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from django.contrib.auth.models import User
from django.db.models import Q

from .models import Expense, ExpenseSplit, GroupMembership, Settlement


# ---------------------------------------------------------------------------
# Public dataclasses
# ---------------------------------------------------------------------------
@dataclass
class MemberBalance:
    """Net balance for one member. Positive = owed money; Negative = owes."""

    user_id: int
    username: str
    total_paid: Decimal = Decimal("0")
    total_owed: Decimal = Decimal("0")
    net_balance: Decimal = Decimal("0")  # total_paid − total_owed


@dataclass
class DebtEdge:
    """A directed debt from debtor → creditor."""

    from_user_id: int
    from_username: str
    to_user_id: int
    to_username: str
    amount: Decimal = Decimal("0")


@dataclass
class BalanceSummary:
    """Complete balance picture for a group."""

    group_id: int
    member_balances: list[MemberBalance] = field(default_factory=list)
    simplified_debts: list[DebtEdge] = field(default_factory=list)
    raw_debts: list[DebtEdge] = field(default_factory=list)


@dataclass
class TimelineSnapshot:
    """Balance snapshot at a particular date."""

    date: date
    member_balances: dict[int, Decimal] = field(default_factory=dict)  # user_id → net


# ---------------------------------------------------------------------------
# Core calculation
# ---------------------------------------------------------------------------
def compute_balances(
    group_id: int,
    as_of_date: Optional[date] = None,
    from_date: Optional[date] = None,
) -> BalanceSummary:
    """
    Compute the full balance summary for *group_id*.

    If *as_of_date* is given, only include expenses/settlements up to that date.
    If *from_date* is given, only include items on or after that date.
    """
    # Fetch active memberships
    memberships = GroupMembership.objects.filter(group_id=group_id).select_related("user")

    # Build user lookup
    users: dict[int, User] = {}
    join_dates: dict[int, date] = {}
    leave_dates: dict[int, Optional[date]] = {}
    for m in memberships:
        users[m.user_id] = m.user
        join_dates[m.user_id] = m.joined_at
        leave_dates[m.user_id] = m.left_at

    # Fetch expenses
    expense_qs = Expense.objects.filter(group_id=group_id, is_settlement=False)
    if as_of_date:
        expense_qs = expense_qs.filter(date__lte=as_of_date)
    if from_date:
        expense_qs = expense_qs.filter(date__gte=from_date)

    # Fetch settlements
    settlement_qs = Settlement.objects.filter(group_id=group_id)
    if as_of_date:
        settlement_qs = settlement_qs.filter(date__lte=as_of_date)
    if from_date:
        settlement_qs = settlement_qs.filter(date__gte=from_date)

    # Net balance per user: positive = they are owed, negative = they owe
    net: dict[int, Decimal] = defaultdict(Decimal)
    total_paid: dict[int, Decimal] = defaultdict(Decimal)
    total_owed: dict[int, Decimal] = defaultdict(Decimal)

    for expense in expense_qs.prefetch_related("splits"):
        payer_id = expense.paid_by_id
        amount = expense.amount

        # The payer "lent" the total amount
        total_paid[payer_id] += amount

        for split in expense.splits.all():
            uid = split.user_id
            owed = split.amount_owed
            total_owed[uid] += owed

    # Settlements: paid_by pays paid_to
    for s in settlement_qs:
        total_paid[s.paid_by_id] += s.amount
        total_owed[s.paid_to_id] -= s.amount  # reduces what paid_to is owed

    # Compute net balances
    all_user_ids = set(total_paid.keys()) | set(total_owed.keys()) | set(users.keys())
    member_balances: list[MemberBalance] = []
    for uid in sorted(all_user_ids):
        paid = total_paid.get(uid, Decimal("0"))
        owed = total_owed.get(uid, Decimal("0"))
        net_val = (paid - owed).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        user = users.get(uid)
        username = user.username if user else f"User#{uid}"
        member_balances.append(MemberBalance(
            user_id=uid,
            username=username,
            total_paid=paid.quantize(Decimal("0.01")),
            total_owed=owed.quantize(Decimal("0.01")),
            net_balance=net_val,
        ))
        net[uid] = net_val

    # Simplify debts
    simplified = _simplify_debts(net, users)

    return BalanceSummary(
        group_id=group_id,
        member_balances=member_balances,
        simplified_debts=simplified,
    )


# ---------------------------------------------------------------------------
# Debt simplification — minimum cash-flow (greedy)
# ---------------------------------------------------------------------------
def _simplify_debts(
    net: dict[int, Decimal],
    users: dict[int, User],
) -> list[DebtEdge]:
    """
    Given net balances, compute the minimum set of transactions to settle
    all debts using the greedy min-cash-flow algorithm.

    Positive net → creditor (is owed money).
    Negative net → debtor (owes money).
    """
    # Separate into creditors and debtors
    creditors: list[tuple[int, Decimal]] = []
    debtors: list[tuple[int, Decimal]] = []

    for uid, balance in net.items():
        if balance > 0:
            creditors.append((uid, balance))
        elif balance < 0:
            debtors.append((uid, -balance))  # store as positive

    # Sort by amount descending for greedy matching
    creditors.sort(key=lambda x: x[1], reverse=True)
    debtors.sort(key=lambda x: x[1], reverse=True)

    edges: list[DebtEdge] = []

    # Use mutable lists
    cred_list = list(creditors)
    debt_list = list(debtors)

    ci = 0
    di = 0
    while ci < len(cred_list) and di < len(debt_list):
        cred_uid, cred_amt = cred_list[ci]
        debt_uid, debt_amt = debt_list[di]

        transfer = min(cred_amt, debt_amt)
        if transfer > Decimal("0.00"):
            cred_user = users.get(cred_uid)
            debt_user = users.get(debt_uid)
            edges.append(DebtEdge(
                from_user_id=debt_uid,
                from_username=debt_user.username if debt_user else f"User#{debt_uid}",
                to_user_id=cred_uid,
                to_username=cred_user.username if cred_user else f"User#{cred_uid}",
                amount=transfer.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            ))

        cred_list[ci] = (cred_uid, cred_amt - transfer)
        debt_list[di] = (debt_uid, debt_amt - transfer)

        if cred_list[ci][1] <= Decimal("0"):
            ci += 1
        if debt_list[di][1] <= Decimal("0"):
            di += 1

    return edges


# ---------------------------------------------------------------------------
# Timeline — balance snapshots by date
# ---------------------------------------------------------------------------
def compute_timeline(
    group_id: int,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
) -> list[TimelineSnapshot]:
    """
    Return a list of TimelineSnapshot objects, one per distinct date
    that has activity in the group, showing cumulative balances at each date.
    """
    # Fetch active memberships
    memberships = GroupMembership.objects.filter(group_id=group_id).select_related("user")
    users: dict[int, User] = {m.user_id: m.user for m in memberships}

    # Fetch expenses (non-settlement) up to to_date (if given)
    expense_qs = Expense.objects.filter(group_id=group_id, is_settlement=False).prefetch_related("splits")
    if to_date:
        expense_qs = expense_qs.filter(date__lte=to_date)
    expense_qs = expense_qs.order_by("date", "created_at")

    # Fetch settlements up to to_date (if given)
    settlement_qs = Settlement.objects.filter(group_id=group_id)
    if to_date:
        settlement_qs = settlement_qs.filter(date__lte=to_date)
    settlement_qs = settlement_qs.order_by("date", "created_at")

    # Group activities by date
    activity_by_date = defaultdict(list)
    for e in expense_qs:
        activity_by_date[e.date].append(e)
    for s in settlement_qs:
        activity_by_date[s.date].append(s)

    if not activity_by_date:
        return []

    sorted_dates = sorted(activity_by_date.keys())
    snapshots: list[TimelineSnapshot] = []

    # Running totals
    total_paid = defaultdict(Decimal)
    total_owed = defaultdict(Decimal)

    for d in sorted_dates:
        activities = activity_by_date[d]
        for act in activities:
            if isinstance(act, Expense):
                total_paid[act.paid_by_id] += act.amount
                for split in act.splits.all():
                    total_owed[split.user_id] += split.amount_owed
            elif isinstance(act, Settlement):
                total_paid[act.paid_by_id] += act.amount
                total_owed[act.paid_to_id] -= act.amount

        # Only add snapshot if it falls within [from_date, to_date]
        if from_date is None or d >= from_date:
            member_nets = {}
            for uid in users:
                paid = total_paid.get(uid, Decimal("0"))
                owed = total_owed.get(uid, Decimal("0"))
                net_val = (paid - owed).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                member_nets[uid] = net_val

            snapshots.append(TimelineSnapshot(
                date=d,
                member_balances=member_nets,
            ))

    return snapshots


# ---------------------------------------------------------------------------
# Detailed breakdown per member
# ---------------------------------------------------------------------------
@dataclass
class MemberExpenseDetail:
    """One expense line in a member's breakdown."""

    expense_id: int
    date: date
    description: str
    total_amount: Decimal
    paid_by_username: str
    amount_owed: Decimal
    is_payer: bool


def compute_member_detail(
    group_id: int, user_id: int
) -> list[MemberExpenseDetail]:
    """
    Return an expense-by-expense breakdown for a single member
    in a group.
    """
    splits = (
        ExpenseSplit.objects.filter(
            expense__group_id=group_id,
            user_id=user_id,
        )
        .select_related("expense", "expense__paid_by")
        .order_by("expense__date")
    )

    details: list[MemberExpenseDetail] = []
    for split in splits:
        exp = split.expense
        details.append(MemberExpenseDetail(
            expense_id=exp.id,
            date=exp.date,
            description=exp.description,
            total_amount=exp.amount,
            paid_by_username=exp.paid_by.username,
            amount_owed=split.amount_owed,
            is_payer=(exp.paid_by_id == user_id),
        ))

    return details
