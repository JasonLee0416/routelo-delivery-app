import { receiptRecognitionCapability } from '../receiptRecognition';

describe('receiptRecognitionCapability', () => {
  test('uses the same pinned PP-OCR model on Android', () => {
    expect(receiptRecognitionCapability('android')).toEqual({
      available: true,
      engine: 'ppocrv5',
      modelVersion: 'rapidocr-v3.8.0-ppocrv5',
    });
  });

  test('uses the same pinned PP-OCR model on iOS', () => {
    expect(receiptRecognitionCapability('ios')).toEqual({
      available: true,
      engine: 'ppocrv5',
      modelVersion: 'rapidocr-v3.8.0-ppocrv5',
    });
  });

  test('does not silently substitute OCR on web', () => {
    expect(receiptRecognitionCapability('web')).toEqual({
      available: false,
      engine: 'ppocrv5',
      modelVersion: 'rapidocr-v3.8.0-ppocrv5',
      reason: 'Receipt recognition is unavailable on web.',
    });
  });
});
