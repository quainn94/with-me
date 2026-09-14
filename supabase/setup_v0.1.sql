-- WITH ME Life v0.1.0
-- Supabase SQL Editor에서 1회 실행하세요.
-- 기존 households / app_data 테이블은 건드리지 않습니다.

create extension if not exists pgcrypto;

create table if not exists public.life_ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  unit text not null default 'g',
  kcal_base_qty numeric not null default 100,
  kcal_base_value numeric not null default 0,
  category text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.life_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ingredient_id uuid not null references public.life_ingredients(id) on delete cascade,
  purchased_at date not null default current_date,
  store text default '',
  quantity numeric not null check (quantity > 0),
  unit text not null,
  price numeric not null check (price >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.life_usages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ingredient_id uuid not null references public.life_ingredients(id) on delete cascade,
  used_at date not null default current_date,
  quantity numeric not null check (quantity > 0),
  unit text not null,
  days_used integer not null default 1 check (days_used > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.life_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  servings numeric not null default 1 check (servings > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.life_recipe_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.life_recipes(id) on delete cascade,
  ingredient_id uuid not null references public.life_ingredients(id) on delete cascade,
  quantity numeric not null check (quantity > 0),
  unit text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.life_weights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_at date not null default current_date,
  weight_kg numeric not null check (weight_kg > 0),
  note text default '',
  created_at timestamptz not null default now()
);

alter table public.life_ingredients enable row level security;
alter table public.life_purchases enable row level security;
alter table public.life_usages enable row level security;
alter table public.life_recipes enable row level security;
alter table public.life_recipe_items enable row level security;
alter table public.life_weights enable row level security;

do $$
declare t text;
begin
  foreach t in array array['life_ingredients','life_purchases','life_usages','life_recipes','life_recipe_items','life_weights']
  loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

create index if not exists life_purchases_user_date_idx on public.life_purchases(user_id, purchased_at desc);
create index if not exists life_usages_user_date_idx on public.life_usages(user_id, used_at desc);
create index if not exists life_weights_user_date_idx on public.life_weights(user_id, measured_at desc);
