# WITH ME Life v0.1.0

기존 육아 중심 WITH ME를 개인 생활 관리 앱으로 리빌드한 첫 버전입니다.

## 핵심 기능
- 식재료 마스터: 단위와 열량 기준값 관리
- 사용량 기록: `오늘 2개` 또는 `300g을 5일 사용` 방식 지원
- 구매 일지: 구매처, 구매량, 금액을 기록하고 단가 자동 계산
- 월 예상 식비: 실제 사용 속도 × 최근 구매 단가 × 30일
- 레시피: 재료별 사용량을 합산해 원가와 kcal 자동 계산
- 체중 변화: 날짜별 기록과 간단한 추세 그래프

## Supabase 준비
1. 기존 Supabase 프로젝트는 그대로 사용합니다.
2. Supabase SQL Editor에서 `supabase/setup_v0.1.sql`을 한 번 실행합니다.
3. 기존 `.env.local`의 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`를 그대로 사용합니다.
4. 기존 `households`, `app_data`는 이 버전에서 사용하지 않으며 SQL도 삭제하지 않습니다.

새 테이블이 아직 없으면 앱은 로컬 모드로 열리고 브라우저 localStorage에 저장합니다. SQL 실행 후 로그인하면 클라우드 테이블을 사용합니다.

## 실행
```bash
npm install
npm run dev
```

## 빌드
```bash
npm run build
```
