import {
  DEMO_RECEIPT_TEXT,
  OcrRecognizerUnavailableError,
  parseReceiptText,
  runReceiptOcr,
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
    const recognizer = jest.fn().mockRejectedValue(
      new Error('Native recognizer unavailable'),
    );

    await expect(
      runReceiptOcr({
        uri: 'file:///captured-receipt.jpg',
        width: 1440,
        height: 1920,
      }, undefined, recognizer),
    ).rejects.toBeInstanceOf(OcrRecognizerUnavailableError);
  });

  it('keeps the explicit demo fixture available only when supplied', () => {
    const result = parseReceiptText(DEMO_RECEIPT_TEXT, quality);

    expect(result.rawText).toContain('FL-20260621-1842');
    expect(result.fields.length).toBeGreaterThan(0);
  });

  it('parses actual PP-OCR text returned for a captured image', async () => {
    const recognizer = jest.fn().mockResolvedValue({
      fullText: DEMO_RECEIPT_TEXT,
      lines: [{ text: '주문번호 FL-20260621-1842' }],
      processingMs: 321,
    });

    const result = await runReceiptOcr({
      uri: 'file:///captured-receipt.jpg',
      width: 1440,
      height: 1920,
    }, undefined, recognizer);

    expect(recognizer).toHaveBeenCalledWith(
      'file:///captured-receipt.jpg',
    );
    expect(result.engine).toBe('ppocrv5');
    expect(result.processingMs).toBe(321);
    expect(result.rawText).toContain('FL-20260621-1842');
    expect(result.recognizedLines?.[0].text).toContain('주문번호');
  });
});
