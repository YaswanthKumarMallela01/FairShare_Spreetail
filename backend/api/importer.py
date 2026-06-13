"""
CSV Importer for FairShare — detects and handles ALL 20 anomaly types.

This module parses a CSV file of shared expenses, runs every anomaly detector,
creates ImportReport + ImportAnomaly records, auto-fixes what it can, flags
critical/fatal rows for human review, and imports the clean rows as Expense /
Settlement records.
"""

from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from difflib import SequenceMatcher
from typing import Optional

from django.conf import settings
from django.contrib.auth.models import User
from django.db import transaction

from .models import (
    Expense,
    ExpenseSplit,
    GroupMembership,
    ImportAnomaly,
    ImportReport,
    Settlement,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
EXPECTED_HEADERS = [
    "date", "description", "paid_by", "amount", "currency",
    "split_type", "split_with", "split_details", "notes",
]

VALID_SPLIT_TYPES = {"equal", "unequal", "percentage", "share"}

FUZZY_MATCH_THRESHOLD = 0.75  # SequenceMatcher ratio

# Exchange rates — INR is base (rate = 1.0)
DEFAULT_EXCHANGE_RATES: dict[str, Decimal] = {
    "INR": Decimal("1.0"),
    "USD": Decimal(getattr(settings, "USD_TO_INR_RATE", "83.50")),
    "EUR": Decimal(getattr(settings, "EUR_TO_INR_RATE", "91.00")),
    "GBP": Decimal(getattr(settings, "GBP_TO_INR_RATE", "106.00")),
}


# ---------------------------------------------------------------------------
# Row dataclass — a parsed (possibly partially fixed) CSV row
# ---------------------------------------------------------------------------
@dataclass
class ParsedRow:
    """Mutable representation of one CSV row."""

    row_number: int  # 1-indexed (header = row 0)
    raw: dict[str, str]  # original CSV values
    # Parsed / cleaned fields (filled progressively)
    date: Optional[date] = None
    description: str = ""
    paid_by: str = ""
    amount: Optional[Decimal] = None
    currency: str = "INR"
    split_type: str = ""
    split_with: list[str] = field(default_factory=list)
    split_details: dict[str, Decimal] = field(default_factory=dict)
    notes: str = ""
    # Flags
    is_settlement: bool = False
    skip: bool = False  # True if fatal/critical → do NOT import


@dataclass
class AnomalyRecord:
    """In-memory anomaly before DB write."""

    row_number: int
    anomaly_type: str
    severity: str  # fatal | critical | warning | auto_fixed | info
    description: str
    original_data: str = ""
    action_taken: str = ""
    requires_review: bool = False


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------
def import_csv(
    csv_file,
    group_id: int,
    user_id: int,
    filename: str = "upload.csv",
    exchange_rates: dict[str, Decimal] | None = None,
) -> ImportReport:
    """
    Parse *csv_file* (file-like or UploadedFile), run anomaly detection, and
    import clean rows into the database for the given *group_id*.

    Returns the persisted ``ImportReport`` (with related anomalies).
    """
    rates = exchange_rates or DEFAULT_EXCHANGE_RATES

    # Read file contents
    if hasattr(csv_file, "read"):
        raw_text = csv_file.read()
        if isinstance(raw_text, bytes):
            raw_text = raw_text.decode("utf-8-sig")
    else:
        raw_text = str(csv_file)

    reader = csv.DictReader(io.StringIO(raw_text))
    rows: list[ParsedRow] = []
    for idx, raw_row in enumerate(reader, start=1):
        # Normalise keys to lowercase/stripped
        cleaned = {k.strip().lower(): (v.strip() if v else "") for k, v in raw_row.items()}
        rows.append(ParsedRow(row_number=idx, raw=cleaned))

    # Collect known member names from GroupMemberships
    from .models import Group  # local import avoids circular at module level

    group = Group.objects.get(pk=group_id)
    memberships = GroupMembership.objects.filter(group=group)
    known_members: dict[str, User] = {}  # canonical name (title-case) → User
    member_join_dates: dict[str, date] = {}
    member_leave_dates: dict[str, Optional[date]] = {}
    for m in memberships:
        canon = m.user.username.strip().title()
        known_members[canon] = m.user
        member_join_dates[canon] = m.joined_at
        member_leave_dates[canon] = m.left_at

    anomalies: list[AnomalyRecord] = []

    # ------------------------------------------------------------------
    # Phase 1 — per-row parsing & single-row anomaly detection
    # ------------------------------------------------------------------
    for row in rows:
        _parse_row(row, anomalies, rates, known_members)

    # ------------------------------------------------------------------
    # Phase 2 — cross-row anomaly detection
    # ------------------------------------------------------------------
    _detect_duplicates(rows, anomalies)
    _detect_conflicting_duplicates(rows, anomalies)
    _detect_departed_members(rows, anomalies, member_leave_dates)
    _detect_ambiguous_dates(rows, anomalies)

    # ------------------------------------------------------------------
    # Phase 3 — persist to database
    # ------------------------------------------------------------------
    with transaction.atomic():
        report = ImportReport.objects.create(
            group=group,
            imported_by_id=user_id,
            filename=filename,
            total_rows=len(rows),
            imported_count=0,
            anomaly_count=len(anomalies),
        )

        # Persist anomalies
        for a in anomalies:
            ImportAnomaly.objects.create(
                import_report=report,
                row_number=a.row_number,
                anomaly_type=a.anomaly_type,
                severity=a.severity,
                description=a.description,
                original_data=a.original_data,
                action_taken=a.action_taken,
                requires_review=a.requires_review,
            )

        # Mark rows with fatal/critical anomalies as skip
        _mark_skipped_rows(rows, anomalies)

        imported = 0
        for row in rows:
            if row.skip:
                continue
            if _import_row(row, group, known_members, rates):
                imported += 1

        report.imported_count = imported
        report.anomaly_count = len(anomalies)
        report.save()

    return report


# ---------------------------------------------------------------------------
# Phase 1 helpers — parse a single row
# ---------------------------------------------------------------------------
def _parse_row(
    row: ParsedRow,
    anomalies: list[AnomalyRecord],
    rates: dict[str, Decimal],
    known_members: dict[str, User],
) -> None:
    """Parse raw CSV values into typed fields, emitting anomalies."""
    raw = row.raw

    # --- Date ---
    raw_date = raw.get("date", "")
    row.date = _parse_date(raw_date, row, anomalies)

    # --- Description ---
    row.description = raw.get("description", "").strip()

    # --- Paid By ---
    raw_payer = raw.get("paid_by", "").strip()
    if not raw_payer:
        anomalies.append(AnomalyRecord(
            row_number=row.row_number,
            anomaly_type="MISSING_PAYER",
            severity="fatal",
            description="The paid_by field is empty. Cannot determine who paid.",
            original_data=str(raw),
            action_taken="Row cannot be imported.",
            requires_review=True,
        ))
        row.skip = True
        row.paid_by = ""
    else:
        # Check trailing space
        original_payer = raw.get("paid_by", "")
        if original_payer != original_payer.strip():
            anomalies.append(AnomalyRecord(
                row_number=row.row_number,
                anomaly_type="PAYER_TRAILING_SPACE",
                severity="auto_fixed",
                description=f"Payer name has trailing/leading whitespace: '{original_payer}'.",
                original_data=original_payer,
                action_taken=f"Trimmed to '{raw_payer}'.",
            ))

        # Case normalisation
        title_payer = raw_payer.title()
        if raw_payer != title_payer and raw_payer == raw_payer.lower():
            anomalies.append(AnomalyRecord(
                row_number=row.row_number,
                anomaly_type="CASE_MISMATCH",
                severity="auto_fixed",
                description=f"Payer name '{raw_payer}' has inconsistent casing.",
                original_data=raw_payer,
                action_taken=f"Normalised to '{title_payer}'.",
            ))
            raw_payer = title_payer

        # Fuzzy match against known members
        canonical = _fuzzy_match_name(raw_payer, known_members)
        if canonical and canonical != raw_payer.strip().title():
            anomalies.append(AnomalyRecord(
                row_number=row.row_number,
                anomaly_type="NAME_VARIANT",
                severity="warning",
                description=(
                    f"Payer name '{raw_payer}' is not an exact match — "
                    f"fuzzy-matched to known member '{canonical}'."
                ),
                original_data=raw_payer,
                action_taken=f"Mapped to '{canonical}'. Please verify.",
                requires_review=True,
            ))
            raw_payer = canonical

        row.paid_by = raw_payer.strip().title()

    # --- Amount ---
    raw_amount = raw.get("amount", "").strip()
    row.amount = _parse_amount(raw_amount, row, anomalies)

    # --- Currency ---
    raw_currency = raw.get("currency", "").strip().upper()
    if not raw_currency:
        anomalies.append(AnomalyRecord(
            row_number=row.row_number,
            anomaly_type="MISSING_CURRENCY",
            severity="warning",
            description="Currency field is empty.",
            original_data="",
            action_taken=f"Defaulted to {settings.DEFAULT_CURRENCY}.",
            requires_review=True,
        ))
        raw_currency = getattr(settings, "DEFAULT_CURRENCY", "INR")
    if raw_currency != "INR" and raw_currency in rates:
        anomalies.append(AnomalyRecord(
            row_number=row.row_number,
            anomaly_type="FOREIGN_CURRENCY",
            severity="info",
            description=(
                f"Amount is in {raw_currency}. Will convert at rate "
                f"1 {raw_currency} = {rates[raw_currency]} INR."
            ),
            original_data=raw_currency,
            action_taken=f"Conversion rate {rates[raw_currency]} applied.",
        ))
    row.currency = raw_currency

    # --- Zero amount ---
    if row.amount is not None and row.amount == Decimal("0"):
        anomalies.append(AnomalyRecord(
            row_number=row.row_number,
            anomaly_type="ZERO_AMOUNT",
            severity="warning",
            description="Amount is zero. This expense has no financial impact.",
            original_data=raw_amount,
            action_taken="Row will be imported but has no effect.",
            requires_review=True,
        ))

    # --- Negative amount (refund) ---
    if row.amount is not None and row.amount < Decimal("0"):
        anomalies.append(AnomalyRecord(
            row_number=row.row_number,
            anomaly_type="NEGATIVE_AMOUNT",
            severity="info",
            description=f"Amount {row.amount} is negative — treating as a refund/credit.",
            original_data=raw_amount,
            action_taken="Imported as a negative expense (refund).",
        ))

    # --- Split type ---
    raw_split_type = raw.get("split_type", "").strip().lower()
    row.notes = raw.get("notes", "").strip()

    # Settlement detection
    if _looks_like_settlement(row, raw_split_type):
        anomalies.append(AnomalyRecord(
            row_number=row.row_number,
            anomaly_type="SETTLEMENT_AS_EXPENSE",
            severity="critical",
            description=(
                f"Row appears to be a settlement ('{row.description}') "
                f"logged as an expense. No split_type provided."
            ),
            original_data=str(raw),
            action_taken="Flagged for review. Will attempt conversion to Settlement record.",
            requires_review=True,
        ))
        row.is_settlement = True
        row.split_type = ""
    elif raw_split_type not in VALID_SPLIT_TYPES:
        if raw_split_type:
            anomalies.append(AnomalyRecord(
                row_number=row.row_number,
                anomaly_type="INVALID_SPLIT_TYPE",
                severity="critical",
                description=f"Unknown split_type '{raw_split_type}'.",
                original_data=raw_split_type,
                action_taken="Row flagged for review.",
                requires_review=True,
            ))
        row.split_type = raw_split_type
    else:
        row.split_type = raw_split_type

    # --- Split with (participants) ---
    raw_split_with = raw.get("split_with", "").strip()
    if raw_split_with:
        names = [n.strip() for n in raw_split_with.split(";") if n.strip()]
        cleaned_names: list[str] = []
        for name in names:
            title_name = name.strip().title()
            matched = _fuzzy_match_name(title_name, known_members)
            if matched:
                cleaned_names.append(matched)
            else:
                # Non-member
                anomalies.append(AnomalyRecord(
                    row_number=row.row_number,
                    anomaly_type="NON_MEMBER",
                    severity="warning",
                    description=f"Participant '{name}' is not a known group member.",
                    original_data=name,
                    action_taken="Included as-is. May need manual resolution.",
                    requires_review=True,
                ))
                cleaned_names.append(title_name)
        row.split_with = cleaned_names

    # --- Split details ---
    raw_details = raw.get("split_details", "").strip()
    if raw_details and row.split_type in ("unequal", "percentage", "share"):
        row.split_details = _parse_split_details(raw_details, row.split_type)
    elif raw_details and row.split_type == "equal":
        # Conflicting metadata: equal split but details provided
        anomalies.append(AnomalyRecord(
            row_number=row.row_number,
            anomaly_type="CONFLICTING_METADATA",
            severity="info",
            description=(
                "split_type is 'equal' but split_details were provided. "
                "The split_details will be ignored in favour of equal splitting."
            ),
            original_data=raw_details,
            action_taken="split_details ignored; equal split applied.",
        ))

    # --- Validate percentages ---
    if row.split_type == "percentage" and row.split_details:
        total_pct = sum(row.split_details.values())
        if total_pct != Decimal("100"):
            anomalies.append(AnomalyRecord(
                row_number=row.row_number,
                anomaly_type="BAD_PERCENTAGES",
                severity="critical",
                description=(
                    f"Percentage splits sum to {total_pct}% instead of 100%. "
                    f"Details: {row.split_details}"
                ),
                original_data=raw_details,
                action_taken="Row flagged for review — percentages do not add up.",
                requires_review=True,
            ))

    # --- Validate unequal totals ---
    if row.split_type == "unequal" and row.split_details and row.amount is not None:
        total_split = sum(row.split_details.values())
        if total_split != row.amount:
            anomalies.append(AnomalyRecord(
                row_number=row.row_number,
                anomaly_type="UNEQUAL_SUM_MISMATCH",
                severity="critical",
                description=(
                    f"Unequal split amounts sum to {total_split} "
                    f"but total is {row.amount}."
                ),
                original_data=raw_details,
                action_taken="Row flagged for review.",
                requires_review=True,
            ))


# ---------------------------------------------------------------------------
# Date parsing
# ---------------------------------------------------------------------------
def _parse_date(raw: str, row: ParsedRow, anomalies: list[AnomalyRecord]) -> Optional[date]:
    """Attempt multiple date formats. Returns a date or None."""
    if not raw:
        anomalies.append(AnomalyRecord(
            row_number=row.row_number,
            anomaly_type="MISSING_DATE",
            severity="fatal",
            description="Date field is empty.",
            original_data="",
            action_taken="Row cannot be imported.",
            requires_review=True,
        ))
        row.skip = True
        return None

    # Try DD-MM-YYYY first
    for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue

    # Try Mon-DD (e.g. "Mar-14") — infer year from context
    month_abbr_pattern = re.match(
        r"^([A-Za-z]{3})-(\d{1,2})$", raw
    )
    if month_abbr_pattern:
        month_str, day_str = month_abbr_pattern.groups()
        try:
            parsed = datetime.strptime(f"{day_str}-{month_str}-2026", "%d-%b-%Y").date()
            anomalies.append(AnomalyRecord(
                row_number=row.row_number,
                anomaly_type="BAD_DATE_FORMAT",
                severity="auto_fixed",
                description=f"Date '{raw}' is not in DD-MM-YYYY format.",
                original_data=raw,
                action_taken=f"Parsed as {parsed.strftime('%d-%m-%Y')} (year inferred as 2026).",
            ))
            return parsed
        except ValueError:
            pass

    anomalies.append(AnomalyRecord(
        row_number=row.row_number,
        anomaly_type="UNPARSEABLE_DATE",
        severity="fatal",
        description=f"Cannot parse date '{raw}'.",
        original_data=raw,
        action_taken="Row cannot be imported.",
        requires_review=True,
    ))
    row.skip = True
    return None


# ---------------------------------------------------------------------------
# Amount parsing
# ---------------------------------------------------------------------------
def _parse_amount(
    raw: str, row: ParsedRow, anomalies: list[AnomalyRecord]
) -> Optional[Decimal]:
    """Parse amount string, handling commas and precision issues."""
    if not raw:
        anomalies.append(AnomalyRecord(
            row_number=row.row_number,
            anomaly_type="MISSING_AMOUNT",
            severity="fatal",
            description="Amount field is empty.",
            original_data="",
            action_taken="Row cannot be imported.",
            requires_review=True,
        ))
        row.skip = True
        return None

    original_raw = raw

    # Strip commas (e.g. "1,200" → "1200")
    if "," in raw:
        cleaned = raw.replace(",", "")
        anomalies.append(AnomalyRecord(
            row_number=row.row_number,
            anomaly_type="COMMA_IN_AMOUNT",
            severity="auto_fixed",
            description=f"Amount '{raw}' contains commas.",
            original_data=raw,
            action_taken=f"Stripped commas → '{cleaned}'.",
        ))
        raw = cleaned

    # Strip surrounding quotes
    raw = raw.strip('"').strip("'")

    try:
        value = Decimal(raw)
    except InvalidOperation:
        anomalies.append(AnomalyRecord(
            row_number=row.row_number,
            anomaly_type="UNPARSEABLE_AMOUNT",
            severity="fatal",
            description=f"Cannot parse amount '{original_raw}'.",
            original_data=original_raw,
            action_taken="Row cannot be imported.",
            requires_review=True,
        ))
        row.skip = True
        return None

    # Check decimal precision — more than 2 decimal places
    if value != value.quantize(Decimal("0.01")):
        rounded = value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        anomalies.append(AnomalyRecord(
            row_number=row.row_number,
            anomaly_type="DECIMAL_PRECISION",
            severity="auto_fixed",
            description=f"Amount {value} has more than 2 decimal places.",
            original_data=str(value),
            action_taken=f"Rounded to {rounded}.",
        ))
        value = rounded

    return value


# ---------------------------------------------------------------------------
# Name matching
# ---------------------------------------------------------------------------
def _fuzzy_match_name(
    name: str, known_members: dict[str, User]
) -> Optional[str]:
    """Return the canonical member name if *name* closely matches one."""
    title_name = name.strip().title()
    if title_name in known_members:
        return title_name

    best_match: Optional[str] = None
    best_ratio = 0.0
    for canon in known_members:
        ratio = SequenceMatcher(None, title_name.lower(), canon.lower()).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_match = canon

    if best_ratio >= FUZZY_MATCH_THRESHOLD:
        return best_match
    return None


# ---------------------------------------------------------------------------
# Split details parsing
# ---------------------------------------------------------------------------
def _parse_split_details(raw: str, split_type: str) -> dict[str, Decimal]:
    """
    Parse split_details like "Rohan 700; Priya 400; Meera 400"
    or "Aisha 30%; Rohan 30%; ..." into {name: value}.
    """
    details: dict[str, Decimal] = {}
    parts = [p.strip() for p in raw.split(";") if p.strip()]
    for part in parts:
        # Remove trailing %
        part_clean = part.replace("%", "").strip()
        # Split on last space (name might have spaces)
        tokens = part_clean.rsplit(None, 1)
        if len(tokens) == 2:
            name_part, val_part = tokens
            try:
                details[name_part.strip().title()] = Decimal(val_part)
            except InvalidOperation:
                continue
    return details


# ---------------------------------------------------------------------------
# Settlement detection
# ---------------------------------------------------------------------------
def _looks_like_settlement(row: ParsedRow, raw_split_type: str) -> bool:
    """Heuristic: is this row really a settlement disguised as an expense?"""
    desc_lower = row.description.lower()
    settlement_keywords = ["paid back", "settled", "settlement", "repay", "reimburse"]
    has_keyword = any(kw in desc_lower for kw in settlement_keywords)
    no_split = not raw_split_type
    one_recipient = len(row.raw.get("split_with", "").split(";")) <= 1
    return has_keyword and (no_split or one_recipient)


# ---------------------------------------------------------------------------
# Phase 2 — cross-row detectors
# ---------------------------------------------------------------------------
def _detect_duplicates(rows: list[ParsedRow], anomalies: list[AnomalyRecord]) -> None:
    """
    Detect exact duplicates: same date, payer, amount, with similar
    descriptions. Flag the SECOND occurrence.
    """
    seen: dict[tuple, int] = {}  # (date, payer, amount) → first row number
    for row in rows:
        if row.date is None or row.amount is None or not row.paid_by:
            continue
        key = (row.date, row.paid_by.lower(), row.amount)
        if key in seen:
            first_row = seen[key]
            # Find the first row's description
            first_desc = ""
            for r in rows:
                if r.row_number == first_row:
                    first_desc = r.description
                    break
            # Check description similarity
            ratio = SequenceMatcher(
                None, row.description.lower(), first_desc.lower()
            ).ratio()
            if ratio >= 0.5:
                anomalies.append(AnomalyRecord(
                    row_number=row.row_number,
                    anomaly_type="DUPLICATE",
                    severity="critical",
                    description=(
                        f"Likely duplicate of row {first_row}: "
                        f"same date ({row.date}), payer ({row.paid_by}), "
                        f"amount ({row.amount}). "
                        f"Descriptions: '{first_desc}' vs '{row.description}'."
                    ),
                    original_data=str(row.raw),
                    action_taken=f"Row {row.row_number} flagged; row {first_row} kept.",
                    requires_review=True,
                ))
                row.skip = True
        else:
            seen[key] = row.row_number


def _detect_conflicting_duplicates(
    rows: list[ParsedRow], anomalies: list[AnomalyRecord]
) -> None:
    """
    Detect rows with same date and very similar description but DIFFERENT
    amounts (conflicting duplicates — e.g. two people logging the same dinner).
    """
    for i, r1 in enumerate(rows):
        for r2 in rows[i + 1 :]:
            if r1.date is None or r2.date is None:
                continue
            if r1.date != r2.date:
                continue
            if r1.amount == r2.amount:
                continue  # handled by exact duplicate detector
            desc_ratio = SequenceMatcher(
                None, r1.description.lower(), r2.description.lower()
            ).ratio()
            if desc_ratio >= 0.5:
                # Check they're not both already skipped
                anomalies.append(AnomalyRecord(
                    row_number=r2.row_number,
                    anomaly_type="CONFLICTING_DUPLICATE",
                    severity="critical",
                    description=(
                        f"Row {r1.row_number} ('{r1.description}', {r1.amount}) "
                        f"and row {r2.row_number} ('{r2.description}', {r2.amount}) "
                        f"appear to be the same event logged with different amounts."
                    ),
                    original_data=str(r2.raw),
                    action_taken="Both rows flagged for review — amounts conflict.",
                    requires_review=True,
                ))
                anomalies.append(AnomalyRecord(
                    row_number=r1.row_number,
                    anomaly_type="CONFLICTING_DUPLICATE",
                    severity="critical",
                    description=(
                        f"Row {r1.row_number} ('{r1.description}', {r1.amount}) "
                        f"and row {r2.row_number} ('{r2.description}', {r2.amount}) "
                        f"appear to be the same event logged with different amounts."
                    ),
                    original_data=str(r1.raw),
                    action_taken="Both rows flagged for review — amounts conflict.",
                    requires_review=True,
                ))


def _detect_departed_members(
    rows: list[ParsedRow],
    anomalies: list[AnomalyRecord],
    member_leave_dates: dict[str, Optional[date]],
) -> None:
    """Flag expenses that include members who have left the group by that date."""
    for row in rows:
        if row.date is None:
            continue
        for participant in row.split_with:
            canon = participant.strip().title()
            leave_date = member_leave_dates.get(canon)
            if leave_date is not None and row.date > leave_date:
                anomalies.append(AnomalyRecord(
                    row_number=row.row_number,
                    anomaly_type="DEPARTED_MEMBER",
                    severity="warning",
                    description=(
                        f"Participant '{canon}' left the group on {leave_date} "
                        f"but is included in an expense dated {row.date}."
                    ),
                    original_data=canon,
                    action_taken="Included as-is but flagged for review.",
                    requires_review=True,
                ))


def _detect_ambiguous_dates(
    rows: list[ParsedRow], anomalies: list[AnomalyRecord]
) -> None:
    """
    Flag dates where DD and MM are both ≤ 12 (ambiguous DD-MM vs MM-DD)
    AND the user's notes suggest confusion about the format.
    """
    for row in rows:
        if row.date is None:
            continue
        raw_date = row.raw.get("date", "")
        # Only check DD-MM-YYYY format
        match = re.match(r"^(\d{2})-(\d{2})-(\d{4})$", raw_date)
        if not match:
            continue
        dd, mm, _ = int(match.group(1)), int(match.group(2)), int(match.group(3))
        if dd <= 12 and mm <= 12 and dd != mm:
            # Check notes for confusion hints
            notes_lower = row.notes.lower()
            confusion_hints = [
                "format", "april", "may", "is this", "or", "mess",
                "which", "correct", "dd-mm", "mm-dd",
            ]
            if any(hint in notes_lower for hint in confusion_hints):
                anomalies.append(AnomalyRecord(
                    row_number=row.row_number,
                    anomaly_type="AMBIGUOUS_DATE",
                    severity="critical",
                    description=(
                        f"Date '{raw_date}' is ambiguous — could be "
                        f"{dd:02d}/{mm:02d} or {mm:02d}/{dd:02d}. "
                        f"Note says: '{row.notes}'."
                    ),
                    original_data=raw_date,
                    action_taken="Parsed as DD-MM-YYYY but flagged for review.",
                    requires_review=True,
                ))


# ---------------------------------------------------------------------------
# Phase 3 — mark skip & import
# ---------------------------------------------------------------------------
def _mark_skipped_rows(
    rows: list[ParsedRow], anomalies: list[AnomalyRecord]
) -> None:
    """Set row.skip = True for any row with a fatal or critical anomaly."""
    fatal_critical_rows: set[int] = set()
    for a in anomalies:
        if a.severity in ("fatal", "critical"):
            fatal_critical_rows.add(a.row_number)
    for row in rows:
        if row.row_number in fatal_critical_rows:
            row.skip = True


def _import_row(
    row: ParsedRow,
    group,
    known_members: dict[str, User],
    rates: dict[str, Decimal],
) -> bool:
    """
    Create an Expense (or Settlement) from a parsed row.
    Returns True if the row was successfully imported.
    """
    if row.date is None or row.amount is None:
        return False

    payer_user = known_members.get(row.paid_by)
    if payer_user is None:
        return False

    # --- Settlement ---
    if row.is_settlement:
        recipient_name = row.split_with[0] if row.split_with else None
        if recipient_name:
            recipient_user = known_members.get(recipient_name.strip().title())
            if recipient_user:
                Settlement.objects.create(
                    group=group,
                    paid_by=payer_user,
                    paid_to=recipient_user,
                    amount=abs(row.amount),
                    date=row.date,
                    notes=row.notes,
                )
                return True
        return False

    # --- Determine exchange rate & INR amount ---
    rate = rates.get(row.currency, Decimal("1.0"))
    original_amount = row.amount
    inr_amount = (original_amount * rate).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    expense = Expense.objects.create(
        group=group,
        description=row.description,
        amount=inr_amount,
        original_currency=row.currency,
        original_amount=original_amount,
        exchange_rate=rate,
        date=row.date,
        paid_by=payer_user,
        split_type=row.split_type or "equal",
        notes=row.notes,
        is_settlement=False,
    )

    # --- Create splits ---
    participants = row.split_with
    if not participants:
        # If no split_with, just the payer
        participants = [row.paid_by]

    participant_users: list[tuple[str, Optional[User]]] = []
    for name in participants:
        canon = name.strip().title()
        participant_users.append((canon, known_members.get(canon)))

    valid_participants = [
        (name, user) for name, user in participant_users if user is not None
    ]

    if not valid_participants:
        return True  # expense created but no splits possible

    if row.split_type == "equal":
        share = (inr_amount / Decimal(len(valid_participants))).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        # Adjust last person for rounding
        total_assigned = share * (len(valid_participants) - 1)
        last_share = inr_amount - total_assigned
        for i, (_, user) in enumerate(valid_participants):
            ExpenseSplit.objects.create(
                expense=expense,
                user=user,
                amount_owed=last_share if i == len(valid_participants) - 1 else share,
            )

    elif row.split_type == "unequal":
        for name, user in valid_participants:
            owed = row.split_details.get(name, Decimal("0"))
            # Convert to INR if needed
            owed_inr = (owed * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            ExpenseSplit.objects.create(
                expense=expense,
                user=user,
                amount_owed=owed_inr,
            )

    elif row.split_type == "percentage":
        for name, user in valid_participants:
            pct = row.split_details.get(name, Decimal("0"))
            owed = (inr_amount * pct / Decimal("100")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            ExpenseSplit.objects.create(
                expense=expense,
                user=user,
                amount_owed=owed,
            )

    elif row.split_type == "share":
        total_shares = sum(
            row.split_details.get(name, Decimal("0"))
            for name, _ in valid_participants
        )
        if total_shares > 0:
            for name, user in valid_participants:
                shares = row.split_details.get(name, Decimal("0"))
                owed = (inr_amount * shares / total_shares).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
                ExpenseSplit.objects.create(
                    expense=expense,
                    user=user,
                    amount_owed=owed,
                )
    else:
        # Fallback: equal among valid participants
        share = (inr_amount / Decimal(len(valid_participants))).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        for _, user in valid_participants:
            ExpenseSplit.objects.create(
                expense=expense, user=user, amount_owed=share
            )

    return True
