-- ============================================================
-- Alarm & Maintenance Management System
-- Supabase Database Schema
-- Run this script in: Supabase Dashboard -> SQL Editor
-- ============================================================

-- 1. PROFILES (extends auth.users, holds the role)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'technician'
    check (role in ('admin', 'technician', 'viewer')),
  created_at timestamptz not null default now()
);

-- Auto-create a profile whenever a user signs up (default role: technician)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. MACHINES
create table if not exists public.machines (
  id uuid primary key default gen_random_uuid(),
  machine_id text not null unique,
  machine_name text not null,
  machine_type text,
  location text,
  status text not null default 'Stop'
    check (status in ('Running', 'Stop', 'Alarm', 'Maintenance')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. ALARMS
create table if not exists public.alarms (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references public.machines (id) on delete cascade,
  alarm_code text not null,
  description text not null,
  cause text,
  status text not null default 'Open'
    check (status in ('Open', 'In Progress', 'Closed')),
  alarmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. MAINTENANCE RECORDS
create table if not exists public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references public.machines (id) on delete cascade,
  maintenance_type text not null,
  problem text not null,
  action_taken text,
  technician text,
  status text not null default 'Pending'
    check (status in ('Pending', 'In Progress', 'Completed', 'Waiting Part')),
  maintenance_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists machines_set_updated_at on public.machines;
create trigger machines_set_updated_at
  before update on public.machines
  for each row execute procedure public.set_updated_at();

drop trigger if exists alarms_set_updated_at on public.alarms;
create trigger alarms_set_updated_at
  before update on public.alarms
  for each row execute procedure public.set_updated_at();

drop trigger if exists maintenance_set_updated_at on public.maintenance_records;
create trigger maintenance_set_updated_at
  before update on public.maintenance_records
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Enable Row Level Security on all tables
alter table public.profiles enable row level security;
alter table public.machines enable row level security;
alter table public.alarms enable row level security;
alter table public.maintenance_records enable row level security;

-- PROFILES
-- users can read anyone's profile (needed to resolve roles/names)
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);

-- admin can update any profile (promote/demote roles, edit names)
drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  for update to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

-- a user can update their own profile name
drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (
    (auth.uid() = id) and (role = (select role from public.profiles where id = auth.uid()))
  );

-- MACHINES
-- everyone who is signed in can view machines
drop policy if exists "machines_select_authenticated" on public.machines;
create policy "machines_select_authenticated" on public.machines
  for select to authenticated using (true);

-- admins manage machines (insert/update/delete)
drop policy if exists "machines_admin_insert" on public.machines;
create policy "machines_admin_insert" on public.machines
  for insert to authenticated
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

drop policy if exists "machines_admin_update" on public.machines;
create policy "machines_admin_update" on public.machines
  for update to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

drop policy if exists "machines_admin_delete" on public.machines;
create policy "machines_admin_delete" on public.machines
  for delete to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

-- ALARMS
-- everyone signed in can view alarms
drop policy if exists "alarms_select_authenticated" on public.alarms;
create policy "alarms_select_authenticated" on public.alarms
  for select to authenticated using (true);

-- admins manage alarms (full control)
drop policy if exists "alarms_admin_insert" on public.alarms;
create policy "alarms_admin_insert" on public.alarms
  for insert to authenticated
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

drop policy if exists "alarms_admin_update" on public.alarms;
create policy "alarms_admin_update" on public.alarms
  for update to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

drop policy if exists "alarms_admin_delete" on public.alarms;
create policy "alarms_admin_delete" on public.alarms
  for delete to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

-- technicians may only change the STATUS of an alarm
-- (column locking is enforced by the alarms_tech_status_only trigger below)
drop policy if exists "alarms_technician_update_status" on public.alarms;
create policy "alarms_technician_update_status" on public.alarms
  for update to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'technician')
  ))
  with check (status in ('Open', 'In Progress', 'Closed'));

-- Hard rule: a technician who is NOT an admin may only edit the status column.
create or replace function public.prevent_tech_edit_alarm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  select p.role into v_role
  from public.profiles p
  where p.id = auth.uid();

  if v_role = 'admin' then
    return new;
  end if;

  if old.id = new.id
     and old.machine_id = new.machine_id
     and old.alarm_code = new.alarm_code
     and old.description = new.description
     and old.cause is not distinct from new.cause
     and old.alarmed_at = new.alarmed_at
  then
    return new;
  end if;

  raise exception 'Technicians may only change the alarm status';
end;
$$;

drop trigger if exists alarms_tech_status_only on public.alarms;
create trigger alarms_tech_status_only
  before update on public.alarms
  for each row execute procedure public.prevent_tech_edit_alarm();

-- MAINTENANCE RECORDS
-- everyone signed in can view
drop policy if exists "maint_select_authenticated" on public.maintenance_records;
create policy "maint_select_authenticated" on public.maintenance_records
  for select to authenticated using (true);

-- admins can insert, update, delete
drop policy if exists "maint_admin_insert" on public.maintenance_records;
create policy "maint_admin_insert" on public.maintenance_records
  for insert to authenticated
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

drop policy if exists "maint_admin_update" on public.maintenance_records;
create policy "maint_admin_update" on public.maintenance_records
  for update to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

drop policy if exists "maint_admin_delete" on public.maintenance_records;
create policy "maint_admin_delete" on public.maintenance_records
  for delete to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

-- technicians can create new maintenance records and edit them
drop policy if exists "maint_technician_insert" on public.maintenance_records;
create policy "maint_technician_insert" on public.maintenance_records
  for insert to authenticated
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'technician')
  ));

drop policy if exists "maint_technician_update" on public.maintenance_records;
create policy "maint_technician_update" on public.maintenance_records
  for update to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'technician')
  ));

-- ============================================================
-- SEED DATA (optional - sample machines)
-- ============================================================
insert into public.machines (machine_id, machine_name, machine_type, location, status)
values
  ('MC-001', 'CNC Milling Machine', 'CNC', 'Plant 1 - Building A', 'Running'),
  ('MC-002', 'Injection Molding Machine', 'Injection', 'Plant 1 - Building B', 'Running'),
  ('MC-003', 'Robotic Assembly Line', 'Robot', 'Plant 2 - Building A', 'Stop'),
  ('MC-004', 'Conveyor Belt System', 'Conveyor', 'Plant 2 - Building B', 'Alarm'),
  ('MC-005', 'Air Compressor', 'Utility', 'Power Room', 'Maintenance')
on conflict (machine_id) do nothing;