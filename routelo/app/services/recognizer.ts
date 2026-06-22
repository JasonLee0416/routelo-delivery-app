import { Platform } from 'react-native';

import RouteloMlkitModule from '../../modules/routelo-mlkit/src/RouteloMlkitModule';
import { MlKitRecognitionResult } from '../../modules/routelo-mlkit/src/RouteloMlkit.types';

export async function recognizeReceiptWithMlKit(
  imageUri: string,
): Promise<MlKitRecognitionResult> {
  if (Platform.OS !== 'android') {
    throw new Error('ML Kit receipt recognition is available on Android only.');
  }
  if (!imageUri.trim()) {
    throw new Error('A captured receipt image URI is required.');
  }

  return RouteloMlkitModule.recognizeAsync(imageUri);
}
