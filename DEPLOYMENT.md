# FairShare — Git Description & Deployment Guide

> **Official Project Description (Exactly 350 characters):**
> `FairShare is a premium, glassmorphic dark-mode shared expense application designed for flatmates and workspaces. Key features include 20-rule automated CSV anomaly scanning, a scrubbable balance timeline player, a simplified settlement optimizer, a physics-based SVG debt network graph, and a conversational Gemini AI roommate advisor with memory.`

---

## 🤖 1. Chat Memory & Multi-Agent Architecture

We upgraded the AI roommate advisor to an **interactive Chat Interface**. Instead of single-turn reports, users can converse back-and-forth about expenses, math details, or roommate habits. 

### Multi-Turn Conversation Payload
- **Frontend State**: Maintains a list of messages: `[{ "sender": "user" | "ai", "text": "..." }]`.
- **Backend View (`AIAssistantView`)**:
  - Receives the message history and current question in the POST payload.
  - Maps the list to Gemini's native role structure (`user` / `model`).
  - Automatically prefixes the **very first turn** with the comprehensive group database context (active members, simplified debts list, and recent expenses list).
  - Appends subsequent conversation turns.
  - Submits the complete multi-turn `contents` array to the `gemini-3.1-flash-lite` API using secure `x-goog-api-key` headers.

---

## 🚀 2. Production Deployment Blueprint (Zero Limitations)

This guide provides instructions to deploy your stack using **Supabase** (Database), **Render** (Backend), and **Vercel** (Frontend).

### 🗄️ Phase A: Setup Supabase Database

1. **Create Project**: Go to [Supabase](https://supabase.com/) and create a free project. Set a database password and save it somewhere secure.
2. **Find Connection String (URI)**:
   * **Method 1 (Fastest)**: Click the **Connect** button in the top navigation bar of your Supabase project dashboard. Select the **ORM** or **URI** tab, copy the Postgres connection string under the **Direct connection** (or Transaction Connection/Pooler) section.
   * **Method 2 (Alternative)**: Go to **Project Settings** (gear icon in the left-hand sidebar) → **Database**. Scroll down to the **Connection string** section, select **URI**, and copy it.
   * The connection string will look like this:
     `postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxx.supabase.co:5432/postgres`
3. **Set Password**: Replace `[YOUR-PASSWORD]` in the copied string with the database password you set when creating the project. Save this connection string; you will need it for Phase B.
   * *Note on Special Characters*: If your database password contains special characters (like `@`, `:`, `/`, `#`, `?`, etc.), you **MUST** URL-encode them. For example, `@` becomes `%40`, `:` becomes `%3A`, `/` becomes `%2F`. If you don't URL-encode them, the connection URL parser will fail, resulting in a `500 Internal Server Error`.

> [!IMPORTANT]
> **No SQL Queries Needed!**
> You do **NOT** need to run any manual SQL queries or scripts in the Supabase SQL Editor.
> Django uses an ORM (Object-Relational Mapping). When the backend is deployed on Render in Phase B, it will automatically connect to your Supabase database and execute the migrations (`python manage.py migrate`), creating all the necessary tables (Users, Groups, Expenses, Settlements, and Anomalies) automatically.

---

### 💻 Phase B: Setup Render Backend
1. Create a free account on [Render](https://render.com/).
2. Create a new **Web Service** and connect your GitHub repository.
3. Configure the following settings:
   - **Root Directory**: `backend` (Ensure this is set so Render runs inside the backend folder)
   - **Environment**: `Python 3`
   - **Build Command**:
     ```bash
     pip install -r requirements.txt
     ```
   - **Start Command**:
     ```bash
     python manage.py migrate && gunicorn fairshare.wsgi:application --bind 0.0.0.0:10000
     ```
4. Click **Advanced** and add the following **Environment Variables**:
   - `DATABASE_URL`: *Your Supabase URI* (Render's python environment automatically detects this and swaps out SQLite for PostgreSQL using `dj_database_url` in settings)
   - `GEMINI_API_KEY`: *[YOUR-GEMINI-API-KEY]* (Retrieve this from Google AI Studio)
   - `DJANGO_SECRET_KEY`: *Generates a random secret key for session signing* (e.g. `django-secret-production-key-xxx`)
   - `DJANGO_DEBUG`: `False`
   - `DJANGO_ALLOWED_HOSTS`: `*`
5. Click **Deploy Web Service**. Once deployed, copy your Render API URL (e.g. `https://fairshare-backend.onrender.com`).

---

### 🎨 Phase C: Setup Vercel Frontend
To host the React single-page application (SPA):
1. Create a free account on [Vercel](https://vercel.com/).
2. Select **Add New** → **Project**, and connect your GitHub repository.
3. Configure the project parameters:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add the **Environment Variables**:
   - `VITE_API_BASE_URL`: `https://[YOUR-RENDER-APP].onrender.com/api/` (Make sure it has the trailing slash `/api/` matching your Django endpoints)
5. **SPA Routing Configuration (`vercel.json`)**:
   We added a `vercel.json` file in the `frontend` folder containing rewrite rules. This is crucial; it instructs Vercel to route all sub-paths (like `/group/1`) back to `/index.html`, eliminating the common Vercel 404 reload bug:
   ```json
   {
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```
6. Click **Deploy**. Your frontend is now live!
