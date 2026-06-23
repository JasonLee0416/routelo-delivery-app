# PP-OCRv5 Android Compatibility Spike

This branch tests how far RouteLO can adopt PP-OCRv5 without destabilizing
`main`.

## Confirmed working

- Expo SDK 56 local native module autolinking
- React Native 0.85 New Architecture build
- Gradle 9.3.1
- Direct `onnxruntime-android:1.25.1` dependency
- Kotlin compilation and full Android debug APK assembly
- Four Android ABIs packaged: arm64-v8a, armeabi-v7a, x86, and x86_64
- Bundled ONNX model loading and generic float-tensor inference
- Web-safe fallback module and engine-neutral OCR result contract
- Captured image URI passed into the OCR service
- Android bitmap decoding and EXIF rotation correction
- Detector resize, normalization, and probability-map inference
- Adaptive row-projection box extraction
- Recognition crop normalization
- Korean dictionary CTC decoding
- Original-image bounding boxes and reused model sessions
- Minimum-length and confidence gates that reject uncertain output

The direct Android dependency avoids the Gradle and React Native autolinking
problems reproduced with `onnxruntime-react-native@1.24.3`.

## Bundled models

The spike pins models from the RapidOCR v3.8.0 model registry.

| Asset | SHA-256 |
|---|---|
| `ch_PP-OCRv5_det_mobile.onnx` | `4d97c44a20d30a81aad087d6a396b08f786c4635742afc391f6621f5c6ae78ae` |
| `korean_PP-OCRv5_rec_mobile.onnx` | `cd6e2ea50f6943ca7271eb8c56a877a5a90720b7047fe9c41a2e541a25773c9b` |
| `ppocrv5_korean_dict.txt` | `a88071c68c01707489baa79ebe0405b7beb5cca229f4fc94cc3ef992328802d7` |

A small ONNX multiplication model from the official ONNX Runtime test data is
included to verify session creation and tensor execution independently from
the OCR pipeline.

## Android diagnostic

In a development Android build, open Settings > OCR Lab and tap
`PP-OCRv5 runtime diagnostic`. The diagnostic creates both OCR sessions,
reports model metadata, runs the multiplication smoke model, and reports
native processing time. Development builds also expose a fixed-fixture
recognition action. These controls are not rendered on web.

## Emulator experiment on 2026-06-23

Environment:

- Android API 35 x86_64 emulator
- repository fixture `KakaoTalk_20260621_070828835_01.jpg`
- detector input `960 x 1280`
- detector output `1 x 1 x 1280 x 960`
- detector probability range `0.0..1.0`
- native processing time approximately `2.3 seconds`

The native pipeline runs without a crash or out-of-memory condition. The
detector produces a high-confidence region, but the current row-projection
approximation does not yet reproduce PaddleOCR's reference DB contour,
polygon-unclip, and perspective-transform post-processing. The recognizer
returned a two-character noise result for the selected region. RouteLO rejects
that result through the minimum-length/confidence gate and returns no lines,
so experimental PP-OCR output cannot fabricate delivery fields.

This is a runtime success but not an accuracy success. ML Kit remains the
default Android recognizer.

## Remaining production gate

- Port reference DB contour extraction and polygon unclip
- Perspective-correct each quadrilateral before recognition
- Batch recognition crops
- Add cancellation, timeout, and memory-pressure handling
- Run the same eight-image dataset through ML Kit and PP-OCR
- Measure required-field accuracy, latency, memory, and APK/AAB size
- Validate on at least one physical lower-end Android device

## Build environment

Keep caches, the Android SDK, and build outputs on the D drive:

```powershell
$env:GRADLE_USER_HOME='D:\zxhu12\dev-cache\gradle'
$env:npm_config_cache='D:\zxhu12\dev-cache\npm'
$env:ANDROID_HOME='D:\zxhu12\Android\Sdk'
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'

npx expo prebuild --platform android --clean --no-install
cd android
.\gradlew.bat :app:assembleDebug
```

The resulting debug APK is approximately 306.5 MB because it contains four
ONNX Runtime ABIs and both OCR models. Production packaging must use ABI splits
or an Android App Bundle before rollout.

## Next safe milestone

Replace `projectedLineBoxes()` with a reference-derived DB post-processor,
then rerun the single-fixture experiment. Do not enable PP-OCR as a selectable
production engine until that output passes the shared zero-fabrication and
ground-truth benchmark gates.
