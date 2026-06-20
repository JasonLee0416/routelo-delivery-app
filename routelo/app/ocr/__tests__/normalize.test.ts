import { FieldDef } from '../fieldRegistry';
import { levenshtein, matchField, normalizeReceipt, parseLine } from '../normalize';

// 알고리즘만 검증하도록 인라인 고정 레지스트리를 사용한다.
// (기본 레지스트리가 바뀌어도 이 테스트는 영향받지 않는다.)
const REGISTRY: FieldDef[] = [
  { key: 'orderVendor', label: '발주 화원', type: 'text', aliases: ['발주처', '발주', '발주자', '발주화원', '주문처'] },
  { key: 'orderVendorTel', label: '발주 화원 전화', type: 'tel', aliases: ['발주전화', '발주연락처'] },
  { key: 'deliveryVendor', label: '배송 화원', type: 'text', aliases: ['배송처', '배송', '배송화원'] },
  { key: 'deliveryVendorTel', label: '배송 화원 전화', type: 'tel', aliases: ['배송전화'] },
  { key: 'productName', label: '상품명', type: 'text', aliases: ['품목', '상품', '제품명'] },
  { key: 'productQuantity', label: '화환 수량', type: 'number', aliases: ['수량', '개수'] },
  { key: 'eventTime', label: '예식 시간', type: 'time', aliases: ['예식시간', '예식', '행사시간'] },
  { key: 'deliveryDt', label: '배달 일시', type: 'datetime', aliases: ['배송일시', '배달일시', '도착시간'] },
  { key: 'deliveryAddress', label: '배달 장소', type: 'text', aliases: ['배송지', '배달지', '주소'] },
  { key: 'recipientTel', label: '인수자 전화', type: 'tel', aliases: ['인수자', '받는분', '수령인'] },
  { key: 'customerRequests', label: '주문자 요구사항', type: 'text', aliases: ['요청사항', '요청', '비고'] },
];

describe('levenshtein', () => {
  it('동일 문자열은 0', () => {
    expect(levenshtein('발주', '발주')).toBe(0);
  });
  it('한 글자 차이는 1', () => {
    expect(levenshtein('발주처', '발주쳐')).toBe(1);
  });
});

describe('matchField', () => {
  it('같은 의미의 라벨 변형은 모두 한 키로 모인다', () => {
    for (const label of ['발주처', '발주', '발주자', '발주화원', '주문처']) {
      expect(matchField(label, REGISTRY)?.key).toBe('orderVendor');
    }
  });

  it('오타도 퍼지 매칭으로 흡수한다', () => {
    expect(matchField('발주쳐', REGISTRY)?.key).toBe('orderVendor');
  });

  it('발주와 배송을 혼동하지 않는다', () => {
    expect(matchField('배송처', REGISTRY)?.key).toBe('deliveryVendor');
    expect(matchField('배송전화', REGISTRY)?.key).toBe('deliveryVendorTel');
    expect(matchField('발주전화', REGISTRY)?.key).toBe('orderVendorTel');
  });

  it('관련 없는 텍스트는 매칭하지 않는다', () => {
    expect(matchField('결제완료', REGISTRY)).toBeNull();
  });
});

describe('parseLine', () => {
  it('콜론으로 라벨/값을 나눈다', () => {
    expect(parseLine('발주처: 행복꽃집', REGISTRY)).toMatchObject({
      field: { key: 'orderVendor' },
      value: '행복꽃집',
    });
  });

  it('값 안의 콜론(시간)은 라벨 구분자로 쓰지 않는다', () => {
    expect(parseLine('예식시간 11:00', REGISTRY)).toMatchObject({
      field: { key: 'eventTime' },
      value: '11:00',
    });
  });

  it('공백이 들어간 라벨은 가장 긴 매칭을 택해 값을 보존한다', () => {
    expect(parseLine('발주 전화 02-345-7788', REGISTRY)).toMatchObject({
      field: { key: 'orderVendorTel' },
      value: '02-345-7788',
    });
  });

  it('매칭 안 되는 줄은 값/고아로 둔다', () => {
    expect(parseLine('결제완료', REGISTRY)).toMatchObject({ field: null, label: '', value: '결제완료' });
  });
});

describe('normalizeReceipt', () => {
  const result = normalizeReceipt(
    [
      '발주처: 행복꽃집',
      '발주 전화 02-345-7788',
      '배송화원   로즈플라워',
      '상품명',
      '축하 3단 화환',
      '수량: 2',
      '예식시간 11:00',
      '배달일시: 2026-06-19 10:30',
      '주소: 서울 강남구 테헤란로 152',
      '받는분: 010-4821-7732',
      '요청사항: 도착 후 사진 전송',
      '결제완료',
    ],
    REGISTRY,
  );

  it('혼합 레이아웃에서 모든 필드를 정확히 추출한다', () => {
    expect(result.fields).toEqual({
      orderVendor: '행복꽃집',
      orderVendorTel: '02-345-7788',
      deliveryVendor: '로즈플라워',
      productName: '축하 3단 화환',
      productQuantity: '2',
      eventTime: '11:00',
      deliveryDt: '2026-06-19 10:30',
      deliveryAddress: '서울 강남구 테헤란로 152',
      recipientTel: '010-4821-7732',
      customerRequests: '도착 후 사진 전송',
    });
  });

  it('매칭 실패 줄은 버리지 않고 unmapped에 보존한다(무손실)', () => {
    expect(result.unmapped).toEqual([{ label: '', value: '결제완료' }]);
  });
});
