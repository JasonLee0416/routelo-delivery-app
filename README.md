# RouteLO

꽃배달 기사를 위한 배달 관리 앱. **인수증 OCR 등록 → 동선 최적화 → 주유 손익 관리**를 하나로 묶은 로컬 우선(local-first) Expo 앱입니다.

> 앱 소스는 [`routelo/`](routelo) 하위에 있습니다. 아래 명령은 모두 `routelo/`에서 실행합니다.

## 주요 기능
- **배달 관리** — 오늘의 배달 목록, 대기/완료 필터, 예식·엄수 시간 우선 표시
- **인수증 OCR** — 촬영/갤러리 인수증에서 배달 정보 추출 (현재 온디바이스 데모 파이프라인)
- **동선 최적화** — 최근접 이웃 방문 순서 + Google Maps 길찾기(키 불필요 Directions URL)
- **주유 손익** — 일/주/월 수익·유류비·실측 연비, 주유·주행거리·차량 기록

## 기술 스택
- Expo SDK 56 · React Native 0.85 · React 19 · TypeScript (strict)
- Material Design 3 기반 UI, `@react-native-async-storage`(상태) + `expo-file-system`(OCR 레코드)

## 빠른 시작
```bash
cd routelo
npm install
npm run start      # Expo Dev Server (QR로 Expo Go 실행)
npm run ios        # iOS 시뮬레이터
npm run android    # Android 에뮬레이터
npm run web        # 웹
```

## 테스트
```bash
cd routelo
npm test           # OCR 정규화(app/ocr) 단위 테스트
```

## 프로젝트 구조
```
routelo/
├─ App.tsx                  # 루트 → app/index 의 RouteloApp
├─ app/
│  ├─ index.tsx             # 5개 탭 화면 + 상태/저장
│  ├─ data.ts               # 지역 목록·기본 설정·샘플 데이터
│  ├─ models.ts             # 도메인 타입
│  ├─ ocr/                  # 인수증 정규화·저장 (RN 비의존, 단위 테스트 가능)
│  │  ├─ normalize.ts       #   라벨→필드 휴리스틱 매핑 (별칭·퍼지·무손실)
│  │  ├─ fieldRegistry.ts   #   정규 필드 × 별칭 사전 (학습 가능)
│  │  ├─ schema.ts          #   raw / fields / unmapped 3층 레코드
│  │  └─ storage.ts         #   외부 JSON 파일 저장 + 별칭 학습
│  └─ services/
│     ├─ maps.ts            # 거리·동선·Google Maps 길찾기
│     └─ ocr.ts             # 촬영 품질 검사 + 필드 파싱 파이프라인
└─ docs/OCR_PIPELINE.md     # OCR 설계 문서
```

## OCR 파이프라인
현재 텍스트 인식은 **데모**(고정 텍스트)이고, 추출/정규화 로직은 실제 동작합니다.
- 설계: [`routelo/docs/OCR_PIPELINE.md`](routelo/docs/OCR_PIPELINE.md)
- 라벨 정규화/병합: [`routelo/app/ocr/`](routelo/app/ocr) — 인수증마다 다른 라벨명(예: 발주처/발주/발주자)을 추론 없이 휴리스틱으로 한 필드에 모으고, 매칭 실패분은 `unmapped`로 보존합니다.
- 온디바이스 실인식(ML Kit / PP-OCRv5)은 **Expo Dev Build**가 필요합니다(Expo Go 불가).

## 환경 변수
현재 필요 없음. 지도는 키 없는 Google Maps Directions URL을 쓰고, OCR은 온디바이스 데모입니다.

## 로드맵
완성 작업 목록은 [`todo.md`](todo.md)를 참고하세요.

## 라이선스
[`routelo/LICENSE`](routelo/LICENSE) 참조.
