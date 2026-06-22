import {
  DEMO_RECEIPT_TEXT,
  OcrRecognizerUnavailableError,
  parseReceiptText,
  runHybridOcr,
} from '../ocr';

const quality = {
  score: 90,
  blur: 90,
  brightness: 90,
  documentCoverage: 90,
  skew: 90,
  shadow: 90,
  passed: true,
  messages: [],
};

describe('OCR zero-fabrication guard', () => {
  it('rejects a real capture when no recognizer text exists', async () => {
    await expect(
      runHybridOcr({
        uri: 'file:///captured-receipt.jpg',
        width: 1440,
        height: 1920,
      }),
    ).rejects.toBeInstanceOf(OcrRecognizerUnavailableError);
  });

  it('keeps the explicit demo fixture available only when supplied', () => {
    const result = parseReceiptText(DEMO_RECEIPT_TEXT, quality);

    expect(result.rawText).toContain('FL-20260621-1842');
    expect(result.fields.length).toBeGreaterThan(0);
  });
});
