import { ReceiptFieldKey } from './schema';

// 인수증마다 라벨 명칭이 제각각이라(예: 배송일자/배송일/배달일)
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
export const FIELD_REGISTRY_VERSION = 2;

// 별칭은 services/ocr.ts 의 기존 키워드 + 인수증 표면형을 시드로 합친 것.
export const DEFAULT_FIELD_REGISTRY: FieldDef[] = [
  {
    key: 'deliveryDate',
    label: '배송 날짜',
    type: 'datetime',
    aliases: ['배송일자', '배달일자', '배송일', '배달일', '납품일', '예식일', '배송날짜', '배송 날짜'],
  },
  {
    key: 'strictTime',
    label: '배달 엄수 시간',
    type: 'time',
    aliases: ['배달 엄수', '배달엄수', '엄수', '배송 시간', '도착 시간', '납품 시간', '마감', '엄수시간'],
  },
  {
    key: 'eventTime',
    label: '예식 시간',
    type: 'time',
    aliases: ['예식 시간', '예식시간', '예식', '본식', '웨딩', '행사 시간', '행사시간'],
  },
  {
    key: 'venueName',
    label: '상호명 / 예식장명',
    type: 'text',
    aliases: ['업체명', '상호명', '상호', '예식장', '예식장명', '웨딩홀', '배송처'],
  },
  {
    key: 'deliveryAddress',
    label: '배송 주소',
    type: 'text',
    aliases: ['배송주소', '배달주소', '배송 주소', '배달 주소', '배송지', '배달지', '주소', '도착지'],
  },
  {
    key: 'recipientName',
    label: '수령자 / 담당자',
    type: 'text',
    aliases: ['수령자', '수령인', '담당자', '인수자', '받는 분', '받는분', '받는 사람', '고객명'],
  },
  {
    key: 'recipientTel',
    label: '연락처',
    type: 'tel',
    aliases: ['연락처', '전화번호', '전화', '휴대폰', '핸드폰', '연락'],
  },
  {
    key: 'orderNumber',
    label: '주문번호',
    type: 'text',
    aliases: ['주문번호', '주문 번호', '접수번호', '관리번호', '오더번호'],
  },
  {
    key: 'memo',
    label: '특이사항 / 메모',
    type: 'text',
    aliases: ['요청사항', '요청 사항', '특이사항', '메모', '주의', '비고', '전달사항', '참고사항'],
  },
];
