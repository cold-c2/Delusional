-- Ensure gen_random_uuid() is available
create extension if not exists pgcrypto;

-- Profiles (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text,
  created_at timestamp default now()
);

-- Game rounds
create table if not exists public.game_rounds (
  id uuid primary key default gen_random_uuid(),
  round_number int,
  active boolean default true,
  created_at timestamp default now()
);

-- Tasks
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text,
  description text,
  round_id uuid references public.game_rounds (id) on delete set null,
  created_at timestamp default now()
);

create index if not exists tasks_round_id_idx on public.tasks (round_id);

-- Assigned tasks (each player gets tasks)
create table if not exists public.assigned_tasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  completed boolean default false,
  completed_at timestamp
);

create index if not exists assigned_tasks_task_id_idx on public.assigned_tasks (task_id);
create index if not exists assigned_tasks_user_id_idx on public.assigned_tasks (user_id);

-- Proof uploads
create table if not exists public.proofs (
  id uuid primary key default gen_random_uuid(),
  assigned_task_id uuid references public.assigned_tasks (id) on delete cascade,
  file_url text,
  submitted_at timestamp default now()
);

create index if not exists proofs_assigned_task_id_idx on public.proofs (assigned_task_id);

