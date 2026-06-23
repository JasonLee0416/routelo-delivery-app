import { Platform } from 'react-native';

import RouteloOnnxModule from '../../modules/my-module/src/RouteloOnnxModule';
import {
  OnnxModelInfo,
  OnnxSmokeResult,
  PpOcrRecognitionResult,
} from '../../modules/my-module/src/RouteloOnnx.types';

const SMOKE_MODEL_ASSET = 'models/mul_1.onnx';
const DETECTOR_MODEL_ASSET = 'models/ch_PP-OCRv5_det_mobile.onnx';
const RECOGNIZER_MODEL_ASSET = 'models/korean_PP-OCRv5_rec_mobile.onnx';

export type PpOcrRuntimeProbe = {
  available: boolean;
  detector?: OnnxModelInfo;
  recognizer?: OnnxModelInfo;
  smoke?: OnnxSmokeResult;
  error?: string;
};

export async function probePpOcrRuntime(): Promise<PpOcrRuntimeProbe> {
  if (Platform.OS !== 'android' || !RouteloOnnxModule.isAvailable()) {
    return {
      available: false,
      error: 'PP-OCR 진단은 Android 개발 빌드에서만 실행할 수 있습니다.',
    };
  }
  try {
    const [detector, recognizer, smoke] = await Promise.all([
      RouteloOnnxModule.inspectBundledModel(DETECTOR_MODEL_ASSET),
      RouteloOnnxModule.inspectBundledModel(RECOGNIZER_MODEL_ASSET),
      RouteloOnnxModule.runFloatModel(
        SMOKE_MODEL_ASSET,
        'X',
        [1, 1, 1, 1, 1, 1],
        [3, 2],
      ),
    ]);
    return { available: true, detector, recognizer, smoke };
  } catch (error) {
    return {
      available: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function recognizeReceiptWithPpOcr(
  imageUri: string,
): Promise<PpOcrRecognitionResult> {
  if (Platform.OS !== 'android' || !RouteloOnnxModule.isAvailable()) {
    throw new Error('PP-OCR recognition requires the Android development build.');
  }
  if (!imageUri.trim()) throw new Error('Receipt image URI is required.');
  return RouteloOnnxModule.recognizeReceipt(imageUri);
}
