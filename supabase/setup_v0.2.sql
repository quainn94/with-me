-- WITH ME Life v0.2.0 migration
-- v0.1.0 SQL을 이미 실행한 기존 프로젝트에서 1회 실행하세요.
-- 기존 데이터와 기존 households / app_data 테이블은 삭제하지 않습니다.

alter table public.life_ingredients
  add column if not exists is_personal boolean not null default true;

alter table public.life_usages
  add column if not exists usage_mode text not null default 'direct',
  add column if not exists waste_included boolean not null default false;

-- v0.1에서 "며칠 사용"으로 기록한 데이터는 소진 기록으로 이어받습니다.
update public.life_usages
set usage_mode = 'depletion'
where days_used > 1 and usage_mode = 'direct';

-- 허용값 안전장치
alter table public.life_usages drop constraint if exists life_usages_usage_mode_check;
alter table public.life_usages
  add constraint life_usages_usage_mode_check check (usage_mode in ('direct', 'depletion'));

create index if not exists life_ingredients_user_personal_idx
  on public.life_ingredients(user_id, is_personal);
