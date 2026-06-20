import { OcrForm } from '../models';
import { FieldDef } from './fieldRegistry';
import { normalizeReceipt } from './normalize';
import { ReceiptFieldKey, ReceiptRecord } from './schema';

// OCR 원본 라인 → 저장용 레코드. (id는 호출부에서 Date.now 등으로 주입해 테스트 가능하게 함)
export function buildReceiptRecord(params: {
  id: string;
  capturedAt: string;
  lines: string[];
  registry: FieldDef[];
  imageUri?: string;
  registryVersion: number;
}): ReceiptRecord {
  const { fields, unmapped } = normalizeReceipt(params.lines, params.registry);
  return {
    id: params.id,
    capturedAt: params.capturedAt,
    imageUri: params.imageUri,
    raw: { lines: params.lines },
    fields,
    unmapped,
    registryVersion: params.registryVersion,
  };
}

// 정규화된 레코드 → 기존 인수증 폼(OcrForm). 빈 필드는 폼 기본값으로 채운다.
export function recordToOcrForm(record: ReceiptRecord): OcrForm {
  const f = record.fields;
  const get = (key: ReceiptFieldKey, fallback = '') => f[key] ?? fallback;
  return {
    orderVendor: get('orderVendor'),
    orderVendorTel: get('orderVendorTel'),
    deliveryVendor: get('deliveryVendor'),
    deliveryVendorTel: get('deliveryVendorTel'),
    productName: get('productName'),
    productQuantity: get('productQuantity', '1'),
    eventTime: get('eventTime'),
    deliveryDt: get('deliveryDt'),
    deliveryAddress: get('deliveryAddress'),
    customerRequests: get('customerRequests'),
    recipientTel: get('recipientTel'),
  };
}
