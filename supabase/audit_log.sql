-- ============================================================
-- Audit Log (Bonus feature)
-- Run this script in: Supabase Dashboard -> SQL Editor
-- Creates an audit trail of every INSERT / UPDATE / DELETE on
-- machines, alarms and maintenance_records.
-- ============================================================

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

-- Helper trigger function (runs with definer rights so the log write always succeeds)
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

-- RLS: only admins can read the audit log
alter table public.audit_logs enable row level security;

drop policy if exists "audit_admin_select" on public.audit_logs;
create policy "audit_admin_select" on public.audit_logs
  for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));