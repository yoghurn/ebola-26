create table if not exists public.user_game_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  progress_json jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default timezone('utc', now())
);

alter table public.user_game_progress enable row level security;

create policy "users can read their own progress"
on public.user_game_progress
for select
to authenticated
using (auth.uid() = user_id);

create policy "users can insert their own progress"
on public.user_game_progress
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "users can update their own progress"
on public.user_game_progress
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
