# Nadl2 배포 가이드 (Supabase + Vercel)

이 문서는 cafe24 PHP 프록시 → **Supabase Edge Functions** + **Vercel 웹 호스팅** 마이그레이션을 위한 절차입니다.

---

## 1. Supabase 프로젝트 준비

### 1-1. SQL 마이그레이션 적용
Supabase Dashboard → SQL Editor 에서 `supabase/migrations/0001_init.sql` 의 내용을 통째로 실행.
- `profiles` 테이블 (auth.users 1:1 보강)
- `trips` 테이블 (days jsonb로 통째 저장)
- RLS 정책 (본인 데이터만)
- 신규 가입 시 profile 자동 생성 트리거

### 1-2. Auth 설정
Dashboard → Authentication → Providers
- **Email** 활성 (필수)
- 테스트 단계라면 Authentication → Settings → "Confirm email" OFF 추천 (가입 즉시 로그인 가능)

### 1-3. Edge Functions 환경변수
Dashboard → Project Settings → Edge Functions → Secrets 에 등록:

| Key | Value |
|---|---|
| `GOOGLE_PLACES_KEY` | (기존 cafe24 `config.local.php` 값) |
| `GROQ_KEY` | (기존 Groq 키) |
| `GROQ_MODEL` | `openai/gpt-oss-20b` |

CLI로 한 번에:
```bash
supabase secrets set GOOGLE_PLACES_KEY=xxx GROQ_KEY=xxx GROQ_MODEL=openai/gpt-oss-20b
```

> ⚠️ Llama 3.1 8B Instant 는 2026-08-16 종료 예정 → `openai/gpt-oss-20b` (Groq) 로 교체.
> 모델 변경은 시크릿(`GROQ_MODEL`) 갱신 + Edge Functions 재배포가 모두 필요합니다.

### 1-4. Edge Functions 배포
프로젝트 루트에서:
```bash
# Supabase CLI 설치 (한 번만)
brew install supabase/tap/supabase

# 프로젝트 링크 (한 번만)
supabase link --project-ref <YOUR-PROJECT-REF>

# 6개 함수 배포
supabase functions deploy places-autocomplete
supabase functions deploy place-detail
supabase functions deploy places-nearby
supabase functions deploy places-textsearch
supabase functions deploy places-photo
supabase functions deploy ai-recommend
```

> 모든 함수는 `verify_jwt = true` (config.toml). 즉 Supabase 로그인 토큰이 있는 클라이언트만 호출 가능.

---

## 2. 앱 환경변수

`.env` 파일에 Supabase 값 입력:

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR...
```

> anon key는 공개되어도 안전한 값 (RLS가 데이터 보호).

---

## 3. 로컬 테스트

```bash
npm install
npm run web
```

브라우저에서 로그인 → 일정 생성 → Supabase Dashboard → Table Editor → `trips` 에서 행 추가되는지 확인.

---

## 4. Vercel 배포

### 4-1. Vercel 프로젝트 생성
- vercel.com → Add New → Project → Import Git Repository
- 또는 CLI:
  ```bash
  npm i -g vercel
  vercel
  ```

### 4-2. Vercel 환경변수
Project Settings → Environment Variables 에 추가 (Production + Preview):

| Key | Value |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://YOUR-PROJECT.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | (anon key) |

### 4-3. 빌드 설정
`vercel.json` 에 이미 들어가 있음:
- Build Command: `npx expo export -p web --output-dir dist`
- Output Directory: `dist`
- SPA 라우팅을 위한 rewrites 포함

---

## 5. 동작 확인 체크리스트

- [ ] 회원가입 → profile 행 자동 생성됨 (`profiles` 테이블)
- [ ] 일정 생성 → `trips` 테이블에 저장됨
- [ ] 로그아웃 → 로컬 trip 캐시 사라지고 로그인 화면으로
- [ ] 다른 기기 로그인 → 일정 sync 됨
- [ ] 장소 검색 (Google Places autocomplete) 동작
- [ ] AI 추천 (Groq) 동작
- [ ] 사진 표시 (places-photo) 동작

---

## 6. 네이티브 앱 빌드 (나중에)

```bash
npx eas build --platform ios
npx eas build --platform android
```

Supabase URL/anon key는 EAS Build 시점에 `.env` 가 그대로 번들됨.
