# RouteLO 완성 TODO

공동 작업 레포 → 작은 단위로 PR 분리. 한 번에 하나씩.

## 온디바이스 OCR 내장 (3-PR 분할)
엔진: PP-OCRv5 mobile (PaddleOCR 계열) ONNX, onnxruntime-react-native. Expo dev build 필요.

- [x] **PR1 — 스키마/정규화/저장 (순수 TS)** `app/ocr/`
  - schema, fieldRegistry(별칭사전), normalize(휴리스틱 병합), storage(expo-file-system/legacy), buildRecord
  - 유사 라벨 병합 + 무손실(raw/unmapped 보존) 검증 완료 (20/20)
- [ ] **PR2 — OCR 엔진 내장** onnxruntime-react-native + PP-OCRv5 ONNX 모델 + dev build 설정
- [ ] **PR3 — 연결** OCR 출력 → normalize → OcrScreen 폼, 가짜 setTimeout 제거, 인수증 이미지 저장

## P0 — 핵심 기능이 목(mock)
- [ ] Kakao 지오코딩 실연동 (`geocodeAddress` 가짜 좌표) — `services/kakao.ts`
- [ ] 실거리 계산 (등록 시 주소 길이 기반 가짜 distanceKm) — `index.tsx`

## P1 — 버그 / 죽은 코드
- [ ] 전화 걸기 버튼 무반응 → `Linking.openURL('tel:')`
- [ ] 촬영 인수증 이미지가 버려짐 (`registerOcr`가 imageUri 미수신)
- [ ] 동선 화면 `optimized` 죽은 코드 (false 분기 도달 불가)
- [ ] 장식용 무반응 버튼 (프로필, 내 위치 등)

## P2 — 빠진 기본 기능
- [ ] 배달 삭제/수정
- [ ] 주유·주행 기록 삭제
- [ ] 주소 → 카카오맵 길찾기 연동
- [ ] 손익률이 적자(음수)를 0%로 숨김 — `index.tsx:829`

## P3 — 위생
- [ ] README (빌드/실행/환경변수)
- [ ] 테스트 (testID는 있으나 테스트 0개)
- [ ] 2352줄 단일 파일 → 화면별 분리
- [ ] 56개 지역 수수료 설정 검색/접기
