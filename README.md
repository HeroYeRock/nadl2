# Nadl2

Nadl2는 "해외도 나들이처럼 쉽게"라는 컨셉의 모바일 여행 플래너입니다. 초보 여행자가 가고 싶은 장소만 고르면, 빈 시간대는 AI가 후보를 추천하고 사용자가 골라 일정에 넣는 흐름입니다.

## 현재 들어간 것

- Expo / React Native 앱 구조
- iOS 느낌의 홈 화면, 하단 탭바, Safe Area 여백
- 지역 구분: 국내, 일본, 중국, 대만, 미국
- 새 여행 만들기: 지역, 목적지, 기간, 테마, 출발일
- 여행 상세: 날짜 탭, 지도, 애플 지도 느낌의 핀, 타임라인
- 장소 추가: Google Places 프록시 검색
- AI 추천: cafe24 PHP 프록시를 통해 Groq 호출
- 이미지 저장과 공유 버튼
- cafe24 업로드용 `api/proxy.php`

## 설치

```bash
npm install
npx expo install --fix
npx expo start
```

공식 Expo 문서 기준으로 현재 최신 안정 SDK는 55이며, Expo SDK 패키지는 `npx expo install`로 맞추는 방식이 권장됩니다.

## 환경 변수

`.env`는 기본으로 `heroyerock.mycafe24.com` 프록시 주소를 가리키게 만들어 두었습니다.

```bash
EXPO_PUBLIC_PROXY_URL=https://heroyerock.mycafe24.com/AI_Trip/api/proxy.php
EXPO_PUBLIC_APP_TOKEN=change_this_token_to_match_api_proxy
EXPO_PUBLIC_GOOGLE_MAPS_KEY=
```

Google Maps SDK 키가 있으면 `EXPO_PUBLIC_GOOGLE_MAPS_KEY`에 넣으세요. Google Places 키와 Groq 키는 앱에 넣지 말고 `api/proxy.php` 또는 cafe24 환경 변수에서만 관리하는 구조입니다.

## cafe24 업로드

1. `api/config.local.example.php`를 `api/config.local.php`로 복사한 뒤 실제 키로 바꿉니다.

```php
define('GOOGLE_PLACES_KEY', '구글_플레이스_키');
define('GROQ_KEY', '그록_키');
define('APP_TOKEN', '앱_ENV와_같은_토큰');
```

2. cafe24 FTP에 아래 경로로 업로드합니다.

```text
www/AI_Trip/api/proxy.php
www/AI_Trip/api/config.local.php
```

3. 브라우저에서 확인합니다.

```text
https://heroyerock.mycafe24.com/AI_Trip/api/proxy.php?action=ping
```

앱 안 테스트 화면은 `/dev/test`입니다.
