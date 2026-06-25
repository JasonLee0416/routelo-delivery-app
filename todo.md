# RouteLO 개발 로드맵

이 문서는 현재 `main` 브랜치의 실제 구현을 기준으로 완료된 기능과 다음 작업을 정리한다.

## 제품 방향

- Android 우선 배달 업무 관리 앱
- Material Design 3 기반 전문 물류 대시보드
- Google Maps 기반 방문 순서 길찾기
- 한국어 인수증 촬영 및 구조화 OCR
- 엄수 마감·예식 시간·지연 위험 우선 표시
- 로컬 우선 저장과 선택적 클라우드 OCR

## 현재 완료된 기능

### 운영 화면

- [x] 홈 대시보드
  - 오늘 전체·완료·남은 배달
  - 가장 가까운 엄수 마감 및 예식 시간
  - 업무 진행률과 남은 예상 거리
- [x] 배달 목록
  - 배달 상태, 도착 예정, 엄수 마감, 예식 시간
  - 배송 상세 바텀시트
- [x] 경로 최적화
  - Nearest Neighbor 기반 추천 방문 순서
  - 현재 위치와 목적지 번호 표시
  - 목적지 사이 직선 및 방향 화살표
- [x] 알림 화면
  - 긴급 마감, 예식 시간, 지연 위험, 경로 변경
- [x] 설정 화면
  - 알림과 경로 선호 설정 UI
- [x] Material Design 3 하단 내비게이션

### Google Maps

- [x] 지도 연동을 Google Maps 기준으로 통일
- [x] API 키가 필요 없는 Google Maps Directions URL 적용
- [x] 추천 방문 순서대로 경유지 전달
- [x] 자동차 길찾기 모드 연결

현재 지도 영역은 앱 내부 경로 요약 시각화이고, 실제 도로 경로와 교통 정보는 Google Maps 앱 또는 웹에서 제공한다.

### OCR 파이프라인

- [x] 카메라 및 갤러리 인수증 입력
- [x] 촬영 품질 검사 UI
  - 선명도
  - 밝기
  - 문서 영역
  - 기울기
  - 그림자
- [x] 6개 이미지 전처리 후보 비교 구조
- [x] 한국어 필드 후보 추출
  - 배송 날짜
  - 배달 엄수 시간
  - 예식 시간
  - 상호명·예식장명
  - 배송 주소
  - 수령자·담당자
  - 연락처
  - 주문번호
  - 요청사항
- [x] 필드별 신뢰도와 문서 전체 신뢰도
- [x] 필드 수정 및 대체 후보 선택 UI
- [x] 필수값 확인 후 배달 목록 등록
- [x] 원문·정규화 필드·미매핑 데이터 무손실 보존 모델
- [x] 라벨 별칭 정규화
  - 정확 일치
  - 부분 일치
  - Levenshtein 유사도
- [x] OCR 레코드 JSON 외부 저장 모듈
- [x] 사용자 수정 라벨의 별칭 학습 모듈

자세한 OCR 설계는 [`routelo/docs/OCR_PIPELINE.md`](routelo/docs/OCR_PIPELINE.md)를 참조한다.

## P0 — 실제 서비스 연동

### Android 네이티브 OCR

- [ ] Expo Development Build 구성
- [x] Android/iOS 공용 PP-OCRv5 온디바이스 인식 경로 연결
- [ ] OCR 블록·라인·단어 위치와 confidence 수집
- [ ] 문서 영역 자동 감지 및 원근 보정
- [ ] 실제 이미지 전처리 구현
  - 밝기 보정
  - CLAHE 대비 강화
  - deskew
  - adaptive threshold
  - denoise 및 sharpening
- [ ] 낮은 신뢰도 문서의 2차 OCR 연결
  - Google Cloud Vision 또는 Naver CLOVA OCR
- [ ] OCR 검수 화면에서 원본 bounding box 하이라이트

현재 `app/services/ocr.ts`는 파이프라인과 검수 UI를 검증하기 위한 데모 어댑터다. 실제 엔진은 동일 인터페이스로 교체한다.

### 주소와 지도

- [ ] Google 주소 검색 또는 Geocoding 결과를 이용한 주소 검증
- [ ] 주소 후보가 여러 개인 경우 사용자 선택 UI
- [ ] 현재 위치 권한 및 실제 GPS 좌표 연결
- [ ] Google Maps 실행 실패 시 웹 URL fallback
- [ ] 도로 주행거리 및 예상시간 결과 저장
- [ ] 교통 상황 기반 방문 순서 재계산

