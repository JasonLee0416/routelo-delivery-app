import { Platform } from 'react-native';

import {
  PP_OCR_MODEL_VERSION,
} from '../ocr/ppocr/modelManifest';
import type { PpOcrResult } from '../ocr/ppocr/types';

export type ReceiptRecognitionResult = PpOcrResult;

export type ReceiptRecognitionCapability = {
  available: boolean;
  engine: 'ppocrv5';
  modelVersion: string;
  reason?: string;
};

export function receiptRecognitionCapability(
  platform: typeof Platform.OS,
): ReceiptRecognitionCapability {
  if (platform === 'android' || platform === 'ios') {
    return {
      available: true,
      engine: 'ppocrv5',
      modelVersion: PP_OCR_MODEL_VERSION,
    };
  }
  return {
    available: false,
    engine: 'ppocrv5',
    modelVersion: PP_OCR_MODEL_VERSION,
    reason: `Receipt recognition is unavailable on ${platform}.`,
  };
}

export async function recognizeReceipt(
  imageUri: string,
): Promise<ReceiptRecognitionResult> {
  if (!imageUri.trim()) {
    throw new Error('A captured receipt image URI is required.');
  }

  const capability = receiptRecognitionCapability(Platform.OS);
  if (!capability.available) {
    throw new Error(capability.reason);
  }

  const { recognizeReceiptWithPpOcr } = await import('../ocr/ppocr/runtime');
  return recognizeReceiptWithPpOcr(imageUri);
}
