import { CaptureQuality, OcrFieldKey, OcrFieldResult, OcrPipelineResult } from '../models';
import { DEFAULT_FIELD_REGISTRY } from '../ocr/fieldRegistry';
import { normalizeReceipt } from '../ocr/normalize';

type ImageAssetInfo = {
  width?: number;
  height?: number;
  fileSize?: number;
};

const LABELS: Record<OcrFieldKey, string> = {
  deliveryDate: '배송 날짜',
  strictTime: '배달 엄수 시간',
  eventTime: '예식 시간',
  venueName: '상호명 / 예식장명',
  deliveryAddress: '배송 주소',
  recipientName: '수령자 / 담당자',
  recipientTel: '연락처',
  orderNumber: '주문번호',
  memo: '특이사항 / 메모',
};

const REQUIRED = new Set<OcrFieldKey>([
  'deliveryDate',
  'strictTime',
  'venueName',
  'deliveryAddress',
  'recipientTel',
]);

export const DEMO_RECEIPT_TEXT = `
배송 인수증
주문번호 FL-20260621-1842
배송일자 2026.06.21
업체명 더채플앳청담
배송주소 서울 강남구 선릉로 757 더채플앳청담 3층
받는 분 김민준 실장
연락처 010-4821-7732
배달 엄수 10:30까지
예식 시간 오전 11시
상품 축하 3단 화환 2개
요청사항 예식 시작 30분 전 설치 완료, 설치 후 사진 전송
`;

const normalizeTime = (value: string) => {
  const compact = value.replace(/\s/g, '');
  const colon = compact.match(/(\d{1,2}):(\d{2})/);
  if (colon) return `${colon[1].padStart(2, '0')}:${colon[2]}`;
  const korean = compact.match(/(오전|오후)?(\d{1,2})시(?:(\d{1,2})분)?/);
  if (!korean) return value;
  let hour = Number(korean[2]);
  if (korean[1] === '오후' && hour < 12) hour += 12;
  if (korean[1] === '오전' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${String(Number(korean[3] || 0)).padStart(2, '0')}`;
};

const normalizePhone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('010') && digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.startsWith('02') && (digits.length === 9 || digits.length === 10)) {
    return `${digits.slice(0, 2)}-${digits.slice(2, -4)}-${digits.slice(-4)}`;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, -4)}-${digits.slice(-4)}`;
  }
  return value;
};

const candidates = (text: string, pattern: RegExp) =>
  [...text.matchAll(pattern)].map((match) => match[0]);

function field(
  key: OcrFieldKey,
  value: string,
  confidence: number,
  sourceText: string,
  alternatives: string[] = [],
): OcrFieldResult {
  const required = REQUIRED.has(key);
  const status = !value
    ? 'missing'
    : confidence >= 85
      ? 'confirmed'
      : confidence >= 60
        ? 'review'
        : 'warning';
  return {
    key,
    label: LABELS[key],
    value,
    confidence: value ? confidence : 0,
    required,
    sourceText,
    alternatives,
    status,
  };
}

export function inspectCaptureQuality(asset: ImageAssetInfo): CaptureQuality {
  const width = asset.width || 1200;
  const height = asset.height || 1600;
  const pixels = width * height;
  const coverage = Math.min(98, Math.max(52, (Math.min(width, height) / Math.max(width, height)) * 145));
  const resolutionScore = Math.min(100, pixels / 18000);
  const blur = Math.round(Math.min(96, 62 + resolutionScore * 0.34));
  const brightness = 82;
  const skew = 93;
  const shadow = 87;
  const score = Math.round((blur + brightness + coverage + skew + shadow) / 5);
  const messages: string[] = [];
  if (blur < 65) messages.push('사진이 흔들렸습니다. 다시 촬영해주세요.');
  if (brightness < 60) messages.push('인수증이 너무 어둡습니다. 밝은 곳에서 촬영해주세요.');
  if (coverage < 60) messages.push('인수증 전체가 화면에 들어오도록 맞춰주세요.');
  if (pixels < 900000) messages.push('글자가 너무 작습니다. 조금 더 가까이 촬영해주세요.');
  return {
    score,
    blur,
    brightness,
    documentCoverage: Math.round(coverage),
    skew,
    shadow,
    passed: score >= 65 && messages.length === 0,
    messages,
  };
}

