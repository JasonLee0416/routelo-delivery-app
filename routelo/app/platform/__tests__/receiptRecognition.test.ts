import { receiptRecognitionCapability } from '../receiptRecognition';

describe('receiptRecognitionCapability', () => {
  test('uses ML Kit for the current Android production baseline', () => {
    expect(receiptRecognitionCapability('android')).toEqual({
      available: true,
      engine: 'mlkit',
    });
  });

  test('keeps iOS explicitly unavailable until its native adapter lands', () => {
    expect(receiptRecognitionCapability('ios')).toEqual({
      available: false,
      reason: 'iOS receipt recognition is not installed yet.',
    });
  });

  test('does not silently substitute OCR on web', () => {
    expect(receiptRecognitionCapability('web')).toEqual({
      available: false,
      reason: 'Receipt recognition is unavailable on web.',
    });
  });
});
