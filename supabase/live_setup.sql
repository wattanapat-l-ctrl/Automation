-- ============================================================
-- Alarm & Maintenance Management System - FULL SETUP
-- Copy & paste the ENTIRE file into: Supabase Dashboard -> SQL Editor -> Run
-- It is safe to run more than once (idempotent).
-- ============================================================

-- ---------- 1. PROFILES ----------
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

-- ---------- 2. MACHINES ----------
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

-- ---------- 3. ALARMS ----------
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

-- ---------- 4. MAINTENANCE RECORDS ----------
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

-- ---------- 5. AUDIT LOGS ----------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  changed_by uuid references auth.users (id),
  changed_by_name text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.machines enable row level security;
alter table public.alarms enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.audit_logs enable row level security;

-- anyone signed in can read any profile (resolve roles/names)
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

-- a user can update their own profile name (not their role)
drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (
    (auth.uid() = id) and (role = (select role from public.profiles where id = auth.uid()))
  );

-- a user can create their own profile row if it is missing (self-heal)
drop policy if exists "profiles_self_insert" on public.profiles;
create policy "profiles_self_insert" on public.profiles
  for insert to authenticated
  with check (auth.uid() = id);

-- everyone signed in can view machines
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
drop policy if exists "alarms_technician_update_status" on public.alarms;
create policy "alarms_technician_update_status" on public.alarms
  for update to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'technician')
  ))
  with check (status in ('Open', 'In Progress', 'Closed'));

-- everyone signed in can view maintenance records
drop policy if exists "maint_select_authenticated" on public.maintenance_records;
create policy "maint_select_authenticated" on public.maintenance_records
  for select to authenticated using (true);

-- admins can insert, update, delete maintenance records
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

-- technicians can create and edit maintenance records
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

-- only admins can read the audit log
drop policy if exists "audit_admin_select" on public.audit_logs;
create policy "audit_admin_select" on public.audit_logs
  for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

-- ============================================================
-- TRIGGERS
-- ============================================================
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

-- Audit trail helper (runs with definer rights so the log write always succeeds)
create or replace function public.log_audit_action()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_old jsonb;
  v_new jsonb;
begin
  select coalesce(p.full_name, p.email) into v_name
  from public.profiles p where p.id = v_uid;

  if tg_op = 'DELETE' then
    v_old := to_jsonb(old);
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
  else
    v_new := to_jsonb(new);
  end if;

  insert into public.audit_logs
    (table_name, record_id, action, changed_by, changed_by_name, old_data, new_data)
  values
    (tg_table_name, coalesce(new.id, old.id), tg_op, v_uid, v_name, v_old, v_new);

  return new;
end;
$$;

drop trigger if exists audit_machines on public.machines;
create trigger audit_machines
  after insert or update or delete on public.machines
  for each row execute function public.log_audit_action();

drop trigger if exists audit_alarms on public.alarms;
create trigger audit_alarms
  after insert or update or delete on public.alarms
  for each row execute function public.log_audit_action();

drop trigger if exists audit_maintenance on public.maintenance_records;
create trigger audit_maintenance
  after insert or update or delete on public.maintenance_records
  for each row execute function public.log_audit_action();

-- ============================================================
-- SEED DATA (sample machines, alarms, maintenance records)
-- ============================================================
insert into public.machines (machine_id, machine_name, machine_type, location, status)
values
  ('MC-001', 'CNC Milling Machine', 'CNC', 'Plant 1 - Building A', 'Running'),
  ('MC-002', 'Injection Molding Machine', 'Injection', 'Plant 1 - Building B', 'Running'),
  ('MC-003', 'Robotic Assembly Line', 'Robot', 'Plant 2 - Building A', 'Stop'),
  ('MC-004', 'Conveyor Belt System', 'Conveyor', 'Plant 2 - Building B', 'Alarm'),
  ('MC-005', 'Air Compressor', 'Utility', 'Power Room', 'Maintenance')
on conflict (machine_id) do nothing;

insert into public.alarms (machine_id, alarm_code, description, cause, status, alarmed_at)
select m.id, x.code, x.desc, x.cause, x.status, now() - x.hours * interval '1 hour'
from public.machines m
cross join (values
  ('MC-004', 'E-STOP', 'Emergency stop activated', 'Operator pressed e-stop during jamming', 'In Progress', 2),
  ('MC-004', 'E-304', 'Conveyor motor overload', 'Possible foreign object on belt', 'Open', 6),
  ('MC-001', 'E-201', 'Spindle temperature high', 'Coolant flow insufficient', 'Open', 26),
  ('MC-001', 'E-115', 'Servo axis over-travel', 'Limit switch out of alignment', 'Closed', 72),
  ('MC-002', 'E-102', 'Injection pressure out of range', 'Nozzle clogged', 'Open', 30),
  ('MC-003', 'E-501', 'Robot gripper sensor fault', 'Sensor misaligned after crash', 'Open', 50)
) as x(code, desc, cause, status, hours)
where m.machine_id = x.code;

insert into public.maintenance_records
  (machine_id, maintenance_type, problem, action_taken, technician, status, maintenance_date)
select m.id, x.t, x.problem, x.action, x.tech, x.status, current_date - x.days
from public.machines m
cross join (values
  ('MC-005', 'Preventive', 'Air pressure drops below threshold', 'Replaced air filter and checked hoses', 'Kittisak', 'Completed', 3),
  ('MC-001', 'Preventive', 'Scheduled lubrication check', 'Refilled spindle oil, no issues found', 'Somchai', 'Completed', 6),
  ('MC-004', 'Corrective', 'Belt slipping under load', 'Tensioned belt, waiting on spare rollers', 'Prasert', 'Waiting Part', 1),
  ('MC-002', 'Corrective', 'Screw barrel wear suspected', 'Planned replacement, technicians assigned', 'Kittisak', 'In Progress', 0)
) as x(t, problem, action, tech, status, days)
where m.machine_id = x.t;