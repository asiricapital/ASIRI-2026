create extension if not exists pgcrypto;
create extension if not exists vector;

create type public.project_status as enum ('planned','active','paused','completed','archived');
create type public.task_status as enum ('backlog','todo','in_progress','blocked','done','cancelled');
create type public.memory_kind as enum ('fact','preference','problem','solution','note','source');
create type public.decision_status as enum ('proposed','approved','superseded','rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  locale text not null default 'ar-SA',
  timezone text not null default 'Asia/Riyadh',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  status public.project_status not null default 'planned',
  current_phase text,
  progress smallint not null default 0 check (progress between 0 and 100),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, slug)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  status public.task_status not null default 'todo',
  priority smallint not null default 3 check (priority between 1 and 5),
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  context text,
  decision text not null,
  rationale text not null,
  alternatives jsonb not null default '[]'::jsonb,
  status public.decision_status not null default 'approved',
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  kind public.memory_kind not null,
  title text,
  content text not null,
  importance smallint not null default 3 check (importance between 1 and 5),
  source_type text,
  source_ref text,
  tags text[] not null default '{}',
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activity_events (
  id bigint generated always as identity primary key,
  project_id uuid references public.projects(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  actor_type text not null default 'user',
  event_type text not null,
  entity_type text,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index projects_owner_status_idx on public.projects(owner_id, status);
create index tasks_project_status_idx on public.tasks(project_id, status);
create index decisions_project_date_idx on public.decisions(project_id, decided_at desc);
create index memories_project_kind_idx on public.memories(project_id, kind);
create index memories_search_idx on public.memories using gin(to_tsvector('simple', coalesce(title,'') || ' ' || content));
create index activity_project_date_idx on public.activity_events(project_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.decisions enable row level security;
alter table public.memories enable row level security;
alter table public.activity_events enable row level security;

create policy "profiles_self" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "projects_owner" on public.projects for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "tasks_owner" on public.tasks for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "decisions_owner" on public.decisions for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "memories_owner" on public.memories for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "activity_owner" on public.activity_events for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
