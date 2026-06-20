import { ReceiptFieldKey } from './schema';

// 인수증마다 라벨 명칭이 제각각이라(예: 발주처/발주/발주자/발주화원)
// 같은 의미의 라벨을 하나의 정규 필드로 뭉치기 위한 별칭 사전.
// 외부 파일(field-registry.json)로 저장되어 사용 중 사용자가 별칭을 추가할 수 있다.
export type FieldType = 'text' | 'tel' | 'number' | 'datetime' | 'time';

export type FieldDef = {
  key: ReceiptFieldKey;
  label: string; // 화면에 보일 정규 명칭
  type: FieldType;
  aliases: string[]; // 같은 의미로 인식할 라벨 변형들 (label 자신은 자동 포함)
};

// 별칭 사전을 바꾸면 버전을 올린다. 레코드에 어떤 버전으로 매핑했는지 남긴다.
export const FIELD_REGISTRY_VERSION = 1;

export const DEFAULT_FIELD_REGISTRY: FieldDef[] = [
  {
    key: 'orderVendor',
    label: '발주 화원',
    type: 'text',
    aliases: ['발주처', '발주', '발주자', '발주화원', '주문화원', '주문처', '의뢰처', '의뢰화원'],
  },
  {
    key: 'orderVendorTel',
    label: '발주 화원 전화',
    type: 'tel',
    aliases: ['발주전화', '발주연락처', '주문전화', '발주처전화', '발주화원전화'],
  },
  {
    key: 'deliveryVendor',
    label: '배송 화원',
    type: 'text',
    aliases: ['배송처', '배송', '배송화원', '시공화원', '출고화원', '시공처'],
  },
  {
    key: 'deliveryVendorTel',
    label: '배송 화원 전화',
    type: 'tel',
    aliases: ['배송전화', '배송연락처', '배송처전화', '배송화원전화'],
  },
  {
    key: 'productName',
    label: '상품명',
    type: 'text',
    aliases: ['품목', '상품', '제품명', '품명', '화환종류', '상품종류'],
  },
  {
    key: 'productQuantity',
    label: '화환 수량',
    type: 'number',
    aliases: ['수량', '개수', '화환수량', '수', '주문수량'],
  },
  {
    key: 'eventTime',
    label: '예식 시간',
    type: 'time',
    aliases: ['행사시간', '예식', '예식시간', '발인시간', '행사', '발인'],
  },
  {
    key: 'deliveryDt',
    label: '배달 일시',
    type: 'datetime',
    aliases: ['배송일시', '납품일시', '배달일자', '배송일자', '도착시간', '배달시간', '납기'],
  },
  {
    key: 'deliveryAddress',
    label: '배달 장소',
    type: 'text',
    aliases: ['배송지', '배달지', '주소', '도착지', '배달주소', '배송주소', '배송장소', '장소'],
  },
  {
    key: 'recipientTel',
    label: '인수자 전화',
    type: 'tel',
    aliases: ['인수자', '받는분', '수령인', '수취인', '인수자전화', '받는사람', '수령인전화'],
  },
  {
    key: 'customerRequests',
    label: '주문자 요구사항',
    type: 'text',
    aliases: ['요청사항', '요청', '비고', '메모', '특이사항', '요구사항', '참고사항'],
  },
];
