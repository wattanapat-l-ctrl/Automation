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

## 🗄 Database Structure (Supabase)

```
profiles  (id → auth.users, email, full_name, role)
machines  (id, machine_id UNIQUE, machine_name, machine_type, location, status)
alarms    (id, machine_id → machines, alarm_code, description, cause, status, alarmed_at)
maintenance_records (id, machine_id → machines, maintenance_type, problem,
                     action_taken, technician, status, maintenance_date)
```

Row Level Security (RLS) policies restrict writes by role. A trigger auto-creates a user profile on signup (default `technician`).

> **Setup:** run [`supabase/schema.sql`](./supabase/schema.sql) once in **Supabase Dashboard → SQL Editor**. It creates the tables, RLS policies, triggers and sample machines.

## 🔧 Getting Started

### 1. Prerequisites
- Node.js 20+
- A Supabase project

### 2. Supabase setup
1. Create a project at https://supabase.com
2. Open **SQL Editor** and run everything in [`supabase/schema.sql`](./supabase/schema.sql)
3. In **Authentication → Providers**, make sure *Email* is enabled
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

Create a user via Supabase (Authentication → Users → Add user) then sign in. The first user is `technician` — promote to `admin` by updating their `role` in the `profiles` table (or via the SQL editor).

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

All code was verified manually against the assignment rubric.

## 📚 Assignment Rubric Coverage

| Requirement | Where |
|---|---|
| Auth + 2 roles | `src/lib/supabase/`, `profiles` table |
| Machine CRUD | `/machines` |
| Alarm CRUD + status change | `/alarms` |
| Maintenance CRUD | `/maintenance` |
| Search / Filter | each list page |
| Input Validation | each form modal |
| Dashboard + charts | `/dashboard` |
| GitHub Actions | `.github/workflows/ci.yml` |
| Vercel | deployment |

---
**Vercel URL:** (pending deployment)