# Import Report: expenses_export.csv

Produced automatically by FairShare on ingestion.
- **Total Rows:** 42
- **Clean Rows Imported:** 35
- **Data Anomalies Found:** 22

## 📋 Detected Anomalies & Actions Taken

| Row | Anomaly Type | Severity | Description | Action Taken |
|-----|--------------|----------|-------------|--------------|
| 4 | `AMBIGUOUS_DATE` | 🚨 CRITICAL | Date '08-02-2026' is ambiguous — could be 08/02 or 02/08. Note says: 'Dev visiting for the weekend'. | Parsed as DD-MM-YYYY but flagged for review. |
| 5 | `DUPLICATE` | 🚨 CRITICAL | Likely duplicate of row 4: same date (2026-02-08), payer (Dev), amount (3200). Descriptions: 'Dinner at Marina Bites' vs 'dinner - marina bites'. | Row 5 flagged; row 4 kept. |
| 6 | `COMMA_IN_AMOUNT` | 🔧 AUTO_FIXED | Amount '1,200' contains commas. | Stripped commas → '1200'. |
| 8 | `CASE_MISMATCH` | 🔧 AUTO_FIXED | Payer name 'priya' has inconsistent casing. | Normalised to 'Priya'. |
| 9 | `DECIMAL_PRECISION` | 🔧 AUTO_FIXED | Amount 899.995 has more than 2 decimal places. | Rounded to 900.00. |
| 10 | `NAME_VARIANT` | ⚠️ WARNING | Payer name 'Priya S' is not an exact match — fuzzy-matched to known member 'Priya'. | Mapped to 'Priya'. Please verify. |
| 12 | `MISSING_PAYER` | 💀 FATAL | The paid_by field is empty. Cannot determine who paid. | Row cannot be imported. |
| 14 | `BAD_PERCENTAGES` | 🚨 CRITICAL | Percentage splits sum to 110% instead of 100%. Details: {'Aisha': Decimal('30'), 'Rohan': Decimal('30'), 'Priya': Decimal('30'), 'Meera': Decimal('20')} | Row flagged for review — percentages do not add up. |
| 19 | `FOREIGN_CURRENCY` | 💡 INFO | Amount is in USD. Will convert at rate 1 USD = 83.50 INR. | Conversion rate 83.50 applied. |
| 20 | `FOREIGN_CURRENCY` | 💡 INFO | Amount is in USD. Will convert at rate 1 USD = 83.50 INR. | Conversion rate 83.50 applied. |
| 22 | `FOREIGN_CURRENCY` | 💡 INFO | Amount is in USD. Will convert at rate 1 USD = 83.50 INR. | Conversion rate 83.50 applied. |
| 22 | `NON_MEMBER` | ⚠️ WARNING | Participant 'Dev's friend Kabir' is not a known group member. | Included as-is. May need manual resolution. |
| 22 | `AMBIGUOUS_DATE` | 🚨 CRITICAL | Date '11-03-2026' is ambiguous — could be 11/03 or 03/11. Note says: 'Kabir joined for the day'. | Parsed as DD-MM-YYYY but flagged for review. |
| 25 | `FOREIGN_CURRENCY` | 💡 INFO | Amount is in USD. Will convert at rate 1 USD = 83.50 INR. | Conversion rate 83.50 applied. |
| 25 | `NEGATIVE_AMOUNT` | 💡 INFO | Amount -30 is negative — treating as a refund/credit. | Imported as a negative expense (refund). |
| 26 | `BAD_DATE_FORMAT` | 🔧 AUTO_FIXED | Date 'Mar-14' is not in DD-MM-YYYY format. | Parsed as 14-03-2026 (year inferred as 2026). |
| 26 | `CASE_MISMATCH` | 🔧 AUTO_FIXED | Payer name 'rohan' has inconsistent casing. | Normalised to 'Rohan'. |
| 27 | `MISSING_CURRENCY` | ⚠️ WARNING | Currency field is empty. | Defaulted to INR. |
| 30 | `ZERO_AMOUNT` | ⚠️ WARNING | Amount is zero. This expense has no financial impact. | Row will be imported but has no effect. |
| 31 | `BAD_PERCENTAGES` | 🚨 CRITICAL | Percentage splits sum to 110% instead of 100%. Details: {'Aisha': Decimal('30'), 'Rohan': Decimal('30'), 'Priya': Decimal('30'), 'Meera': Decimal('20')} | Row flagged for review — percentages do not add up. |
| 33 | `AMBIGUOUS_DATE` | 🚨 CRITICAL | Date '04-05-2026' is ambiguous — could be 04/05 or 05/04. Note says: 'is this April 5 or May 4? format is a mess'. | Parsed as DD-MM-YYYY but flagged for review. |
| 41 | `CONFLICTING_METADATA` | 💡 INFO | split_type is 'equal' but split_details were provided. The split_details will be ignored in favour of equal splitting. | split_details ignored; equal split applied. |
