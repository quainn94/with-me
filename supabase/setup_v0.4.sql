-- WITH ME Life v0.4.0 migration
-- v0.1 + v0.2 + v0.3 SQL을 실행한 기존 프로젝트에서 1회 실행하세요.
-- 기존 데이터는 삭제하지 않습니다.

create table if not exists public.life_recipe_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.life_recipes(id) on delete cascade,
  planned_at date not null default current_date,
  portions numeric not null default 1 check (portions > 0),
  status text not null default 'planned' check (status in ('planned', 'completed')),
  created_at timestamptz not null default now()
);

alter table public.life_recipe_logs enable row level security;
drop policy if exists "own rows" on public.life_recipe_logs;
create policy "own rows" on public.life_recipe_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.life_usages
  add column if not exists source_recipe_log_id uuid references public.life_recipe_logs(id) on delete cascade;

create index if not exists life_recipe_logs_user_date_idx
  on public.life_recipe_logs(user_id, planned_at desc);

create index if not exists life_usages_recipe_log_idx
  on public.life_usages(source_recipe_log_id);
