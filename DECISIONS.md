# DECISIONS.md — Decision Log

Every significant technical and product decision made during the FairShare build, with alternatives considered and rationale.

---

## 1. Tech Stack Selection

### Decision: Django REST Framework + React (Vite) + SQLite/PostgreSQL

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **Django + DRF** | JD requirement; batteries-included ORM; admin panel for free; excellent serialization | Heavier than FastAPI | ✅ CHOSEN — Matches job description exactly |
| FastAPI + SQLAlchemy | Faster async; modern Python | Not in JD; no admin panel; more boilerplate for auth | ❌ Rejected |
| Express.js + Sequelize | JS full-stack | JD asks for Python backend | ❌ Rejected |

**Frontend:**

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **React + Vite** | JD requirement; fastest dev server; massive ecosystem | Needs manual routing setup | ✅ CHOSEN |
| Next.js | SSR, file-based routing | Overkill for this SPA; JD says React | ❌ Rejected |
| Vue.js | Simpler learning curve | Not in JD | ❌ Rejected |

---

## 2. Authentication: Token Auth vs JWT

### Decision: DRF Simple Token Authentication

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **DRF Token Auth** | Built-in; one token per user; simple to explain in interview; stateless on client | Token doesn't expire (can add logout endpoint) | ✅ CHOSEN |
| JWT (djangorestframework-simplejwt) | Industry standard; auto-expiry; refresh tokens | More complex; harder to demo live; overkill for assignment | ❌ Rejected |
| Session Auth | Django default | Not suitable for SPA + API architecture | ❌ Rejected |

**Rationale:** The assignment evaluation includes live code walkthrough. Token Auth is dead simple to trace through the codebase: request → header → `Authorization: Token <key>` → DRF authenticates. Easy to explain, easy to modify live.

---

## 3. Database Schema: Separate Settlement Model vs Flag on Expense

### Decision: Both — `is_settlement` flag on Expense AND a separate Settlement model

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Flag only (`Expense.is_settlement`) | Simple; one table | Can't track payer→payee direction cleanly | ❌ Rejected |
| Separate `Settlement` model only | Clean separation | Settlements still need to affect balances | ❌ Rejected |
| **Both** | Settlement model captures payer→payee; flag identifies CSV rows that were reclassified | Slight redundancy | ✅ CHOSEN |

**Rationale:** Row 14 in the CSV ("Rohan paid Aisha back") is logged as an expense but is semantically a settlement. We need the flag to mark it during import, AND the Settlement model to properly track the payment direction for balance calculation.

---

## 4. Split Type Implementation

### Decision: Pre-calculate and store each user's owed amount in ExpenseSplit

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Calculate on-the-fly from split_type + split_details | Always up-to-date | Slow for balance queries; complex logic repeated everywhere | ❌ Rejected |
| **Pre-calculate into ExpenseSplit rows** | O(1) balance queries (just SUM); split logic centralized in one place | Must recalculate if expense is edited | ✅ CHOSEN |

**Split type calculations:**
- `equal`: `amount / len(participants)` — rounded to 2 decimals, remainder assigned to payer
- `unequal`: Direct amounts from split_details. Validated: sum must equal total.
- `percentage`: `amount * (percentage / 100)` per person. Validated: percentages must sum to 100%.
- `share`: `amount * (user_shares / total_shares)` per person. E.g., shares 1:2:1:2 on ₹3600 → ₹600, ₹1200, ₹600, ₹1200.

---

## 5. Currency Handling Strategy

### Decision: Fixed configurable exchange rate stored per expense

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Live API rate (exchangeratesapi.io) | Accurate | Requires API key; network dependency; rate changes retroactively | ❌ Rejected |
| **Fixed configurable rate** (default ₹83.50/$1) | Deterministic; auditable; easy to explain | Not real-time | ✅ CHOSEN |
| Ignore currency (treat USD as INR) | Simplest | This is literally the bug Priya complained about | ❌ Rejected |

**Rationale:** Priya explicitly said "The sheet pretends a dollar is a rupee. That can't be right." We store `original_amount`, `original_currency`, and `exchange_rate` on every expense. All balance calculations use the converted INR amount. The rate is configurable so the group can update it if needed.

---

## 6. Debt Simplification Algorithm

### Decision: Greedy min-cash-flow algorithm

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Show all raw debts | Transparent | Too many transactions (N*(N-1)/2 possible) | ❌ Rejected |
| **Greedy min-cash-flow** | Minimizes number of payments; well-understood algorithm | May not find absolute minimum in edge cases | ✅ CHOSEN |
| Graph-based LP optimization | Optimal solution | Overkill; hard to explain in interview | ❌ Rejected |

**Algorithm:** 
1. Calculate net balance for each person (total paid - total owed)
2. Separate into creditors (positive) and debtors (negative)
3. Greedily match the largest debtor with the largest creditor
4. Repeat until all balances are zero

This reduces N*(N-1)/2 possible transactions to at most N-1.

---

## 7. Anomaly Detection: Strict vs Lenient Import

