# Routelo v2

**An Android-first delivery operations prototype that turns Korean paper
receipts into reviewable delivery records and practical visit sequences.**

Routelo v2 explores a problem that ordinary navigation apps do not solve:
delivery work begins before an address is opened in a map. Drivers must first
interpret receipts, identify strict deadlines and event times, correct
uncertain information, and decide which stop should come next.

This repository brings those steps into one local-first mobile workflow.

> **Current status:** active engineering prototype. The review UI, receipt
> normalization, record model, route-order heuristic, and Google Maps handoff
> are implemented. Native text recognition, road-traffic optimization,
> production storage, and several CRUD flows remain on the roadmap.

## Workflow

```text
Receipt image
  → capture-quality review
  → OCR candidate extraction
  → Korean field normalization
  → confidence-based human review
  → lossless local receipt record
  → delivery dashboard and deadline risk
  → suggested visit order
  → Google Maps navigation handoff
```

## Why This Project Is Different

Routelo v2 does not treat OCR output as trusted application data.

It preserves three layers:

- `raw`: original OCR evidence;
- `fields`: normalized delivery values;
- `unmapped`: text that could not be classified without silently discarding it.

Receipt labels are matched through normalized aliases, substring checks, and
Levenshtein similarity. User corrections can extend the alias registry so
future receipts from similar vendors become easier to process.

## Implemented Today

### Delivery operations

- Material Design 3 mobile dashboard
- Delivery status and schedule views
- Strict-deadline and event-time emphasis
- Nearest-neighbor visit-order prototype
- Google Maps Directions handoff
- Notification and operating-preference screens

### Receipt processing

- Camera and gallery input flow
- Capture-quality review UI
- Multiple preprocessing-candidate model
- Korean receipt field candidates
- Field-level and document-level confidence
- Editable review and alternative candidates
- Required-field validation before registration
- Lossless raw, normalized, and unmapped data model
- External JSON receipt storage
- Learnable label-alias registry

## Honest Capability Matrix

| Area | Status |
|---|---|
| Delivery dashboard and review UI | Implemented |
| Korean label normalization | Implemented |
| Receipt record and alias storage | Implemented |
| Nearest-neighbor visit ordering | Prototype |
| Google Maps navigation handoff | Implemented |
| Camera/gallery interaction | Implemented |
| Shared Android/iOS PP-OCRv5 recognition | Implemented |
| Road distance and live traffic optimization | Planned |
| Production database and encryption | Planned |
| Full delivery CRUD and completion evidence | In progress |

## Engineering Decisions

### Human review over silent automation

Low-confidence OCR fields are surfaced for review. Required fields must be
confirmed before a receipt becomes a delivery record.

### Local-first records

Receipt records are designed to remain useful without continuous network
access. Cloud OCR is planned only as a selective fallback for uncertain fields.

### Data preservation

Unmatched OCR text is retained instead of dropped. This supports debugging,
future parser improvements, and vendor-specific learning.

### Navigation handoff

The current app suggests a visit order and passes destinations to Google Maps.
It does not claim to calculate production-grade traffic-aware routes itself.

## Project Evolution

Routelo v2 integrates lessons from two earlier experiments:

```text
Routelo (February 2026)
  mobile destination entry, map interaction, nearest-neighbor ordering
       +
Flogg (February 2026)
  receipt capture, multimodal extraction, SQLite history
       ↓
Routelo v2 (June 2026)
  reviewable OCR records + delivery operations + route workflow
```

- [Routelo prototype](https://github.com/JasonLee0416/Routelo)
- [Flogg receipt prototype](https://github.com/JasonLee0416/Flogg)
- [Detailed evolution notes](docs/PROJECT_EVOLUTION.md)

The earlier repositories remain public as engineering artifacts. They show
which assumptions were tested, which limitations were discovered, and why the
current architecture changed.

## Technology

- Expo SDK 56
- React Native 0.85 and React 19
- TypeScript
- Material Design 3-inspired UI
- AsyncStorage for prototype state
- Expo FileSystem for OCR records
- Google Maps Directions URL integration

## Run Locally

The application source is under [`routelo/`](routelo).

```bash
cd routelo
npm install
npm start
```

Available scripts:

```bash
npm run android
npm run ios
npm run web
npm test
```

The current OCR service uses a demo recognition adapter. Native OCR requires an
Expo development build and is intentionally not represented as complete.

## Repository Structure

```text
routelo/
├─ app/index.tsx              screens and prototype application state
├─ app/models.ts              delivery domain types
├─ app/ocr/                   schema, normalization, aliases, storage
├─ app/services/maps.ts       distance, ordering, Maps handoff
├─ app/services/ocr.ts        capture checks and OCR adapter
└─ docs/OCR_PIPELINE.md       production OCR architecture
```

## Documentation

- [OCR architecture](routelo/docs/OCR_PIPELINE.md)
- [Project roadmap](todo.md)
- [Project evolution](docs/PROJECT_EVOLUTION.md)

## License

[MIT](routelo/LICENSE)
