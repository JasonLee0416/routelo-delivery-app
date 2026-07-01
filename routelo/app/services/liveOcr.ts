import { OcrFieldKey, OcrFieldResult, OcrPipelineResult } from '../models';

export type LiveOcrFieldId = 'merchant' | 'address' | 'phone';

export type LiveOcrFieldState = {
  id: LiveOcrFieldId;
  label: string;
  status: 'missing' | 'candidate' | 'locked';
  value: string;
  confidence: number;
  supportCount: number;
  sourceKeys: OcrFieldKey[];
};

export type LiveOcrSessionState = {
  fields: Record<LiveOcrFieldId, LiveOcrFieldState>;
  frameCount: number;
  acceptedFrameCount: number;
  readyForReview: boolean;
};

const LIVE_FIELD_DEFINITIONS: Array<{
  id: LiveOcrFieldId;
  label: string;
  keys: OcrFieldKey[];
  threshold: number;
  validate?: (value: string) => boolean;
}> = [
  {
    id: 'merchant',
    label: '상호명 / 발주처',
    keys: ['orderingVendorName', 'venueName'],
    threshold: 85,
  },
  {
    id: 'address',
    label: '주소 / 배송지',
    keys: ['deliveryAddress'],
    threshold: 80,
  },
  {
    id: 'phone',
    label: '전화번호 후보',
    keys: ['orderingVendorTel', 'fulfillingVendorTel', 'recipientTel'],
    threshold: 80,
    validate: (value) =>
      /^(?:01[016789]-\d{3,4}-\d{4}|02-\d{3,4}-\d{4}|0[3-6]\d-\d{3,4}-\d{4})$/.test(
        value,
      ),
  },
];

const REQUIRED_SUPPORT_COUNT = 2;

export const createInitialLiveOcrSession = (): LiveOcrSessionState => {
  const fields = LIVE_FIELD_DEFINITIONS.reduce(
    (acc, definition) => ({
      ...acc,
      [definition.id]: {
        id: definition.id,
        label: definition.label,
        status: 'missing',
        value: '',
        confidence: 0,
        supportCount: 0,
        sourceKeys: definition.keys,
      },
    }),
    {} as Record<LiveOcrFieldId, LiveOcrFieldState>,
  );

  return {
    fields,
    frameCount: 0,
    acceptedFrameCount: 0,
    readyForReview: false,
  };
};

export function mergeOcrFields(
  current: OcrFieldResult[],
  incoming: OcrFieldResult[],
): OcrFieldResult[] {
  if (!current.length) return incoming;
  const byKey = new Map<OcrFieldKey, OcrFieldResult>();
  for (const field of current) byKey.set(field.key, field);

  for (const field of incoming) {
    const existing = byKey.get(field.key);
    if (!existing) {
      byKey.set(field.key, field);
      continue;
    }
    if (
      (!existing.value.trim() && field.value.trim()) ||
      field.confidence > existing.confidence
    ) {
      byKey.set(field.key, field);
    }
  }

  return current.map((field) => byKey.get(field.key) ?? field);
}

export function mergeOcrResult(
  current: OcrPipelineResult | undefined,
  incoming: OcrPipelineResult,
): OcrPipelineResult {
  if (!current) return incoming;
  const mergedFields = mergeOcrFields(current.fields, incoming.fields);
  return {
    ...incoming,
    rawText: [current.rawText, incoming.rawText].filter(Boolean).join('\n\n'),
    fields: mergedFields,
    documentConfidence: Math.max(
      current.documentConfidence,
      incoming.documentConfidence,
    ),
    processingMs: current.processingMs + incoming.processingMs,
    variantsCompared: current.variantsCompared + incoming.variantsCompared,
    unmapped: [...current.unmapped, ...incoming.unmapped],
    recognizedLines: [
      ...(current.recognizedLines ?? []),
      ...(incoming.recognizedLines ?? []),
    ],
  };
}

export function updateLiveOcrSession(
  session: LiveOcrSessionState,
  result: OcrPipelineResult,
): LiveOcrSessionState {
  const nextFields = { ...session.fields };

  for (const definition of LIVE_FIELD_DEFINITIONS) {
    const current = nextFields[definition.id];
    if (current.status === 'locked') continue;

    const candidate = strongestCandidate(result.fields, definition.keys);
    if (!candidate || !candidate.value.trim()) continue;
    if (candidate.confidence < definition.threshold) continue;
    if (definition.validate && !definition.validate(candidate.value)) continue;

    const sameValue =
      normalizeCandidate(candidate.value) === normalizeCandidate(current.value);
    const supportCount = sameValue ? current.supportCount + 1 : 1;
    const confidence = Math.max(current.confidence, candidate.confidence);
    const status = supportCount >= REQUIRED_SUPPORT_COUNT ? 'locked' : 'candidate';

    nextFields[definition.id] = {
      ...current,
      status,
      value: candidate.value,
      confidence,
      supportCount,
    };
  }

  const readyForReview = Object.values(nextFields).every(
    (field) => field.status === 'locked',
  );

  return {
    fields: nextFields,
    frameCount: session.frameCount + 1,
    acceptedFrameCount: session.acceptedFrameCount + 1,
    readyForReview,
  };
}

export function liveOcrReviewQuery(fields: OcrFieldResult[]): {
  vendorName: string;
  vendorPhone?: string;
} {
  const vendorName =
    valueOf(fields, 'orderingVendorName') || valueOf(fields, 'venueName');
  const vendorPhone =
    valueOf(fields, 'orderingVendorTel') ||
    valueOf(fields, 'fulfillingVendorTel') ||
    valueOf(fields, 'recipientTel');
  return { vendorName, vendorPhone: vendorPhone || undefined };
}

const valueOf = (fields: OcrFieldResult[], key: OcrFieldKey) =>
  fields.find((field) => field.key === key)?.value.trim() ?? '';

const strongestCandidate = (
  fields: OcrFieldResult[],
  keys: OcrFieldKey[],
) =>
  fields
    .filter((field) => keys.includes(field.key))
    .filter((field) => field.value.trim())
    .sort((left, right) => right.confidence - left.confidence)[0];

const normalizeCandidate = (value: string) =>
  value.replace(/\s+/g, '').replace(/[()-]/g, '').toLowerCase();