export function parseReceiptText(rawText: string, quality: CaptureQuality): OcrPipelineResult {
  const started = Date.now();
  const text = rawText.replace(/[ \t]+/g, ' ').trim();
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  // 라벨→필드 매핑은 app/ocr 의 정규화 백본에 위임한다.
  // (별칭 사전 + 퍼지 매칭 + 무손실 unmapped 보존)
  const { fields: mapped, unmapped } = normalizeReceipt(lines, DEFAULT_FIELD_REGISTRY);

  // 값 후처리(시간/전화/날짜 정규화·대안값·신뢰도)는 기존 로직을 그대로 유지한다.
  const timeRe = /(?:오전|오후)?\s*\d{1,2}(?::\d{2}|시(?:\s*\d{1,2}분)?)/;
  const extractTime = (value: string) => value.match(timeRe)?.[0] || value;
  const timeMatches = candidates(
    text,
    /(?:오전|오후)?\s*\d{1,2}(?::\d{2}|시(?:\s*\d{1,2}분)?)(?:까지)?/g,
  );
  const phoneMatches = candidates(
    text,
    /(?:01[016789][-\s]?\d{3,4}[-\s]?\d{4}|0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4})/g,
  );

  const normalizedDate = (
    mapped.deliveryDate?.match(/20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}/)?.[0] ||
    text.match(/20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}/)?.[0] ||
    ''
  ).replace(/[./]/g, '-');
  const strictTime = mapped.strictTime ? normalizeTime(extractTime(mapped.strictTime)) : '';
  const eventTime = mapped.eventTime ? normalizeTime(extractTime(mapped.eventTime)) : '';
  const phone = normalizePhone(mapped.recipientTel || phoneMatches[0] || '');
  const venue = mapped.venueName || '';
  const address = mapped.deliveryAddress || '';
  const recipient = (mapped.recipientName || '').replace(/\s*(실장|팀장|담당자)$/, ' $1');
  const orderNumber =
    mapped.orderNumber?.match(/[A-Z]{1,5}[-\d]{5,}/i)?.[0] || mapped.orderNumber || '';
  const memo = mapped.memo || '';

  const logicalTimeBonus =
    strictTime && eventTime && strictTime < eventTime ? 8 : strictTime && eventTime ? -18 : 0;

  const fields = [
    field('deliveryDate', normalizedDate, mapped.deliveryDate ? 94 : 70, mapped.deliveryDate || ''),
    field(
      'strictTime',
      strictTime,
      Math.max(45, 89 + logicalTimeBonus),
      mapped.strictTime || '',
      timeMatches.map(normalizeTime).filter((value) => value !== strictTime),
    ),
    field(
      'eventTime',
      eventTime,
      Math.max(45, 91 + logicalTimeBonus),
      mapped.eventTime || '',
      timeMatches.map(normalizeTime).filter((value) => value !== eventTime),
    ),
    field('venueName', venue, mapped.venueName ? 91 : 48, mapped.venueName || ''),
    field('deliveryAddress', address, mapped.deliveryAddress ? 88 : 42, mapped.deliveryAddress || ''),
    field('recipientName', recipient, mapped.recipientName ? 82 : 40, mapped.recipientName || ''),
    field(
      'recipientTel',
      phone,
      mapped.recipientTel ? 96 : 72,
      mapped.recipientTel || '',
      phoneMatches.map(normalizePhone),
    ),
    field('orderNumber', orderNumber, mapped.orderNumber ? 93 : 50, mapped.orderNumber || ''),
    field('memo', memo, mapped.memo ? 86 : 45, mapped.memo || ''),
  ];

  const requiredFields = fields.filter((item) => item.required);
  const documentConfidence = Math.round(
    requiredFields.reduce((sum, item) => sum + item.confidence, 0) /
      Math.max(requiredFields.length, 1),
  );
  return {
    engine: documentConfidence >= 72 ? 'mlkit-demo' : 'cloud-fallback-demo',
    rawText: text,
    fields,
    documentConfidence,
    quality,
    processingMs: Date.now() - started + 860,
    variantsCompared: 6,
    unmapped,
  };
}

export async function runHybridOcr(
  asset: ImageAssetInfo,
  rawText = DEMO_RECEIPT_TEXT,
): Promise<OcrPipelineResult> {
  const quality = inspectCaptureQuality(asset);
  await new Promise((resolve) => setTimeout(resolve, 900));
  return parseReceiptText(rawText, quality);
}
