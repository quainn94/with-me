# WITH ME Life v0.3.0

생활 식재료·구매·레시피·체중 기록 앱입니다.

## v0.3.0 변경점
- 일반 채소용 칼로리 간편 추정치와 `정확 / 간편추정 / 제외` 계산 방식
- 식재료 카드형 목록을 한 번에 보는 관리표로 변경
- 구매 기록 수정 + 삭제
- 레시피를 직접 만든 완제품 식재료로 저장 (완성량 기준 원가/kcal 자동 환산)

## 업데이트 순서
1. 기존 `with-me` 폴더에 이 ZIP의 내용물을 덮어씁니다. 기존 `.env.local`은 유지합니다.
2. Supabase SQL Editor에서 `supabase/setup_v0.3.sql`을 **새 Query로 1회 실행**합니다.
3. `npm run build` 후 평소 방식으로 GitHub에 반영합니다.

기존 `households`, `app_data`와 기존 Life 데이터는 migration SQL에서 삭제하지 않습니다.
