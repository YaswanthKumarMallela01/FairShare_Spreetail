# 🚀 FairShare — Shared Expenses App

> A next-gen shared expenses platform built for the Spreetail Software Engineering Intern assignment. Handles messy real-world CSV data with intelligent anomaly detection, multi-currency support, and a stunning glassmorphism UI.

![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python&logoColor=white)
![Django](https://img.shields.io/badge/Django-6.0-092E20?style=flat-square&logo=django&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql&logoColor=white)

---

## 📸 Features at a Glance

- **🤖 Smart CSV Importer** — Detects 20 data anomalies automatically, with a triage dashboard for user review
- **💱 Multi-Currency Support** — USD ↔ INR with configurable exchange rates
- **📊 Debt Visualization** — Interactive graph showing who owes whom, with drill-down to individual expenses
- **🧮 Debt Simplification** — Minimum cash-flow algorithm reduces N² transactions to at most N-1
- **👥 Dynamic Membership** — Members can join/leave groups with date tracking
- **🧾 PDF Export** — One-click settlement report generation
- **📈 Spending Analytics** — Category breakdown, monthly trends, top spender leaderboard
- **🌌 Glassmorphism UI** — Premium dark-mode design with micro-animations

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.10+, Django 6.0, Django REST Framework 3.17 |
| Frontend | React 19, Vite 6, Framer Motion, Recharts |
| Database | SQLite (development) / PostgreSQL (production) |
| Authentication | DRF Token Authentication |
| Deployment | Render (backend) + Vercel (frontend) |

---

## ⚡ Quick Start — Local Development

### Prerequisites
- Python 3.10+
- Node.js 18+
- npm 9+
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/YaswanthKumarMallela01/fairshare.git
cd fairshare
```

### 2. Backend Setup
```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py makemigrations api
python manage.py migrate

# Create a superuser (for admin access)
python manage.py createsuperuser

# Start the development server
python manage.py runserver
```

The backend API will be available at `http://localhost:8000/api/`

### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend will be available at `http://localhost:5173/`

---

## 📖 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register/` | Register a new user |
| POST | `/api/auth/login/` | Login and get token |
| POST | `/api/auth/logout/` | Logout (invalidate token) |
| GET | `/api/auth/profile/` | Get current user profile |
| POST | `/api/auth/demo/` | One-click Recruiter Demo Mode Login & Seeding |
| POST | `/api/auth/forgot-password/` | Send 6-digit OTP code to email |
| POST | `/api/auth/verify-otp/` | Verify 6-digit OTP code |
| POST | `/api/auth/reset-password/` | Reset password using verified OTP |

### Groups
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/groups/` | List/Create groups |
| GET/PUT/DELETE | `/api/groups/:id/` | Group detail/update/delete |
| POST | `/api/groups/join/` | Join a group using invite code |
| POST | `/api/groups/:id/ai-advise/` | Get Gemini AI Roommate financial advice |
| POST | `/api/groups/:group_pk/memberships/` | Add member to group (by username) |

### Expenses
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/expenses/?group=:id` | List/Create expenses for a group |
| GET/PUT/DELETE | `/api/expenses/:id/` | Expense detail/update/delete |

### Settlements
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/settlements/?group=:id` | List/Create settlements for a group |

### Import
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/import/` | Upload and import CSV file (requires group_id) |
| GET | `/api/import-reports/?group=:id` | List import reports for a group |
| GET | `/api/import-reports/:id/` | Import report detail with anomalies |
| GET | `/api/import-reports/:id/excel/` | Export report anomalies to Excel spreadsheet |

### Balances
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/groups/:id/balances/` | Balance summary for a group (who owes who) |
| GET | `/api/groups/:id/balances/detail/` | Detailed expense-by-expense breakdown for a user |
| GET | `/api/groups/:id/timeline/` | Cumulative balance snapshots over time |

---

## 🧪 Running Tests

```bash
cd backend
python manage.py test api
```

---

## 🚀 Deployment

### Backend (Render)
1. Push the repo to GitHub
2. Create a new Web Service on [Render](https://render.com/)
3. Connect the GitHub repo
4. Set the following:
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn fairshare.wsgi:application`
5. Add environment variables:
   - `DJANGO_SECRET_KEY` — a new random secret key
   - `DATABASE_URL` — provided by Render PostgreSQL
   - `ALLOWED_HOSTS` — your Render URL
   - `CORS_ALLOWED_ORIGINS` — your Vercel URL

### Frontend (Vercel)
1. Create a new project on [Vercel](https://vercel.com/)
2. Connect the GitHub repo
3. Set the following:
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Add environment variable:
   - `VITE_API_URL` — your Render backend URL (e.g., `https://fairshare-api.onrender.com/api/`)

---

## 📁 Project Structure

```
fairshare/
├── backend/
│   ├── fairshare/          # Django project settings
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   ├── api/                # Main application
│   │   ├── models.py       # Database models
│   │   ├── serializers.py  # DRF serializers
│   │   ├── views.py        # API views
│   │   ├── urls.py         # API routes
│   │   ├── importer.py     # CSV import engine (20 anomaly detectors)
│   │   ├── balance.py      # Balance calculator + debt simplification
│   │   └── admin.py        # Django admin registration
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/     # Reusable React components
│   │   ├── pages/          # Page-level components
│   │   ├── services/       # API client
│   │   ├── App.jsx         # Router setup
│   │   └── main.jsx        # Entry point
│   ├── index.html
│   └── package.json
├── expenses_export.csv     # Original CSV (untouched)
├── SCOPE.md               # Anomaly log + DB schema
├── DECISIONS.md           # Decision log
├── AI_USAGE.md            # AI tools & failure cases
└── README.md              # This file
```

---

## 🤖 AI Tools Used

This project was built using **Google Gemini (Antigravity Agent)** as the primary AI development collaborator. Full details of AI usage, key prompts, and three concrete failure cases are documented in [AI_USAGE.md](./AI_USAGE.md).

---

## 📄 License

This project was built as an assignment submission for Spreetail's Software Engineering Intern position.
