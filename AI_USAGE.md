# AI_USAGE.md — AI Tools, Prompts & Failure Log

## AI Tools Used

| Tool | Purpose | How Used |
|------|---------|----------|
| **Google Gemini (Antigravity Agent)** | Primary development collaborator | Architecture planning, code generation, CSV anomaly analysis, documentation |
| **Code Editor AI** | Inline suggestions | Minor code completions and syntax fixes |

---

## Key Prompts & Interactions

### Prompt 1: CSV Anomaly Analysis
> "Read the expenses_export.csv file and identify every deliberate data problem. Categorize them by type and suggest handling strategies."

**Result:** AI identified 20 anomalies across 6 categories. This formed the foundation of the SCOPE.md and the importer logic.

### Prompt 2: Database Schema Design  
> "Design a relational database schema for a shared expenses app that supports: changing group membership over time, multiple currencies, four split types (equal/unequal/percentage/share), settlements, and an import report system."

**Result:** AI generated the initial schema. I refined the `GroupMembership` model to add `joined_at`/`left_at` fields after realizing the Meera/Sam timeline needed explicit date tracking.

### Prompt 3: Debt Simplification Algorithm
> "Implement a minimum cash flow algorithm to simplify debts in a group. Given net balances for each person, calculate the minimum number of transactions to settle all debts."

**Result:** AI generated a greedy algorithm. See Failure Case #1 below.

### Prompt 4: CSV Importer Implementation
> "Build a Django CSV importer that detects all 20 anomalies, applies auto-fixes for trivial issues, flags ambiguous ones for user review, and blocks on fatal errors. Generate an ImportReport with ImportAnomaly records."

**Result:** Core logic was generated. Required significant manual testing and corrections — see Failure Cases below.

### Prompt 5: Frontend Design System
> "Create a CSS design system with glassmorphism dark mode, using CSS custom properties for a React app."

**Result:** Generated a comprehensive set of CSS variables and component styles. Applied consistently across all pages.

### Prompt 6: O(N) Timeline playback performance optimization
> "Optimize the compute_timeline function to avoid N+1 query loop for dates in the group. Load active memberships, expenses with prefetch_related splits, and settlements exactly once, and compute the running balance chronologically in memory."

**Result:** Generated an O(N) single-pass balance accumulation. Replaced the old database hit loop, reducing loading time from 9 seconds to under 50ms.

### Prompt 7: Vercel Generic SMTP Email Relay
> "Create a generic serverless SMTP sender function on Vercel send_email.py that receives email, subject, plain_message, and html_message, and securely delivers it using my Gmail app password. Protect it with a shared secret key header check."

**Result:** Generated a Python serverless function that connects to Gmail SMTP on port 465 over SSL, enabling any future notification features to be relayed securely.

### Prompt 8: Admin-Moderated Leave Request Flow
> "Implement a leave request flow where group members click 'Leave Group' to request departure, which sets a pending flag in the membership table. Create API endpoints for the admin to approve or reject the leave requests, which will deactivate their membership and set their left_at date."

**Result:** Scaffolding was generated. Handled database model migrations and frontend state updates to enable clean admin-moderated departures.

---

## ❌ Three Concrete Cases Where AI Produced Something Wrong

### Failure Case 1: Debt Simplification — Off-by-One Rounding

**What AI generated:**
The initial debt simplification algorithm used floating-point arithmetic, leading to scenarios where simplified debts had leftover fractions like `₹0.003` remaining after all settlements.

```python
# AI-generated (buggy):
def simplify_debts(balances):
    creditors = [(name, bal) for name, bal in balances.items() if bal > 0]
    debtors = [(name, -bal) for name, bal in balances.items() if bal < 0]
    # ... used float throughout
```

**How I caught it:**
Hand-calculated balances for a test case with 4 people and 3 equal-split expenses. The simplified output showed Aisha owing ₹333.333... instead of clean amounts. The sum of settlements didn't exactly match the sum of debts.

**What I changed:**
Switched all arithmetic to `Decimal` with explicit `ROUND_HALF_UP` rounding. Added a final reconciliation step that assigns any rounding remainder (≤ ₹0.01) to the largest transaction. Added assertions that total credits == total debits after simplification.

---

### Failure Case 2: CSV Date Parser — "Mar-14" Parsed as March 2014

**What AI generated:**
The initial date parsing used Python's `dateutil.parser.parse()` which interpreted `Mar-14` as `March 1, 2014` (treating "14" as a 2-digit year) rather than `March 14, 2026`.

```python
# AI-generated (buggy):
from dateutil import parser
parsed_date = parser.parse(date_str)  # "Mar-14" → 2014-03-01 ❌
```

**How I caught it:**
During manual testing of the CSV import. Row 27 ("Airport cab") showed a date of `2014-03-01` in the import report, which was obviously wrong and broke the chronological ordering.

**What I changed:**
Added a specific pre-processing step for `Mon-DD` format: regex match `^([A-Za-z]{3})-(\d{1,2})$`, then manually construct the date using the year 2026 (derived from the surrounding CSV context). Falls back to `dateutil.parser` only for standard formats.

```python
# Fixed:
import re
month_day_pattern = re.compile(r'^([A-Za-z]{3})-(\d{1,2})$')
match = month_day_pattern.match(date_str)
if match:
    month_str, day = match.groups()
    parsed = datetime.strptime(f"{day}-{month_str}-2026", "%d-%b-%Y")
```

---

### Failure Case 3: Percentage Split Validation — False Positive on Correct Data

**What AI generated:**
The percentage validation checked if percentages summed to exactly 100, but due to floating-point representation, legitimate percentages like `33.33 + 33.33 + 33.34 = 100.00` were being flagged as errors because the AI used `sum(percentages) != 100` with floats.

```python
# AI-generated (buggy):
total_pct = sum(float(p) for p in percentages)
if total_pct != 100.0:  # False positive due to float precision
    flag_anomaly(...)
```

**How I caught it:**
During testing with a custom expense where three people split 33.33%, 33.33%, 33.34%. The importer flagged it as "percentages don't sum to 100%" even though they clearly do.

**What I changed:**
Used `Decimal` for percentage parsing and added a tolerance check:

```python
# Fixed:
from decimal import Decimal
total_pct = sum(Decimal(p.strip().rstrip('%')) for p in percentages)
if abs(total_pct - Decimal('100')) > Decimal('0.01'):
    flag_anomaly(...)  # Only flag if genuinely off by more than 0.01%
```

This correctly catches the CSV's 110% cases (rows 15 and 32) while allowing legitimate rounding in thirds.

---

## 📝 Lessons Learned

1. **AI is great for scaffolding, terrible at edge cases.** The broad architecture and boilerplate code was excellent. The tricky parts — rounding, date parsing, float vs Decimal — all required manual debugging.

2. **Always hand-test with the actual data.** AI generates code that passes synthetic tests but fails on real-world messy data. The CSV import was only reliable after testing with the actual `expenses_export.csv`.

3. **AI doesn't understand business context.** It couldn't infer that "Mar-14" means March 14, 2026 without being told the year. It couldn't infer that "Rohan paid Aisha back" is a settlement. Domain knowledge had to come from me.
