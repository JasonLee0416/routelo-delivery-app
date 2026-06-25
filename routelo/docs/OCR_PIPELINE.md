# RouteLO OCR Pipeline

> Current architecture as of 2026-06-24: RouteLO uses one pinned PP-OCRv5
> detector and Korean recognizer through the shared ONNX Runtime React Native
> path on Android and iOS. References to ML Kit below describe the superseded
> baseline and are retained only for historical benchmark context. The current
> decision is recorded in `docs/adr/0001-ppocr-single-engine.md`.

## 1. Recommended architecture

```text
CameraX / Expo camera
  → capture quality gate
  → document detection and perspective correction
  → six preprocessing variants
  → on-device OCR (Google ML Kit)
  → block/line/word spatial analysis
  → Korean field candidate extraction
  → confidence scoring and cross-field validation
  → low-confidence cloud fallback (CLOVA OCR or Cloud Vision)
  → field-level result merge
  → user review
  → encrypted local storage and correction feedback
```

The production Android build should use Google ML Kit Korean text recognition as the fast first pass. Only documents or required fields below the confidence threshold should be sent to a server OCR provider. This keeps common scans fast, inexpensive, and available offline.

## 2. Capture quality gate

OCR must not start when a required quality condition fails.

- Blur: Laplacian variance or ML-based sharpness score.
- Brightness: mean luminance and clipped black/white pixel ratio.
- Shadow: local illumination variance across document quadrants.
- Coverage: detected document polygon relative to the camera frame.
- Cropping: polygon points touching the frame boundary.
- Skew: document edge angles and text baseline angle.
- Resolution: effective character height and document pixel area.

Suggested automatic capture conditions:

- document coverage 65–92%
- all four corners visible
- blur score at least 70
- brightness score at least 65
- skew under 8 degrees
- stable device motion for 400–600 ms

## 3. Preprocessing variants

Preserve the original image and generate independent OCR candidates:

1. original crop
2. illumination-corrected image
3. CLAHE contrast image
4. perspective and deskew corrected image
5. adaptive-threshold image
6. denoised and sharpened image

Do not select a single image globally. Select the best OCR block or field candidate across variants. Avoid aggressive binarization when thin Korean strokes disappear.

## 4. OCR engines

| Engine | Korean | Offline | Cost | Recommended role |
|---|---:|---:|---:|---|
| Google ML Kit | good | yes | free | primary mobile OCR |
| Tesseract | medium | yes | free | optional offline fallback |
| Google Cloud Vision | very good | no | paid | low-confidence retry |
| Naver CLOVA OCR | very good | no | paid | Korean form/template retry |
| Other cloud OCR | varies | no | paid | provider-specific fallback |

For production, replace the demo engine adapter in `app/services/ocr.ts` with:

- Android native development build: ML Kit block/line/element results.
- Server fallback: CLOVA OCR or Cloud Vision when document confidence is below 72 or a required field is below 60.

## 5. Candidate scoring

Each field receives a 0–100 score.

```text
score =
  OCR confidence × 0.20
  + regex validity (0–20)
  + keyword proximity (0–25)
  + document position (0–10)
  + cross-field consistency (0–15)
  + external validation (0–20)
  - ambiguity penalty (0–20)
  - logical error penalty (0–40)
```

- 85–100: confirmed automatically
- 60–84: user review
- 40–59: strong warning
- below 40: do not auto-fill

Document confidence is the weighted average of required fields, with the lowest required-field score receiving extra weight.

## 6. Field extraction rules

- Strict deadline: nearest time to 배달 엄수, 도착, 배송, 납품, 마감, 까지.
- Event time: nearest time to 예식, 본식, 웨딩, 행사, 예약 시간.
- Date: nearest date to 배송일, 배달일, 납품일, 예식일; infer current year when absent.
- Phone: normalize mobile and landline formats; prioritize 수령자/담당자 context.
- Address: detect Korean administrative and road-name tokens, then validate with a map/address search provider.
- Venue: prioritize large top-area text and 예식장, 웨딩, 컨벤션, 호텔, 홀, 센터 keywords.
- Recipient: prioritize 수령자, 담당자, 인수자, 받는 분, 고객명.
- Order number: prioritize 주문번호, 접수번호, 관리번호, No., Order, Code and exclude dates/phones.
- Memo: collect text following 특이사항, 요청사항, 메모, 주의, 비고, 전달사항 until the next field.

Logical validation should normally enforce `strict deadline < event time`.

## 7. Review UI

The implemented review flow uses:

- green check for 85+
- amber review state for 60–84
- red warning for below 60 or missing values
- original source text under every field
- alternative candidate chips
- editable inputs
- required-field validation before save

Production native builds should additionally draw OCR bounding boxes over the source image and zoom to a field's source box when tapped.

## 8. Database tables

- `delivery_receipts`: receipt metadata, image hashes, status, created time.
- `ocr_raw_results`: engine, variant, raw blocks, confidence, processing time.
- `extracted_fields`: selected value, confidence, validation status.
- `field_candidates`: all candidate values, bounding boxes, evidence scores.
- `user_corrections`: predicted value, corrected value, anonymized context.
- `receipt_templates`: vendor/template fingerprint and learned field regions.
- `address_candidates`: OCR address, normalized address, coordinates, validation score.

Relations: one receipt has many raw results, extracted fields, candidates, corrections, and address candidates. Templates are associated by vendor and visual fingerprint.

## 9. Privacy and learning

- Encrypt receipt images and structured personal data at rest.
- Hash or tokenize phone numbers and addresses in correction analytics.
- Store bounding boxes and keyword features without retaining full sensitive text when possible.
- Learn vendor-specific label aliases and approximate field regions.
- Require explicit retention and cloud-upload consent.

## 10. MVP priority

1. capture quality gate
2. ML Kit first-pass OCR
3. Korean regex/context parser
4. confidence review UI
5. required-field validation
6. address candidate validation
7. low-confidence cloud fallback
8. encrypted correction feedback and template learning
