-- WITH ME Life v0.3.0 migration
-- v0.1 + v0.2 SQL을 실행한 기존 프로젝트에서 1회 실행하세요.
-- 기존 구매/사용/체중/레시피 데이터는 삭제하지 않습니다.

alter table public.life_ingredients
  add column if not exists calorie_mode text not null default 'exact',
  add column if not exists estimated_unit_grams numeric not null default 0,
  add column if not exists manual_unit_cost numeric not null default 0,
  add column if not exists is_homemade boolean not null default false,
  add column if not exists source_recipe_id uuid;

alter table public.life_ingredients drop constraint if exists life_ingredients_calorie_mode_check;
alter table public.life_ingredients
  add constraint life_ingredients_calorie_mode_check
  check (calorie_mode in ('exact', 'estimate', 'exclude'));

alter table public.life_recipes
  add column if not exists output_qty numeric not null default 0,
  add column if not exists output_unit text not null default '',
  add column if not exists creates_ingredient_id uuid;

create index if not exists life_ingredients_user_homemade_idx
  on public.life_ingredients(user_id, is_homemade);
