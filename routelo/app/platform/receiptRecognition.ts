import { Platform } from 'react-native';

export type ReceiptRecognitionLine = {
  text: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  cornerPoints?: Array<{ x: number; y: number }>;
};

export type ReceiptRecognitionResult = {
  fullText: string;
  lines: ReceiptRecognitionLine[];
  processingMs: number;
};

export type ReceiptRecognitionCapability = {
  available: boolean;
  engine?: 'mlkit';
  reason?: string;
};

export function receiptRecognitionCapability(
  platform: typeof Platform.OS,
): ReceiptRecognitionCapability {
  if (platform === 'android') {
    return { available: true, engine: 'mlkit' };
  }
  if (platform === 'ios') {
    return {
      available: false,
      reason: 'iOS receipt recognition is not installed yet.',
    };
  }
  return {
    available: false,
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

  // Native modules stay behind this capability boundary so shared workflows
  // never import an Android implementation directly.
  const { default: RouteloMlkitModule } = await import(
    '../../modules/routelo-mlkit/src/RouteloMlkitModule'
  );
  return RouteloMlkitModule.recognizeAsync(imageUri);
}