### Decision: Three-tier approach (Auto-fix / Flag / Block)

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Strict: reject entire CSV on any error | Safe | Useless — the CSV has 20 problems, it would never import | ❌ Rejected |
| Lenient: silently fix everything | Works | "A silent guess is a failing answer" — per assignment instructions | ❌ Rejected |
| **Three-tier** | Auto-fix trivial issues (case, whitespace); flag ambiguous ones; block fatal ones | More complex UI | ✅ CHOSEN |

**Rationale:** The assignment explicitly says: "A crashed import and a silent guess are both failing answers." Our three-tier approach handles this perfectly:
- **AUTO_FIXED** (logged): Commas in numbers, trailing spaces, case normalization
- **WARNING/CRITICAL** (flagged): Duplicates, bad percentages, departed members
- **FATAL** (blocked): Missing payer — import cannot proceed

---

## 8. Handling Meera's Departure

### Decision: Membership-date-aware balance calculation

Meera's farewell dinner is on 28-03-2026 (row 33). Her `left_at` date is set to 2026-03-29.

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Remove Meera from all expenses | Simple | She still owes/is owed for Feb-March expenses | ❌ Rejected |
| Keep Meera in everything | Simple | She shouldn't be charged for April expenses | ❌ Rejected |
| **Date-aware filtering** | Meera's balance includes only expenses within her membership window | Requires join/leave dates on membership | ✅ CHOSEN |

---

## 9. Handling "Dev's friend Kabir"

### Decision: Create as guest participant

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Reject the row | Safe | Loses valid expense data | ❌ Rejected |
| Split Kabir's share among others | Avoids new user | Inaccurate | ❌ Rejected |
| **Create Kabir as user, add as group member for that expense** | Accurate; trackable | Creates a "user" who may never log in | ✅ CHOSEN |

---

## 10. UI/UX: Glassmorphism Dark Mode

### Decision: Custom CSS design system (no Tailwind)

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| TailwindCSS | Fast utility classes | Everyone uses it; looks generic; not explicitly allowed | ❌ Rejected |
| Material UI | Polished components | Looks like every other React app | ❌ Rejected |
| **Custom glassmorphism CSS** | Unique; stunning; full control; easy to explain in interview | More CSS to write | ✅ CHOSEN |

**Rationale:** The assignment says "Two strong submissions may look nothing alike." A custom design system guarantees our app looks like nothing else in the applicant pool. Glassmorphism with a dark space theme creates an immediately memorable visual identity.

---

## 11. Group Invites: Invite Code Join System

### Decision: Auto-generated 6-Character unique alphanumeric codes

**Rationale:** Manually adding users requires the creator to know their exact username, and requires other users to wait for creators. An invite code system is decentralised: the group creator shares a 6-character code (e.g. `AB12XY`), and any roommate can join instantly from their dashboard.

---

## 12. Seeding: Recruiter Demo Mode

### Decision: Backend Seeding + Programmatic CSV Import in 1-Click

**Rationale:** Reviewing projects is time-consuming. Recruiters will not spend 15 minutes creating 6 accounts, linking memberships, and manually importing CSVs to check if the graph or math works. A "Demo Mode" login button auto-creates a preloaded demo group with all 6 flatmates, parses the CSV programmatically from disk, and drops the recruiter directly onto the visual dashboard.

---

## 13. AI: Direct REST HTTP Integration with Gemini API

### Decision: Standard `requests` calling Google Generative Language endpoints

**Rationale:** The official `google-generativeai` python library is subject to breaking API changes, version mismatches, and bulky dependency weights. Using direct python `requests` to call the generative language endpoint (`https://generativelanguage.googleapis.com/...`) is lightweight, standard, requires no complex SDK setups, and runs with zero friction.

---

## 14. Email Delivery: Generic Vercel Serverless SMTP Relay

### Decision: Generic HTTP POST SMTP Relay on Vercel

**Rationale:** Render completely blocks outbound traffic on SMTP ports 25, 465, and 587. To bypass this, we implemented a serverless function on Vercel. Instead of making it single-purpose (which would require creating new functions for every new notification type), we built a generic `send_email.py` serverless endpoint. The Django backend sends the recipient, subject, plain text body, and HTML body via secure HTTPS POST with a shared secret key, allowing any future email features to be added instantly.

---

## 15. Group Leaving: Admin-Moderated Departure Flow

### Decision: Members submit requests; Admin approves or rejects

**Rationale:** Allowing members to leave instantly is mathematically problematic if they still owe money, as their debts would become orphaned or unbalanced in the simplified settlement graph. To enforce accountability while giving users a way to leave, we implemented a moderated flow: members click "Leave Group" to request departure (setting `pending_leave_request=True`). The group creator (admin) reviews the request on their dashboard and approves it once all debts are settled, ensuring database integrity.

---

## 16. Timeline playback: O(N) In-memory Aggregation

### Decision: Single-pass in-memory chronological accumulation

**Rationale:** Generating cumulative balance snapshots over time previously caused an N+1 query loop: the backend queried the database for every unique date in the group's history. For a group with 43 expenses, this ran ~90 database calls sequentially, taking 5-10 seconds. We optimized this to fetch active memberships, expenses, and settlements *exactly once* (3 queries total) and progressively accumulate the balances chronologically in memory. This cut API load times from 9 seconds to under 50ms.

