create table if not exists public.workspace_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.workspace_snapshots enable row level security;

create policy "workspace_snapshots_select_own"
on public.workspace_snapshots
for select
to authenticated
using (auth.uid() = user_id);

create policy "workspace_snapshots_insert_own"
on public.workspace_snapshots
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "workspace_snapshots_update_own"
on public.workspace_snapshots
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.touch_workspace_snapshot()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_workspace_snapshot_updated_at on public.workspace_snapshots;
create trigger trg_workspace_snapshot_updated_at
before update on public.workspace_snapshots
for each row execute function public.touch_workspace_snapshot();