Google Maps API 키를 앱에 직접 노출하지 않는다. 서버 API가 필요한 기능은 백엔드 프록시 또는 Android 제한 키를 사용한다.

## P1 — OCR 통합 및 학습

- [ ] `app/services/ocr.ts` 후보 결과와 `app/ocr/normalize.ts` 정규화 모듈 통합
- [ ] 검수 완료 시 `ReceiptRecord` 생성 및 `saveReceipt()` 호출
- [ ] 촬영 원본 이미지 URI와 이미지 해시 저장
- [ ] 사용자가 수정한 필드의 변경 전·후 이력 저장
- [ ] 미매핑 라벨을 특정 필드에 연결하는 별칭 학습 UI
- [ ] 업체·예식장별 문서 양식 fingerprint
- [ ] 중복 인수증 이미지 해시 검사
- [ ] 전화번호·주소 correction 데이터 익명화 및 암호화

## P1 — 배달 업무 기능

- [ ] 배달 생성·수정·삭제 전체 CRUD
- [ ] 완료 처리 시 완료 시간 및 사진 저장
- [ ] 화원·수령인 전화 버튼과 연락 기록
- [ ] 배송 사진 첨부 및 확인
- [ ] 엄수 마감·예식 시간 로컬 푸시 알림
- [ ] 예상 도착 지연 계산
- [ ] 배달 검색, 날짜 필터, 상태 필터
- [ ] 오프라인 변경사항 동기화

## P2 — 주유 및 손익

- [ ] 일일 계기판 기록 수정·삭제
- [ ] 주유 기록 수정·삭제
- [ ] 실제 배달 완료 수익과 기간별 주유비 연결
- [ ] 일간·주간·월간 손익 그래프
- [ ] 음수 손익률을 그대로 표시
- [ ] 차량별 연료탱크 및 주유 기록 분리

## P2 — 데이터 계층

- [ ] AsyncStorage 임시 상태를 정식 로컬 DB로 이전
- [ ] Android Native: Room DB 검토
- [ ] React Native 유지 시 SQLite 또는 WatermelonDB 검토
- [ ] 권장 테이블
  - delivery_receipts
  - ocr_raw_results
  - extracted_fields
  - field_candidates
  - user_corrections
  - receipt_templates
  - address_candidates
- [ ] 이미지·개인정보 암호화
- [ ] 백업 및 내보내기

## P3 — 코드 구조와 품질

- [ ] `app/index.tsx` 화면별 분리
  - screens
  - components
  - hooks
  - stores
  - services
- [ ] OCR 정규화 단위 테스트
- [ ] 시간·날짜·전화번호·주소 파서 테스트
- [ ] 경로 최적화 테스트
- [ ] React Native 화면 테스트
- [ ] CI에서 TypeScript, Expo Doctor, 테스트 자동 실행
- [ ] README에 설치·개발 빌드·Google Maps 연동 방법 작성
- [ ] Android 실기기 성능 및 메모리 테스트

## 공동 개발 규칙

1. 작업 전에 GitHub Issue를 작성하고 담당자를 지정한다.
2. 최신 `main`에서 기능 브랜치를 생성한다.
3. 한 PR은 한 기능 또는 한 문제만 다룬다.
4. 다른 미병합 브랜치에 의존하는 stacked PR은 최소화한다.
5. PR에 변경 이유, 테스트 방법, 화면 캡처, 충돌 가능 파일을 작성한다.
6. TypeScript와 Expo Doctor 통과 후 리뷰를 요청한다.
7. 승인된 PR만 `main`에 병합한다.
8. 병합 후 기능 브랜치를 삭제하고 관련 Issue를 닫는다.

## 권장 다음 작업 순서

1. PP-OCR 실제 영수증 정확도 및 저사양 물리기기 벤치마크
2. Park의 정규화·저장 모듈을 현재 OCR 검수 흐름에 연결
3. Google 주소 검증 및 GPS 연결
4. 배달 CRUD와 완료 사진 저장
5. 로컬 푸시 알림
6. DB 이전과 개인정보 암호화
7. 테스트 및 CI 구축
