-- Run this once in Supabase → SQL Editor.

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#1f5fbf',
  position int not null default 0
);

create table if not exists points (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  person text not null,
  pts int not null,
  reason text,
  created_at timestamptz not null default now()
);

alter table teams  enable row level security;
alter table points enable row level security;

-- Everyone can WATCH the scoreboard
create policy "public read teams"  on teams  for select to anon, authenticated using (true);
create policy "public read points" on points for select to anon, authenticated using (true);

-- Only a logged-in admin can CHANGE anything
create policy "admin write teams"  on teams  for all to authenticated using (true) with check (true);
create policy "admin write points" on points for all to authenticated using (true) with check (true);

-- Live updates
alter publication supabase_realtime add table teams, points;

-- Starter teams (rename them later from the admin page)
insert into teams (name, color, position) values
  ('Team 1', '#1f5fbf', 1), ('Team 2', '#c23030', 2),
  ('Team 3', '#128a4b', 3), ('Team 4', '#b8780a', 4);
