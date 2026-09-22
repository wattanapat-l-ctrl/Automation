# Alarm & Maintenance Management System

A web application for **Programming in Automation Systems** course assignment. Built for the Automation/Maintenance department of a factory — manage machines, alarms and maintenance records with role-based access.

## 🛠 Technology Stack

| Technology      | Purpose                          |
| --------------- | -------------------------------- |
| **Next.js 16**  | App Router, React 19, TypeScript |
| **Tailwind CSS**| Styling / UI                      |
| **Supabase**    | Auth, PostgreSQL database, RLS   |
| **GitHub**      | Source control                   |
| **GitHub Actions** | CI (install → build)          |
| **Vercel**      | Deployment                       |
| **AI**          | Used to assist development        |

## ✨ Features

- **Authentication & Roles** — Supabase Auth (email + password). Two roles: **Admin** and **Technician** (bonus `viewer` role supported).
  - `Admin` — full CRUD: machines, alarms, maintenance.
  - `Technician` — view machines, record/edit maintenance, change alarm status, view dashboard.
- **Machine Master** — Machine ID (unique), Name, Type, Location, Status (`Running`, `Stop`, `Alarm`, `Maintenance`).
- **Alarm Record** — Machine, Alarm Code, Description, Date/Time, Cause, Status (`Open`, `In Progress`, `Closed`).
- **Maintenance Record** — Machine, Type, Problem, Action Taken, Technician, Date, Status (`Pending`, `In Progress`, `Completed`, `Waiting Part`).
- **Search & Filter** — by keyword, status, machine, and date range on every list page.
- **Dashboard** — total machines, counts by status, alarms today, maintenance totals, machine-status chart (Recharts), open alarms panel.
- **Input Validation** — required fields, Machine ID format + uniqueness, proper error messages.
- **Self-Service Sign Up** — `/signup` page (name, email, password) with client-side validation. With email confirmation disabled the user is signed in immediately.
- **Simulation Lab** (bonus) — admins can simulate live machine events (short alarm / long alarm / maintenance / status cycle) that stream to every connected dashboard in real time.
- **Audit Log** (bonus) — automatic trail of every INSERT / UPDATE / DELETE via DB triggers; readable by admins on `/audit`.
- **User Management** (admin) — `/users` lists every account; admins can rename users and change roles (`admin` / `technician` / `viewer`) inline. A role/name change is itself recorded in the audit log.
- **My Account** — `/account` lets any user edit their display name and change their password (via Supabase Auth `updateUser`).
- **Live Realtime** — dashboard, alarms and machines update instantly via Supabase Realtime channels.
- **CSV Export** — every list page can download the current filtered data as `.csv`.
- **Dark Mode** — class-based light/dark theme toggle.

## 🗄 Database Structure (Supabase)

```
profiles            (id → auth.users, email, full_name, role)
machines            (id, machine_id UNIQUE, machine_name, machine_type, location, status)
alarms              (id, machine_id → machines, alarm_code, description, cause, status, alarmed_at)
maintenance_records (id, machine_id → machines, maintenance_type, problem,
                     action_taken, technician, status, maintenance_date)
audit_logs          (id, table_name, record_id, action, changed_by, changed_by_name, old_data, new_data)
```

Row Level Security (RLS) policies restrict writes by role. A trigger auto-creates a user profile on signup (default `technician`), and audit triggers record every change to machines / alarms / maintenance_records.

> **Setup:** run [`supabase/live_setup.sql`](./supabase/live_setup.sql) once in **Supabase Dashboard → SQL Editor**. It is idempotent — it creates the tables, RLS policies, all triggers, and seed data (5 machines, 6 alarms, 4 maintenance records).

## 🔧 Getting Started

### 1. Prerequisites
- Node.js 20+
- A Supabase project

### 2. Supabase setup
1. Create a project at https://supabase.com
2. Open **SQL Editor** and run everything in [`supabase/live_setup.sql`](./supabase/live_setup.sql)
3. In **Authentication → Sign In / Providers → Email**, make sure *Email* is enabled. Untick *Confirm email* if you want signups to be instantly active (recommended for a live demo)
4. Copy project URL + anon key from **Settings → API**

### 3. Environment variables
```bash
cp .env.example .env.local
```
Fill in:
```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Run locally
```bash
npm install
npm run dev
# open http://localhost:3000
```

Create a user via the app's **/signup** page (or Supabase → Authentication → Users → Add user), then sign in. Every new user starts as `technician` — promote one to `admin` to unlock full CRUD, the Simulation Lab and the Audit Log:

```sql
update public.profiles set role = 'admin' where email = 'your-email@example.com';
```

## 🚀 Deployment (Vercel)

1. Push the repo to GitHub (see below).
2. Import the repo at https://vercel.com/new
3. Add the two env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
4. Deploy. CI on GitHub Actions also verifies `install` + `build` on every push.

## 🤖 Use of AI in Development

AI (Claude / Codex / Copilot) was used throughout the assignment to assist with:
- Requirements analysis (from the assignment PDF)
- Database design (schema, RLS policies, triggers)
- Writing the source code (pages, components, validation)
- Building the UI (Tailwind layouts, dashboard charts)
- Debugging and fixing build/environment issues
- Writing the README and CI workflow

All code was verified manually against the assignment rubric and tested end-to-end (login → every page) in a real browser against the production deployment.

- **AI Usage Report:** [`AI_REPORT.md`](./AI_REPORT.md) (ภาษาไทย)
- **Screenshots:** [`screenshots/`](./screenshots) — captured from the live Vercel deployment

## 📚 Assignment Rubric Coverage

| Requirement | Where |
|---|---|
| Auth + roles (admin / technician / viewer) | `src/lib/supabase/`, `profiles` table, login + signup pages |
| User / role management (admin) | `/users` (rename users, change roles) |
| Account settings (self) | `/account` (edit name, change password) |
| Machine CRUD | `/machines` (+ add / edit / delete modal) |
| Alarm CRUD + status change | `/alarms` |
| Maintenance CRUD | `/maintenance` |
| Search / Filter | each list page (`src/app/(protected)/.../page.tsx`) |
| Input Validation | each form modal + signup form |
| Dashboard + charts | `/dashboard` |
| Supabase Database + RLS | `supabase/live_setup.sql` |
| GitHub Actions | `.github/workflows/ci.yml` (lint + build on push/PR) |
| Vercel | live at https://automation-pi-one.vercel.app |

---
**Vercel URL:** https://automation-pi-one.vercel.app