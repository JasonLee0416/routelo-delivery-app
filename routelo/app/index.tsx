import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  DEFAULT_SETTINGS,
  GYEONGGI_DISTRICTS,
  SAMPLE_DELIVERIES,
  SAMPLE_FUEL_LOGS,
  SAMPLE_MILEAGE_LOGS,
  SAMPLE_OCR_FORM,
  SEOUL_DISTRICTS,
} from './data';
import { Delivery, FeeSettings, FuelLog, MileageLog, OcrForm } from './models';
import { calculateFeeByAddress, geocodeAddress, optimizeByNearestNeighbor } from './services/kakao';

type TabKey = 'deliveries' | 'ocr' | 'route' | 'finance' | 'settings';
type DeliveryFilter = 'all' | 'pending' | 'completed';
type Period = '일간' | '주간' | '월간';

const STORAGE_KEY = '@routelo/state/v1';
const CURRENCY = new Intl.NumberFormat('ko-KR');
const ThemeContext = createContext(false);
const useDarkMode = () => useContext(ThemeContext);

const tabs: { key: TabKey; label: string; icon: string; activeIcon: string }[] = [
  { key: 'deliveries', label: '배달', icon: 'list-outline', activeIcon: 'list' },
  { key: 'ocr', label: '인수증', icon: 'receipt-outline', activeIcon: 'receipt' },
  { key: 'route', label: '동선', icon: 'map-outline', activeIcon: 'map' },
  { key: 'finance', label: '주유 계산기', icon: 'calculator-outline', activeIcon: 'calculator' },
  { key: 'settings', label: '설정', icon: 'settings-outline', activeIcon: 'settings' },
];

const emptyOcrForm: OcrForm = {
  orderVendor: '',
  orderVendorTel: '',
  deliveryVendor: '',
  deliveryVendorTel: '',
  productName: '',
  productQuantity: '1',
  eventTime: '',
  deliveryDt: '',
  deliveryAddress: '',
  customerRequests: '',
  recipientTel: '',
};

function money(value: number) {
  return `${CURRENCY.format(Math.round(value))}원`;
}

function callNumber(tel: string) {
  const dialable = tel.replace(/[^0-9+]/g, '');
  if (!dialable) {
    Alert.alert('연락처 없음', '저장된 전화번호가 없습니다.');
    return;
  }
  Linking.openURL(`tel:${dialable}`).catch(() =>
    Alert.alert('전화 연결 실패', '이 기기에서 전화를 걸 수 없습니다.'),
  );
}

function SectionTitle({
  title,
  caption,
  action,
}: {
  title: string;
  caption?: string;
  action?: React.ReactNode;
}) {
  const dark = useDarkMode();
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionTitleWrap}>
        <Text style={[styles.sectionTitle, dark && styles.darkText]}>{title}</Text>
        {!!caption && <Text style={[styles.sectionCaption, dark && styles.darkMutedText]}>{caption}</Text>}
      </View>
      {action}
    </View>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent = '#2E6BFF',
  dark = false,
}: {
  icon: string;
  label: string;
  value: string;
  accent?: string;
  dark?: boolean;
}) {
  const isDarkMode = useDarkMode();
  return (
    <View style={[styles.statCard, isDarkMode && styles.darkCard, dark && styles.statCardDark]}>
      <View style={[styles.statIcon, { backgroundColor: `${accent}18` }]}>
        <Ionicons name={icon as never} size={18} color={accent} />
      </View>
      <Text style={[styles.statLabel, isDarkMode && styles.darkMutedText, dark && styles.textMutedOnDark]}>{label}</Text>
      <Text style={[styles.statValue, isDarkMode && styles.darkText, dark && styles.textOnDark]}>{value}</Text>
    </View>
  );
}

function DeliveryCard({
  delivery,
  index,
  onToggle,
}: {
  delivery: Delivery;
  index?: number;
  onToggle: () => void;
}) {
  const completed = delivery.status === 'completed';
  const dark = useDarkMode();
  const isCelebration = delivery.productName.includes('축하');

  return (
    <View style={[styles.deliveryCard, dark && styles.darkCard, completed && styles.deliveryCardCompleted]}>
      <View style={styles.deliveryCardTop}>
        <View style={styles.deliveryTimeWrap}>
          {typeof index === 'number' && (
            <View style={styles.routeNumber}>
              <Text style={styles.routeNumberText}>{index + 1}</Text>
            </View>
          )}
          <View>
            <Text style={styles.deliveryTime}>
              {delivery.deliveryDt.split(' ')[1] || delivery.deliveryDt}
            </Text>
            <Text style={[styles.deliveryVendor, dark && styles.darkMutedText]}>배달 예정</Text>
          </View>
        </View>
        <View style={[styles.statusChip, completed && styles.statusChipCompleted]}>
          <Text style={[styles.statusChipText, completed && styles.statusChipTextCompleted]}>
            {completed ? '완료' : '배달 대기'}
          </Text>
        </View>
      </View>

      <View style={styles.productRow}>
        <Text style={[styles.productName, dark && styles.darkText]}>{delivery.productName}</Text>
        <View style={styles.quantityBadge}>
          <Text style={styles.quantityLabel}>수량</Text>
          <Text style={styles.quantityValue}>{delivery.productQuantity || 1}개</Text>
        </View>
      </View>
      {isCelebration && !!delivery.eventTime && (
        <View style={styles.eventTimeRow}>
          <Ionicons name="alarm-outline" size={17} color="#E03131" />
          <Text style={styles.eventTimeLabel}>예식 시간</Text>
          <Text style={styles.eventTimeValue}>{delivery.eventTime}</Text>
          <Text style={styles.eventTimeWarning}>시간 엄수</Text>
        </View>
      )}
      <View style={[styles.vendorPanel, dark && styles.darkInset]}>
        <View style={styles.vendorLine}>
          <Text style={styles.vendorType}>발주화원</Text>
          <View style={styles.flexOne}>
            <Text style={[styles.vendorName, dark && styles.darkText]}>{delivery.orderVendor}</Text>
            <Text style={[styles.vendorTel, dark && styles.darkMutedText]}>{delivery.orderVendorTel}</Text>
          </View>
          <Pressable hitSlop={8} onPress={() => callNumber(delivery.orderVendorTel)}>
            <Ionicons name="call-outline" size={17} color="#2E6BFF" />
          </Pressable>
        </View>
        <View style={styles.vendorDivider} />
        <View style={styles.vendorLine}>
          <Text style={styles.vendorType}>배송화원</Text>
          <View style={styles.flexOne}>
            <Text style={[styles.vendorName, dark && styles.darkText]}>{delivery.deliveryVendor}</Text>
            <Text style={[styles.vendorTel, dark && styles.darkMutedText]}>{delivery.deliveryVendorTel}</Text>
          </View>
          <Pressable hitSlop={8} onPress={() => callNumber(delivery.deliveryVendorTel)}>
            <Ionicons name="call-outline" size={17} color="#2E6BFF" />
          </Pressable>
        </View>
      </View>
      <View style={styles.infoLine}>
        <Ionicons name="location-outline" size={17} color="#65748B" />
        <Text style={[styles.infoText, dark && styles.darkMutedText]} numberOfLines={2}>
          {delivery.deliveryAddress}
        </Text>
      </View>
      <View style={styles.infoLine}>
        <Ionicons name="chatbubble-ellipses-outline" size={16} color="#65748B" />
        <Text style={[styles.infoText, dark && styles.darkMutedText]} numberOfLines={1}>
          {delivery.customerRequests || '요청사항 없음'}
        </Text>
      </View>

      {!!delivery.imageUri && (
        <Image
          source={{ uri: delivery.imageUri }}
          style={styles.receiptThumb}
          resizeMode="cover"
        />
      )}

      <View style={styles.deliveryFooter}>
        <View style={styles.feeWrap}>
          <Text style={styles.distanceText}>{delivery.distanceKm.toFixed(1)}km</Text>
          <Text style={styles.feeText}>{money(delivery.fee)}</Text>
        </View>
        <View style={styles.cardActions}>
          <Pressable style={styles.iconButton} onPress={() => callNumber(delivery.recipientTel)}>
            <Ionicons name="call-outline" size={19} color="#2E6BFF" />
          </Pressable>
          <Pressable
            style={[styles.completeButton, completed && styles.undoButton]}
            onPress={onToggle}
          >
            <Ionicons
              name={completed ? 'refresh' : 'checkmark'}
              size={18}
              color={completed ? '#2E6BFF' : '#FFFFFF'}
            />
            <Text style={[styles.completeButtonText, completed && styles.undoButtonText]}>
              {completed ? '되돌리기' : '완료 처리'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function AppHeader({ activeTab }: { activeTab: TabKey }) {
  const dark = useDarkMode();
  const titles: Record<TabKey, string> = {
    deliveries: '오늘의 배달',
    ocr: '인수증 등록',
    route: '배달 동선',
    finance: '주유 계산기',
    settings: '환경 설정',
  };

  const formattedDate = new Date().toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });

  return (
    <View style={[styles.header, dark && styles.darkSurface]}>
      <View>
        <Text style={[styles.dateText, dark && styles.darkMutedText]}>{formattedDate}</Text>
        <Text style={[styles.pageTitle, dark && styles.darkText]}>{titles[activeTab]}</Text>
      </View>
      <View style={styles.headerRight}>
        <View style={styles.syncBadge}>
          <View style={styles.syncDot} />
          <Text style={styles.syncText}>저장됨</Text>
        </View>
        <Pressable style={styles.profileButton}>
          <Ionicons name="person" size={20} color="#2E6BFF" />
        </Pressable>
      </View>
    </View>
  );
}

function DeliveryListScreen({
  deliveries,
  onToggle,
  onGoOcr,
}: {
  deliveries: Delivery[];
  onToggle: (id: string) => void;
  onGoOcr: () => void;
}) {
  const dark = useDarkMode();
  const [filter, setFilter] = useState<DeliveryFilter>('all');
  const filtered = deliveries.filter((delivery) =>
    filter === 'all' ? true : delivery.status === filter,
  );
  const completed = deliveries.filter((delivery) => delivery.status === 'completed');
  const totalFee = completed.reduce((sum, delivery) => sum + delivery.fee, 0);

  return (
    <ScrollView
      contentContainerStyle={styles.screenContent}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={['#1D4ED8', '#3978FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View>
          <Text style={styles.heroEyebrow}>TODAY&apos;S ROUTE</Text>
          <Text style={styles.heroTitle}>
            오늘도 안전하게,{'\n'}좋은 하루 보내세요!
          </Text>
        </View>
        <View style={styles.heroCircle}>
          <Ionicons name="navigate" size={30} color="#FFFFFF" />
        </View>
        <View style={styles.heroMetrics}>
          <View style={styles.heroMetric}>
            <Text style={styles.heroMetricValue}>{deliveries.length}</Text>
            <Text style={styles.heroMetricLabel}>전체 배달</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroMetric}>
            <Text style={styles.heroMetricValue}>{completed.length}</Text>
            <Text style={styles.heroMetricLabel}>완료</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroMetric}>
            <Text style={styles.heroMetricValue}>{money(totalFee)}</Text>
            <Text style={styles.heroMetricLabel}>현재 수익</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.quickStats}>
        <StatCard
          icon="time-outline"
          label="남은 배달"
          value={`${deliveries.length - completed.length}건`}
          accent="#FF8A34"
        />
        <StatCard
          icon="speedometer-outline"
          label="예상 거리"
          value={`${deliveries
            .filter((item) => item.status === 'pending')
            .reduce((sum, item) => sum + item.distanceKm, 0)
            .toFixed(1)}km`}
          accent="#10A37F"
        />
      </View>

      <SectionTitle
        title="배달 목록"
        caption={`${filtered.length}건의 일정`}
        action={
          <Pressable style={styles.addMiniButton} onPress={onGoOcr}>
            <Ionicons name="add" size={17} color="#2E6BFF" />
            <Text style={styles.addMiniText}>인수증 추가</Text>
          </Pressable>
        }
      />

      <View style={[styles.segment, dark && styles.darkInset]}>
        {([
          ['all', '전체'],
          ['pending', '대기'],
          ['completed', '완료'],
        ] as [DeliveryFilter, string][]).map(([key, label]) => (
          <Pressable
            key={key}
            style={[styles.segmentButton, filter === key && styles.segmentButtonActive]}
            onPress={() => setFilter(key)}
          >
            <Text
              style={[
                styles.segmentButtonText,
                filter === key && styles.segmentButtonTextActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {filtered.map((delivery) => (
        <DeliveryCard
          key={delivery.id}
          delivery={delivery}
          onToggle={() => onToggle(delivery.id)}
        />
      ))}

      {!filtered.length && (
        <View style={styles.emptyState}>
          <Ionicons name="file-tray-outline" size={38} color="#AAB4C4" />
          <Text style={styles.emptyTitle}>표시할 배달이 없습니다</Text>
          <Text style={styles.emptyCaption}>인수증을 촬영해 새 배달을 등록해보세요.</Text>
        </View>
      )}
    </ScrollView>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric' | 'phone-pad';
}) {
  const dark = useDarkMode();
  return (
    <View style={styles.inputGroup}>
      <Text style={[styles.inputLabel, dark && styles.darkMutedText]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#AAB4C4"
        multiline={multiline}
        keyboardType={keyboardType}
        style={[styles.textInput, dark && styles.darkInput, multiline && styles.multilineInput]}
      />
    </View>
  );
}

function OcrScreen({
  onRegister,
}: {
  onRegister: (form: OcrForm, imageUri?: string) => Promise<void>;
}) {
  const dark = useDarkMode();
  const [imageUri, setImageUri] = useState<string>();
  const [processing, setProcessing] = useState(false);
  const [form, setForm] = useState<OcrForm>(emptyOcrForm);
  const [step, setStep] = useState<'capture' | 'review'>('capture');

  const update = (key: keyof OcrForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const chooseImage = async (camera: boolean) => {
    const permission = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('권한 필요', '인수증 이미지를 불러오려면 사진 접근 권한이 필요합니다.');
      return;
    }

    const result = camera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          allowsEditing: true,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          allowsEditing: true,
        });

    if (result.canceled) return;

    setImageUri(result.assets[0].uri);
    setProcessing(true);
    setTimeout(() => {
      setForm(SAMPLE_OCR_FORM);
      setProcessing(false);
      setStep('review');
    }, 1100);
  };

  const register = async () => {
    if (!form.deliveryAddress || !form.productName || !form.deliveryDt) {
      Alert.alert('필수 정보 확인', '상품명, 배달일시, 배달장소를 확인해주세요.');
      return;
    }

    await onRegister(form, imageUri);
    setForm(emptyOcrForm);
    setImageUri(undefined);
    setStep('capture');
    Alert.alert('등록 완료', '배달 대기 목록에 새 일정이 추가되었습니다.');
  };

  if (step === 'capture') {
    return (
      <ScrollView
        contentContainerStyle={styles.screenContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.ocrIntro, dark && styles.darkBlueInset]}>
          <View style={styles.ocrIntroIcon}>
            <Ionicons name="sparkles" size={22} color="#2E6BFF" />
          </View>
          <View style={styles.flexOne}>
            <Text style={styles.ocrIntroTitle}>AI 인수증 자동 등록</Text>
            <Text style={styles.ocrIntroText}>
              인수증을 촬영하면 배달 정보를 읽어 자동으로 입력합니다.
            </Text>
          </View>
        </View>

        <Pressable style={[styles.scanner, dark && styles.darkCard]} onPress={() => chooseImage(true)}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.receiptImage} />
          ) : (
            <>
              <View style={[styles.scanCorner, styles.scanCornerTL]} />
              <View style={[styles.scanCorner, styles.scanCornerTR]} />
              <View style={[styles.scanCorner, styles.scanCornerBL]} />
              <View style={[styles.scanCorner, styles.scanCornerBR]} />
              <View style={styles.cameraCircle}>
                <Ionicons name="camera-outline" size={35} color="#2E6BFF" />
              </View>
              <Text style={styles.scannerTitle}>인수증을 프레임 안에 맞춰주세요</Text>
              <Text style={styles.scannerCaption}>흔들리지 않게 밝은 곳에서 촬영하세요</Text>
            </>
          )}

          {processing && (
            <View style={styles.processingOverlay}>
              <Ionicons name="scan" size={40} color="#FFFFFF" />
              <Text style={styles.processingText}>배달 정보를 읽고 있어요...</Text>
            </View>
          )}
        </Pressable>

        <Pressable style={styles.primaryButton} onPress={() => chooseImage(true)}>
          <Ionicons name="camera" size={20} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>인수증 촬영하기</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => chooseImage(false)}>
          <Ionicons name="images-outline" size={20} color="#2E6BFF" />
          <Text style={styles.secondaryButtonText}>갤러리에서 불러오기</Text>
        </Pressable>

        <View style={styles.tipCard}>
          <Ionicons name="bulb-outline" size={20} color="#E47A22" />
          <View style={styles.flexOne}>
            <Text style={styles.tipTitle}>인식률을 높이는 방법</Text>
            <Text style={styles.tipText}>
              인수증 전체가 보이도록 수직으로 촬영하고, 그림자가 생기지 않게 해주세요.
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flexOne}
    >
      <ScrollView
        contentContainerStyle={styles.screenContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.reviewStatus}>
          <View style={styles.reviewCheck}>
            <Ionicons name="checkmark" size={19} color="#FFFFFF" />
          </View>
          <View style={styles.flexOne}>
            <Text style={styles.reviewTitle}>정보 추출이 완료됐어요</Text>
            <Text style={styles.reviewCaption}>등록 전 잘못 인식된 내용이 없는지 확인해주세요.</Text>
          </View>
          <Pressable onPress={() => setStep('capture')}>
            <Text style={styles.retakeText}>다시 촬영</Text>
          </Pressable>
        </View>

        <SectionTitle title="추출된 배달 정보" caption="필수 항목을 확인해주세요" />
        <View style={[styles.formCard, dark && styles.darkCard]}>
          <View style={styles.twoColumns}>
            <View style={styles.halfInput}>
              <LabeledInput
                label="발주 화원"
                value={form.orderVendor}
                onChangeText={(value) => update('orderVendor', value)}
              />
            </View>
            <View style={styles.halfInput}>
              <LabeledInput
                label="발주 화원 전화"
                value={form.orderVendorTel}
                keyboardType="phone-pad"
                onChangeText={(value) => update('orderVendorTel', value)}
              />
            </View>
          </View>
          <View style={styles.twoColumns}>
            <View style={styles.halfInput}>
              <LabeledInput
                label="배송 화원"
                value={form.deliveryVendor}
                onChangeText={(value) => update('deliveryVendor', value)}
              />
            </View>
            <View style={styles.halfInput}>
              <LabeledInput
                label="배송 화원 전화"
                value={form.deliveryVendorTel}
                keyboardType="phone-pad"
                onChangeText={(value) => update('deliveryVendorTel', value)}
              />
            </View>
          </View>
          <View style={styles.twoColumns}>
            <View style={styles.flexOne}>
              <LabeledInput
                label="상품명 *"
                value={form.productName}
                onChangeText={(value) => update('productName', value)}
              />
            </View>
            <View style={styles.quantityInputColumn}>
              <LabeledInput
                label="화환 수량 *"
                value={form.productQuantity}
                keyboardType="numeric"
                onChangeText={(value) => update('productQuantity', value)}
              />
            </View>
          </View>
          <LabeledInput
            label="예식 시간 (축하화환)"
            value={form.eventTime}
            placeholder="예: 17:00"
            onChangeText={(value) => update('eventTime', value)}
          />
          <LabeledInput
            label="배달 일시 *"
            value={form.deliveryDt}
            onChangeText={(value) => update('deliveryDt', value)}
          />
          <LabeledInput
            label="배달 장소 *"
            value={form.deliveryAddress}
            onChangeText={(value) => update('deliveryAddress', value)}
          />
          <LabeledInput
            label="인수자 전화번호"
            value={form.recipientTel}
            keyboardType="phone-pad"
            onChangeText={(value) => update('recipientTel', value)}
          />
          <LabeledInput
            label="주문자 요구사항"
            value={form.customerRequests}
            multiline
            onChangeText={(value) => update('customerRequests', value)}
          />
        </View>

        <Pressable style={styles.primaryButton} onPress={register}>
          <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>배달 목록에 등록</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function RouteScreen({
  deliveries,
  onToggle,
}: {
  deliveries: Delivery[];
  onToggle: (id: string) => void;
}) {
  const dark = useDarkMode();
  const pending = deliveries.filter((delivery) => delivery.status === 'pending');
  const [optimized, setOptimized] = useState(true);
  const route = useMemo(
    () => (optimized ? optimizeByNearestNeighbor(pending) : pending),
    [deliveries, optimized],
  );

  const totalDistance = route.reduce((sum, item) => sum + item.distanceKm, 0);
  const bounds = {
    minLat: Math.min(...route.map((item) => item.latitude), 37.48),
    maxLat: Math.max(...route.map((item) => item.latitude), 37.53),
    minLon: Math.min(...route.map((item) => item.longitude), 127.0),
    maxLon: Math.max(...route.map((item) => item.longitude), 127.11),
  };

  const toggleOptimize = () => {
    const next = !optimized;
    setOptimized(next);
    Alert.alert(
      next ? '동선 최적화 완료' : '기본 순서',
      next
        ? '현재 위치에서 가까운 순서로 경유지를 재정렬했습니다.'
        : '인수증 등록 순서로 되돌렸습니다.',
    );
  };

  return (
    <ScrollView
      contentContainerStyle={styles.screenContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.mapCard}>
        <View style={styles.mapBackground}>
          <View style={[styles.road, styles.roadOne]} />
          <View style={[styles.road, styles.roadTwo]} />
          <View style={[styles.road, styles.roadThree]} />
          <View style={[styles.road, styles.roadFour]} />
          <View style={styles.parkShape} />
          <View style={styles.riverShape} />
          <View style={styles.currentMarker}>
            <View style={styles.currentMarkerInner} />
          </View>

          {route.map((delivery, index) => {
            const left =
              8 +
              ((delivery.longitude - bounds.minLon) /
                Math.max(bounds.maxLon - bounds.minLon, 0.001)) *
                77;
            const top =
              12 +
              (1 -
                (delivery.latitude - bounds.minLat) /
                  Math.max(bounds.maxLat - bounds.minLat, 0.001)) *
                65;
            return (
              <View
                key={delivery.id}
                style={[styles.mapMarkerWrap, { left: `${left}%`, top: `${top}%` }]}
              >
                <View style={styles.mapMarker}>
                  <Text style={styles.mapMarkerText}>{index + 1}</Text>
                </View>
                <View style={styles.mapMarkerTail} />
              </View>
            );
          })}

          <View style={styles.mapBrand}>
            <Text style={styles.mapBrandText}>KAKAO MAP READY</Text>
          </View>
        </View>
        <Pressable style={styles.myLocationButton}>
          <Ionicons name="locate" size={20} color="#2E6BFF" />
        </Pressable>
      </View>

      <View style={[styles.routeSummary, dark && styles.darkCard]}>
        <View>
          <View style={styles.optimizedRow}>
            <View style={styles.optimizedBadge}>
              <Ionicons name="sparkles" size={13} color="#087F5B" />
              <Text style={styles.optimizedText}>{optimized ? '최적 동선' : '기본 순서'}</Text>
            </View>
          </View>
          <Text style={styles.routeSummaryTitle}>{route.length}곳을 방문할 예정이에요</Text>
          <Text style={styles.routeSummaryCaption}>
            예상 {totalDistance.toFixed(1)}km · 약 {Math.round(totalDistance * 4.2)}분
          </Text>
        </View>
        <Pressable style={styles.optimizeButton} onPress={toggleOptimize}>
          <Ionicons name="git-compare-outline" size={18} color="#FFFFFF" />
          <Text style={styles.optimizeButtonText}>{optimized ? '기본 순서로' : '동선 최적화'}</Text>
        </Pressable>
      </View>

      <SectionTitle title="추천 방문 순서" caption="현재 위치 기준" />
      <View style={styles.routeLine}>
        {route.map((delivery, index) => (
          <View key={delivery.id} style={styles.routeItemWrap}>
            {index < route.length - 1 && <View style={styles.routeConnector} />}
            <DeliveryCard
              delivery={delivery}
              index={index}
              onToggle={() => onToggle(delivery.id)}
            />
          </View>
        ))}
      </View>

      {!route.length && (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-done-circle-outline" size={42} color="#10A37F" />
          <Text style={styles.emptyTitle}>오늘 배달을 모두 완료했어요</Text>
          <Text style={styles.emptyCaption}>새 인수증이 등록되면 동선을 다시 계산합니다.</Text>
        </View>
      )}
    </ScrollView>
  );
}

function FinanceScreen({
  deliveries,
  fuelLogs,
  mileageLogs,
  settings,
  onAddFuel,
  onAddMileage,
  onUpdateVehicle,
}: {
  deliveries: Delivery[];
  fuelLogs: FuelLog[];
  mileageLogs: MileageLog[];
  settings: FeeSettings;
  onAddFuel: (log: FuelLog) => void;
  onAddMileage: (log: MileageLog) => void;
  onUpdateVehicle: (vehicleModel: string, fuelTankCapacity: number) => void;
}) {
  const dark = useDarkMode();
  const [period, setPeriod] = useState<Period>('월간');
  const [fuelModalOpen, setFuelModalOpen] = useState(false);
  const [mileageModalOpen, setMileageModalOpen] = useState(false);
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [odometer, setOdometer] = useState('');
  const [fuelOdometer, setFuelOdometer] = useState('');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [liters, setLiters] = useState('');
  const [vehicleModel, setVehicleModel] = useState(settings.vehicleModel);
  const [tankCapacity, setTankCapacity] = useState(String(settings.fuelTankCapacity));

  const now = new Date();
  const daysForPeriod = period === '일간' ? 1 : period === '주간' ? 7 : 31;
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - (daysForPeriod - 1));
  startDate.setHours(0, 0, 0, 0);
  const inPeriod = (date: string) => new Date(date.replace(' ', 'T')) >= startDate;

  const completedRevenue = deliveries
    .filter((delivery) => delivery.status === 'completed' && inPeriod(delivery.deliveryDt))
    .reduce((sum, delivery) => sum + delivery.fee, 0);
  const periodFuelLogs = fuelLogs.filter((log) => inPeriod(log.date));
  const periodMileageLogs = mileageLogs.filter((log) => inPeriod(log.date));
  const expense = periodFuelLogs.reduce((sum, log) => sum + log.amount, 0);
  const profit = completedRevenue - expense;
  const margin = completedRevenue ? Math.max((profit / completedRevenue) * 100, 0) : 0;
  const totalDistance = periodMileageLogs.reduce((sum, log) => sum + log.dailyDistanceKm, 0);
  const totalLiters = periodFuelLogs.reduce((sum, log) => sum + log.liters, 0);
  const actualEfficiency = totalLiters ? totalDistance / totalLiters : 0;
  const latestOdometer = mileageLogs.length
    ? Math.max(...mileageLogs.map((log) => log.odometerKm))
    : 0;
  const calculatedLiters = Number(liters) || (Number(amount) && Number(price)
    ? Number(amount) / Number(price)
    : 0);
  const calculatedPrice = Number(price) || (Number(amount) && Number(liters)
    ? Number(amount) / Number(liters)
    : 0);
  const tankFillRatio = settings.fuelTankCapacity
    ? Math.min((calculatedLiters / settings.fuelTankCapacity) * 100, 100)
    : 0;

  const addFuel = () => {
    const amountValue = Number(amount);
    const litersValue = calculatedLiters;
    const priceValue = calculatedPrice;
    if (!amountValue || !litersValue || !priceValue) {
      Alert.alert('입력값 확인', '주유 총액과 주유량 또는 리터당 단가를 입력해주세요.');
      return;
    }

    onAddFuel({
      id: `fuel-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      pricePerLiter: priceValue,
      liters: litersValue,
      amount: amountValue,
      odometerKm: Number(fuelOdometer) || latestOdometer,
    });
    setFuelModalOpen(false);
    setAmount('');
    setLiters('');
    setPrice('');
    setFuelOdometer('');
  };

  const addMileage = () => {
    const odometerValue = Number(odometer);
    if (!odometerValue || odometerValue < latestOdometer) {
      Alert.alert('계기판 확인', `현재 누적거리 ${latestOdometer.toLocaleString()}km 이상을 입력해주세요.`);
      return;
    }
    const date = new Date().toISOString().slice(0, 10);
    onAddMileage({
      id: `mileage-${Date.now()}`,
      date,
      odometerKm: odometerValue,
      dailyDistanceKm: latestOdometer ? odometerValue - latestOdometer : 0,
    });
    setOdometer('');
    setMileageModalOpen(false);
  };

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.screenContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.periodSelector, dark && styles.darkInset]}>
          {(['일간', '주간', '월간'] as Period[]).map((item) => (
            <Pressable
              key={item}
              style={[styles.periodButton, period === item && styles.periodButtonActive]}
              onPress={() => setPeriod(item)}
            >
              <Text
                style={[
                  styles.periodButtonText,
                  period === item && styles.periodButtonTextActive,
                ]}
              >
                {item}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.vehicleSummaryCard, dark && styles.darkCard]}>
          <View style={styles.vehicleSummaryTop}>
            <View style={styles.vehicleIcon}>
              <Ionicons name="car-sport" size={25} color="#2E6BFF" />
            </View>
            <View style={styles.flexOne}>
              <Text style={[styles.vehicleName, dark && styles.darkText]}>
                {settings.vehicleModel || '업무 차량을 등록해주세요'}
              </Text>
              <Text style={[styles.vehicleCaption, dark && styles.darkMutedText]}>
                연료탱크 최대 {settings.fuelTankCapacity || 0}L · 계기판 {latestOdometer.toLocaleString()}km
              </Text>
            </View>
            <Pressable testID="vehicle-settings-button" style={styles.vehicleEditButton} onPress={() => setVehicleModalOpen(true)}>
              <Text style={styles.vehicleEditText}>차량 설정</Text>
            </Pressable>
          </View>
        </View>

        <LinearGradient
          colors={['#142449', '#1E3769']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.profitCard}
        >
          <Text style={styles.profitLabel}>{period} 실제 손익</Text>
          <Text style={styles.profitValue}>{money(profit)}</Text>
          <View style={styles.profitChange}>
            <Ionicons name="trending-up" size={15} color="#6EE7B7" />
            <Text style={styles.profitChangeText}>수익률 {margin.toFixed(1)}%</Text>
          </View>
          <View style={styles.profitBreakdown}>
            <View>
              <Text style={styles.breakdownLabel}>배달 수익</Text>
              <Text style={styles.breakdownValue}>{money(completedRevenue)}</Text>
            </View>
            <View style={styles.breakdownDivider} />
            <View>
              <Text style={styles.breakdownLabel}>유류 지출</Text>
              <Text style={styles.breakdownValue}>{money(expense)}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.quickStats}>
          <StatCard
            icon="car-sport-outline"
            label={`${period} 주행거리`}
            value={`${totalDistance.toFixed(0)}km`}
            accent="#2E6BFF"
          />
          <StatCard
            icon="leaf-outline"
            label="실측 연비"
            value={`${actualEfficiency.toFixed(1)}km/L`}
            accent="#10A37F"
          />
        </View>

        <View style={styles.financeActions}>
          <Pressable testID="mileage-add-button" style={styles.mileageAction} onPress={() => setMileageModalOpen(true)}>
            <Ionicons name="speedometer-outline" size={21} color="#2E6BFF" />
            <View>
              <Text style={styles.financeActionTitle}>오늘 계기판 입력</Text>
              <Text style={styles.financeActionCaption}>매일 누적 주행거리 기록</Text>
            </View>
          </Pressable>
          <Pressable testID="fuel-add-button" style={styles.fuelAction} onPress={() => setFuelModalOpen(true)}>
            <Ionicons name="water-outline" size={21} color="#E46F20" />
            <View>
              <Text style={styles.financeActionTitle}>주유 기록</Text>
              <Text style={styles.financeActionCaption}>금액·리터·단가 입력</Text>
            </View>
          </Pressable>
        </View>

        <SectionTitle
          title="일일 주행 기록"
          caption={`${mileageLogs.length}일 기록`}
          action={
            <Pressable style={styles.addMiniButton} onPress={() => setMileageModalOpen(true)}>
              <Ionicons name="add" size={17} color="#2E6BFF" />
              <Text style={styles.addMiniText}>오늘 입력</Text>
            </Pressable>
          }
        />
        <View style={[styles.logCard, dark && styles.darkCard]}>
          {[...mileageLogs].reverse().map((log, index) => (
            <View key={log.id} style={[styles.logRow, index < mileageLogs.length - 1 && styles.logRowBorder]}>
              <View style={[styles.fuelIcon, { backgroundColor: '#EDF2FF' }]}>
                <Ionicons name="speedometer-outline" size={20} color="#2E6BFF" />
              </View>
              <View style={styles.flexOne}>
                <Text style={[styles.logTitle, dark && styles.darkText]}>{log.date}</Text>
                <Text style={[styles.logCaption, dark && styles.darkMutedText]}>
                  계기판 {log.odometerKm.toLocaleString()}km
                </Text>
              </View>
              <Text style={styles.mileageAmount}>+{log.dailyDistanceKm.toFixed(0)}km</Text>
            </View>
          ))}
        </View>

        <SectionTitle
          title="주유 기록"
          caption={`${fuelLogs.length}건`}
          action={
            <Pressable style={styles.addMiniButton} onPress={() => setFuelModalOpen(true)}>
              <Ionicons name="add" size={17} color="#2E6BFF" />
              <Text style={styles.addMiniText}>기록 추가</Text>
            </Pressable>
          }
        />
        <View style={[styles.logCard, dark && styles.darkCard]}>
          {[...fuelLogs].reverse().map((log, index) => (
            <View
              key={log.id}
              style={[styles.logRow, index < fuelLogs.length - 1 && styles.logRowBorder]}
            >
              <View style={styles.fuelIcon}>
                <Ionicons name="water-outline" size={20} color="#FF7A28" />
              </View>
              <View style={styles.flexOne}>
                <Text style={styles.logTitle}>{log.date} 주유</Text>
                <Text style={styles.logCaption}>
                  {log.liters.toFixed(1)}L · L당 {CURRENCY.format(Math.round(log.pricePerLiter))}원
                </Text>
              </View>
              <Text style={styles.logAmount}>-{money(log.amount)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal visible={mileageModalOpen} transparent animationType="slide" onRequestClose={() => setMileageModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, dark && styles.darkCard]}>
            <View style={styles.modalHandle} />
            <SectionTitle title="오늘 계기판 기록" caption={`이전 계기판 ${latestOdometer.toLocaleString()}km`} action={
              <Pressable onPress={() => setMileageModalOpen(false)}><Ionicons name="close" size={24} color="#65748B" /></Pressable>
            } />
            <LabeledInput label="현재 계기판 누적거리 (km)" value={odometer} keyboardType="numeric" onChangeText={setOdometer} placeholder="예: 82745" />
            <View style={styles.calculatedAmount}>
              <Text style={styles.calculatedLabel}>오늘 주행거리</Text>
              <Text style={styles.calculatedValue}>{Math.max(Number(odometer) - latestOdometer, 0).toFixed(0)}km</Text>
            </View>
            <Pressable style={styles.primaryButton} onPress={addMileage}><Text style={styles.primaryButtonText}>주행거리 저장</Text></Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={fuelModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFuelModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalSheet, dark && styles.darkCard]}>
            <View style={styles.modalHandle} />
            <SectionTitle
              title="주유 기록 추가"
              caption={`탱크 최대 ${settings.fuelTankCapacity}L`}
              action={
                <Pressable onPress={() => setFuelModalOpen(false)}>
                  <Ionicons name="close" size={24} color="#65748B" />
                </Pressable>
              }
            />
            <LabeledInput
              label="주유 시 계기판 누적거리 (km)"
              value={fuelOdometer}
              keyboardType="numeric"
              onChangeText={setFuelOdometer}
              placeholder={String(latestOdometer || 82745)}
            />
            <LabeledInput
              label="주유 총액 (원) *"
              value={amount}
              keyboardType="numeric"
              onChangeText={setAmount}
              placeholder="예: 50000"
            />
            <LabeledInput
              label="넣은 기름의 양 (L)"
              value={liters}
              keyboardType="numeric"
              onChangeText={setLiters}
              placeholder="예: 29.6"
            />
            <LabeledInput
              label="리터당 가격 (원)"
              value={price}
              keyboardType="numeric"
              onChangeText={setPrice}
              placeholder="예: 1690"
            />
            <View style={styles.calculatedAmount}>
              <Text style={styles.calculatedLabel}>자동 계산</Text>
              <Text style={styles.calculatedValue}>
                {calculatedLiters.toFixed(1)}L · L당 {CURRENCY.format(Math.round(calculatedPrice))}원
              </Text>
            </View>
            <View style={styles.tankGauge}>
              <View style={[styles.tankGaugeFill, { width: `${tankFillRatio}%` }]} />
            </View>
            <Text style={styles.tankGaugeText}>최대 탱크의 {tankFillRatio.toFixed(0)}% 주유</Text>
            <Pressable style={styles.primaryButton} onPress={addFuel}>
              <Text style={styles.primaryButtonText}>기록 저장</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={vehicleModalOpen} transparent animationType="slide" onRequestClose={() => setVehicleModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, dark && styles.darkCard]}>
            <View style={styles.modalHandle} />
            <SectionTitle title="업무 차량 등록" caption="차종별 탱크 용량을 등록하세요" action={
              <Pressable onPress={() => setVehicleModalOpen(false)}><Ionicons name="close" size={24} color="#65748B" /></Pressable>
            } />
            <LabeledInput label="차량 차종" value={vehicleModel} onChangeText={setVehicleModel} placeholder="예: 현대 포터2" />
            <LabeledInput label="연료탱크 최대 용량 (L)" value={tankCapacity} keyboardType="numeric" onChangeText={setTankCapacity} placeholder="예: 65" />
            <Pressable style={styles.primaryButton} onPress={() => {
              if (!vehicleModel || !Number(tankCapacity)) return Alert.alert('차량 정보 확인', '차종과 연료탱크 용량을 입력해주세요.');
              onUpdateVehicle(vehicleModel, Number(tankCapacity));
              setVehicleModalOpen(false);
            }}><Text style={styles.primaryButtonText}>차량 정보 저장</Text></Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function NumberSetting({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const dark = useDarkMode();
  return (
    <View style={styles.settingInputRow}>
      <Text style={[styles.settingInputLabel, dark && styles.darkText]}>{label}</Text>
      <View style={[styles.numberInputWrap, dark && styles.darkInput]}>
        <TextInput
          value={String(value)}
          keyboardType="numeric"
          onChangeText={(text) => onChange(Number(text.replace(/[^0-9.]/g, '')) || 0)}
          style={[styles.numberInput, dark && styles.darkText]}
        />
        <Text style={styles.numberUnit}>{unit}</Text>
      </View>
    </View>
  );
}

function SettingsScreen({
  settings,
  onSave,
  onResetData,
}: {
  settings: FeeSettings;
  onSave: (settings: FeeSettings) => void;
  onResetData: () => void;
}) {
  const [draft, setDraft] = useState(settings);
  const dark = useDarkMode();
  useEffect(() => setDraft(settings), [settings]);
  const updateDistrictFee = (district: string, value: number) =>
    setDraft((current) => ({
      ...current,
      districtFees: { ...current.districtFees, [district]: value },
    }));
  const setTheme = (themeMode: FeeSettings['themeMode']) => {
    const next = { ...draft, themeMode };
    setDraft(next);
    onSave(next);
  };

  const DistrictSection = ({
    title,
    caption,
    districts,
  }: {
    title: string;
    caption: string;
    districts: readonly string[];
  }) => (
    <View style={[styles.settingsCard, dark && styles.darkCard]}>
      <SectionTitle title={title} caption={caption} />
      {districts.map((district) => (
        <NumberSetting
          key={district}
          label={district}
          unit="원"
          value={draft.districtFees[district] ?? 15000}
          onChange={(value) => updateDistrictFee(district, value)}
        />
      ))}
    </View>
  );

  return (
    <ScrollView
      contentContainerStyle={styles.screenContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.settingsIntro, dark && styles.darkBlueInset]}>
        <View style={styles.settingsIntroIcon}>
          <Ionicons name="calculator-outline" size={23} color="#2E6BFF" />
        </View>
        <View style={styles.flexOne}>
          <Text style={styles.settingsIntroTitle}>내 운행 기준에 맞게 설정하세요</Text>
          <Text style={styles.settingsIntroText}>
            변경된 기준은 새 배달의 예상 수수료부터 적용됩니다.
          </Text>
        </View>
      </View>

      <View style={[styles.settingsCard, dark && styles.darkCard]}>
        <SectionTitle title="화면 테마" caption="앱 전체 표시 방식을 선택하세요" />
        <View style={styles.themeSelector}>
          {([
            ['light', 'sunny-outline', '라이트 모드'],
            ['dark', 'moon-outline', '다크 모드'],
          ] as const).map(([mode, icon, label]) => {
            const selected = draft.themeMode === mode;
            return (
              <Pressable
                key={mode}
                testID={`theme-${mode}`}
                style={[
                  styles.themeOption,
                  dark && styles.darkInset,
                  selected && styles.themeOptionSelected,
                ]}
                onPress={() => setTheme(mode)}
              >
                <Ionicons
                  name={icon}
                  size={21}
                  color={selected ? '#2E6BFF' : dark ? '#AAB8D0' : '#68768C'}
                />
                <Text
                  style={[
                    styles.themeOptionText,
                    dark && styles.darkText,
                    selected && styles.themeOptionTextSelected,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <DistrictSection
        title="서울시 지역별 배달 수수료"
        caption={`가나다순 · ${SEOUL_DISTRICTS.length}개 자치구`}
        districts={SEOUL_DISTRICTS}
      />
      <DistrictSection
        title="경기도 지역별 배달 수수료"
        caption={`가나다순 · ${GYEONGGI_DISTRICTS.length}개 시·군`}
        districts={GYEONGGI_DISTRICTS}
      />

      <View style={[styles.settingsCard, dark && styles.darkCard]}>
        <SectionTitle title="차량 정보" caption="주유 계산기에서 수정할 수 있습니다" />
        <View style={styles.vehicleRow}>
          <View style={styles.vehicleIcon}>
            <Ionicons name="car-sport" size={25} color="#2E6BFF" />
          </View>
          <View style={styles.flexOne}>
            <Text style={[styles.vehicleName, dark && styles.darkText]}>{draft.vehicleModel}</Text>
            <Text style={[styles.vehicleCaption, dark && styles.darkMutedText]}>
              연료탱크 최대 {draft.fuelTankCapacity}L · 계기판 기반 실측
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#AAB4C4" />
        </View>
      </View>

      <View style={[styles.settingsCard, dark && styles.darkCard]}>
        <SectionTitle title="연동 상태" />
        <View style={styles.integrationRow}>
          <View style={[styles.integrationIcon, { backgroundColor: '#FFE500' }]}>
            <Ionicons name="map" size={20} color="#2A2A2A" />
          </View>
          <View style={styles.flexOne}>
            <Text style={styles.integrationTitle}>카카오맵 API</Text>
            <Text style={styles.integrationCaption}>환경변수 키 입력 후 실주소 변환 사용</Text>
          </View>
          <View style={styles.readyBadge}>
            <Text style={styles.readyText}>연결 준비</Text>
          </View>
        </View>
        <View style={styles.integrationDivider} />
        <View style={styles.integrationRow}>
          <View style={[styles.integrationIcon, { backgroundColor: '#E7F8F2' }]}>
            <Ionicons name="scan" size={20} color="#10A37F" />
          </View>
          <View style={styles.flexOne}>
            <Text style={styles.integrationTitle}>OCR 엔진</Text>
            <Text style={styles.integrationCaption}>현재 데모 파서 · 클라우드 OCR 교체 가능</Text>
          </View>
          <View style={styles.demoBadge}>
            <Text style={styles.demoText}>데모</Text>
          </View>
        </View>
      </View>

      <Pressable
        style={styles.primaryButton}
        onPress={() => {
          onSave(draft);
          Alert.alert('저장 완료', '56개 지역 수수료와 차량 설정이 저장되었습니다.');
        }}
      >
        <Ionicons name="save-outline" size={20} color="#FFFFFF" />
        <Text style={styles.primaryButtonText}>설정 저장</Text>
      </Pressable>

      <Pressable
        style={styles.resetButton}
        onPress={() =>
          Alert.alert('샘플 데이터 초기화', '등록된 배달과 주유 기록을 초기 상태로 되돌릴까요?', [
            { text: '취소', style: 'cancel' },
            { text: '초기화', style: 'destructive', onPress: onResetData },
          ])
        }
      >
        <Text style={styles.resetButtonText}>샘플 데이터 초기화</Text>
      </Pressable>

      <Text style={styles.versionText}>RouteLO v1.0.0 · Local-first MVP</Text>
    </ScrollView>
  );
}

export default function RouteloApp() {
  const [activeTab, setActiveTab] = useState<TabKey>('deliveries');
  const [deliveries, setDeliveries] = useState<Delivery[]>(SAMPLE_DELIVERIES);
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>(SAMPLE_FUEL_LOGS);
  const [mileageLogs, setMileageLogs] = useState<MileageLog[]>(SAMPLE_MILEAGE_LOGS);
  const [settings, setSettings] = useState<FeeSettings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (!value) return;
        const parsed = JSON.parse(value);
        if (parsed.deliveries) {
          setDeliveries(
            parsed.deliveries.map((delivery: Delivery) => ({
              ...delivery,
              productQuantity: delivery.productQuantity || 1,
              eventTime:
                delivery.eventTime ||
                (delivery.productName?.includes('축하') ? '11:00' : ''),
            })),
          );
        }
        if (parsed.fuelLogs) {
          setFuelLogs(parsed.fuelLogs.map((log: FuelLog & { distanceKm?: number }) => ({
            ...log,
            odometerKm: log.odometerKm || 0,
          })));
        }
        if (parsed.mileageLogs) setMileageLogs(parsed.mileageLogs);
        if (parsed.settings) {
          setSettings({
            ...DEFAULT_SETTINGS,
            ...parsed.settings,
            districtFees: {
              ...DEFAULT_SETTINGS.districtFees,
              ...(parsed.settings.districtFees || {}),
            },
          });
        }
      })
      .catch(() => undefined)
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ deliveries, fuelLogs, mileageLogs, settings }),
    ).catch(() => undefined);
  }, [deliveries, fuelLogs, mileageLogs, settings, hydrated]);

  const toggleDelivery = (id: string) => {
    setDeliveries((current) =>
      current.map((delivery) =>
        delivery.id === id
          ? {
              ...delivery,
              status: delivery.status === 'pending' ? 'completed' : 'pending',
            }
          : delivery,
      ),
    );
  };

  const registerOcr = async (form: OcrForm, imageUri?: string) => {
    const coordinate = await geocodeAddress(form.deliveryAddress);
    const mockDistance = 3 + ((form.deliveryAddress.length * 7) % 230) / 10;
    const delivery: Delivery = {
      id: `delivery-${Date.now()}`,
      orderVendor: form.orderVendor,
      orderVendorTel: form.orderVendorTel,
      deliveryVendor: form.deliveryVendor,
      deliveryVendorTel: form.deliveryVendorTel,
      productName: form.productName,
      productQuantity: Math.max(Number(form.productQuantity) || 1, 1),
      eventTime: form.eventTime,
      deliveryDt: form.deliveryDt,
      deliveryAddress: form.deliveryAddress,
      customerRequests: form.customerRequests,
      recipientTel: form.recipientTel,
      status: 'pending',
      distanceKm: mockDistance,
      fee: calculateFeeByAddress(form.deliveryAddress, settings),
      imageUri,
      ...coordinate,
    };
    setDeliveries((current) => [delivery, ...current]);
    setActiveTab('deliveries');
  };

  const resetData = () => {
    setDeliveries(SAMPLE_DELIVERIES);
    setFuelLogs(SAMPLE_FUEL_LOGS);
    setMileageLogs(SAMPLE_MILEAGE_LOGS);
    setSettings(DEFAULT_SETTINGS);
  };

  const screen = useMemo(() => {
    switch (activeTab) {
      case 'ocr':
        return <OcrScreen onRegister={registerOcr} />;
      case 'route':
        return <RouteScreen deliveries={deliveries} onToggle={toggleDelivery} />;
      case 'finance':
        return (
          <FinanceScreen
            deliveries={deliveries}
            fuelLogs={fuelLogs}
            mileageLogs={mileageLogs}
            settings={settings}
            onAddFuel={(log) => setFuelLogs((current) => [...current, log])}
            onAddMileage={(log) => setMileageLogs((current) => [...current, log])}
            onUpdateVehicle={(vehicleModel, fuelTankCapacity) =>
              setSettings((current) => ({ ...current, vehicleModel, fuelTankCapacity }))
            }
          />
        );
      case 'settings':
        return (
          <SettingsScreen
            settings={settings}
            onSave={setSettings}
            onResetData={resetData}
          />
        );
      default:
        return (
          <DeliveryListScreen
            deliveries={deliveries}
            onToggle={toggleDelivery}
            onGoOcr={() => setActiveTab('ocr')}
          />
        );
    }
  }, [activeTab, deliveries, fuelLogs, mileageLogs, settings]);

  const dark = settings.themeMode === 'dark';

  return (
    <ThemeContext.Provider value={dark}>
    <SafeAreaView style={[styles.app, dark && styles.darkApp]}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <AppHeader activeTab={activeTab} />
      <View style={[styles.content, dark && styles.darkApp]}>{screen}</View>
      <View style={[styles.bottomNav, dark && styles.darkSurface]}>
        {tabs.map((tab) => {
          const active = tab.key === activeTab;
          const isScan = tab.key === 'ocr';
          return (
            <Pressable
              key={tab.key}
              testID={`nav-${tab.key}`}
              style={styles.navItem}
              onPress={() => setActiveTab(tab.key)}
            >
              <View
                style={[
                  styles.navIconWrap,
                  isScan && styles.scanNavIcon,
                  isScan && active && styles.scanNavIconActive,
                ]}
              >
                <Ionicons
                  name={(active ? tab.activeIcon : tab.icon) as never}
                  size={22}
                  color={active ? '#2E6BFF' : dark ? '#AAB8D0' : '#8793A5'}
                />
              </View>
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
    </ThemeContext.Provider>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: '#F6F8FC' },
  flexOne: { flex: 1 },
  content: { flex: 1 },
  screenContent: { paddingHorizontal: 18, paddingBottom: 34 },
  header: {
    minHeight: 76,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 12 : 4,
    paddingBottom: 10,
    backgroundColor: '#F6F8FC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: { color: '#7A8799', fontSize: 12, fontWeight: '600', marginBottom: 3 },
  pageTitle: { color: '#16213A', fontSize: 25, fontWeight: '800', letterSpacing: -0.6 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#EAF7F2',
  },
  syncDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10A37F' },
  syncText: { fontSize: 11, fontWeight: '700', color: '#087F5B' },
  profileButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E9EFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    borderRadius: 24,
    padding: 22,
    paddingBottom: 17,
    minHeight: 210,
    marginTop: 5,
    overflow: 'hidden',
  },
  heroEyebrow: { color: '#BFD0FF', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '800',
    marginTop: 9,
    letterSpacing: -0.7,
  },
  heroCircle: {
    position: 'absolute',
    right: 22,
    top: 26,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255,255,255,0.17)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMetrics: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.22)',
    paddingTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroMetric: { flex: 1 },
  heroMetricValue: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  heroMetricLabel: { color: '#C9D7FA', fontSize: 11, marginTop: 3 },
  heroDivider: { width: 1, height: 29, backgroundColor: 'rgba(255,255,255,0.22)', marginRight: 15 },
  quickStats: { flexDirection: 'row', gap: 10, marginTop: 12 },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: '#EBEEF4',
  },
  statCardDark: { backgroundColor: '#192747' },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statLabel: { color: '#7A8799', fontSize: 11, fontWeight: '600' },
  statValue: { color: '#17213A', fontSize: 19, fontWeight: '800', marginTop: 3 },
  textMutedOnDark: { color: '#AFC0E1' },
  textOnDark: { color: '#FFFFFF' },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 26,
    marginBottom: 12,
  },
  sectionTitleWrap: { flexShrink: 1 },
  sectionTitle: { color: '#17213A', fontSize: 18, fontWeight: '800', letterSpacing: -0.35 },
  sectionCaption: { color: '#8A96A8', fontSize: 11, marginTop: 3 },
  addMiniButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EDF2FF',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  addMiniText: { color: '#2E6BFF', fontSize: 11, fontWeight: '700' },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#E9EDF4',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  segmentButton: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 9 },
  segmentButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#334155',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  segmentButtonText: { color: '#7B8797', fontWeight: '700', fontSize: 12 },
  segmentButtonTextActive: { color: '#253451' },
  deliveryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    padding: 17,
    marginBottom: 11,
    borderWidth: 1,
    borderColor: '#E9EDF3',
  },
  deliveryCardCompleted: { opacity: 0.72, backgroundColor: '#F9FAFC' },
  deliveryCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  deliveryTimeWrap: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  deliveryTime: { color: '#2E6BFF', fontSize: 13, fontWeight: '800' },
  deliveryVendor: { color: '#8995A6', fontSize: 11, marginTop: 2 },
  statusChip: {
    backgroundColor: '#FFF1E7',
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusChipCompleted: { backgroundColor: '#E8F7F1' },
  statusChipText: { color: '#E46F20', fontSize: 10, fontWeight: '800' },
  statusChipTextCompleted: { color: '#087F5B' },
  productName: { color: '#17213A', fontSize: 17, fontWeight: '800', marginTop: 13, marginBottom: 9 },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  quantityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EDF2FF',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9,
  },
  quantityLabel: { color: '#71809A', fontSize: 9, fontWeight: '700' },
  quantityValue: { color: '#2E6BFF', fontSize: 12, fontWeight: '800' },
  eventTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF0F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  eventTimeLabel: { color: '#A84444', fontSize: 10, fontWeight: '700' },
  eventTimeValue: { color: '#E03131', fontSize: 16, fontWeight: '900' },
  eventTimeWarning: { color: '#E03131', fontSize: 9, fontWeight: '800', marginLeft: 'auto' },
  vendorPanel: {
    backgroundColor: '#F7F9FC',
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 9,
    marginBottom: 10,
  },
  vendorLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  vendorType: {
    width: 47,
    color: '#68768C',
    fontSize: 9,
    fontWeight: '800',
    backgroundColor: '#E9EDF4',
    paddingVertical: 4,
    textAlign: 'center',
    borderRadius: 6,
  },
  vendorName: { color: '#253149', fontSize: 11, fontWeight: '800' },
  vendorTel: { color: '#7B8799', fontSize: 10, marginTop: 2 },
  vendorDivider: { height: 1, backgroundColor: '#E5EAF1', marginVertical: 8 },
  infoLine: { flexDirection: 'row', gap: 7, alignItems: 'center', marginTop: 5 },
  infoText: { flex: 1, color: '#5F6D82', fontSize: 12, lineHeight: 18 },
  deliveryFooter: {
    borderTopWidth: 1,
    borderTopColor: '#EEF1F5',
    marginTop: 14,
    paddingTop: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  feeWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 7 },
  distanceText: { color: '#8A96A8', fontSize: 11 },
  feeText: { color: '#17213A', fontSize: 15, fontWeight: '800' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  iconButton: {
    width: 35,
    height: 35,
    borderRadius: 10,
    backgroundColor: '#EDF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButton: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    backgroundColor: '#2E6BFF',
    borderRadius: 10,
    paddingHorizontal: 11,
    height: 35,
  },
  completeButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  undoButton: { backgroundColor: '#EDF2FF' },
  undoButtonText: { color: '#2E6BFF' },
  routeNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E6BFF',
  },
  routeNumberText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  emptyState: { alignItems: 'center', paddingVertical: 45 },
  emptyTitle: { color: '#34415A', fontSize: 15, fontWeight: '800', marginTop: 12 },
  emptyCaption: { color: '#8A96A8', fontSize: 12, marginTop: 5, textAlign: 'center' },
  ocrIntro: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#EAF0FF',
    borderRadius: 16,
    marginTop: 5,
    marginBottom: 16,
  },
  ocrIntroIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ocrIntroTitle: { color: '#1E335E', fontSize: 14, fontWeight: '800' },
  ocrIntroText: { color: '#637598', fontSize: 11, lineHeight: 17, marginTop: 3 },
  scanner: {
    height: 350,
    borderRadius: 24,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#AFC1ED',
    backgroundColor: '#F0F4FC',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  scanCorner: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderColor: '#2E6BFF',
  },
  scanCornerTL: { left: 25, top: 25, borderLeftWidth: 3, borderTopWidth: 3, borderTopLeftRadius: 8 },
  scanCornerTR: { right: 25, top: 25, borderRightWidth: 3, borderTopWidth: 3, borderTopRightRadius: 8 },
  scanCornerBL: { left: 25, bottom: 25, borderLeftWidth: 3, borderBottomWidth: 3, borderBottomLeftRadius: 8 },
  scanCornerBR: { right: 25, bottom: 25, borderRightWidth: 3, borderBottomWidth: 3, borderBottomRightRadius: 8 },
  cameraCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 17,
  },
  scannerTitle: { color: '#2A3853', fontSize: 15, fontWeight: '800' },
  scannerCaption: { color: '#8794A8', fontSize: 11, marginTop: 6 },
  receiptImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  receiptThumb: { width: '100%', height: 130, borderRadius: 14, marginTop: 12 },
  processingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(26,42,72,0.77)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  processingText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  primaryButton: {
    minHeight: 52,
    borderRadius: 15,
    backgroundColor: '#2E6BFF',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  secondaryButton: {
    minHeight: 50,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#C9D4EB',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 9,
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: { color: '#2E6BFF', fontSize: 14, fontWeight: '800' },
  tipCard: {
    marginTop: 18,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#FFF6ED',
    flexDirection: 'row',
    gap: 10,
  },
  tipTitle: { color: '#9A541E', fontSize: 12, fontWeight: '800' },
  tipText: { color: '#A66C40', fontSize: 11, lineHeight: 16, marginTop: 3 },
  reviewStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderRadius: 16,
    backgroundColor: '#E9F7F2',
    padding: 14,
    marginTop: 5,
  },
  reviewCheck: {
    width: 35,
    height: 35,
    borderRadius: 18,
    backgroundColor: '#10A37F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewTitle: { color: '#176B56', fontSize: 13, fontWeight: '800' },
  reviewCaption: { color: '#5D887D', fontSize: 10, marginTop: 3 },
  retakeText: { color: '#2E6BFF', fontSize: 11, fontWeight: '800' },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E9EDF3',
  },
  twoColumns: { flexDirection: 'row', gap: 10 },
  halfInput: { flex: 1 },
  quantityInputColumn: { width: 105 },
  inputGroup: { marginBottom: 13 },
  inputLabel: { color: '#556278', fontSize: 11, fontWeight: '700', marginBottom: 6 },
  textInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#DCE2EC',
    backgroundColor: '#FAFBFD',
    borderRadius: 11,
    paddingHorizontal: 12,
    color: '#1D2941',
    fontSize: 13,
  },
  multilineInput: { minHeight: 80, paddingTop: 12, textAlignVertical: 'top' },
  mapCard: {
    height: 330,
    borderRadius: 23,
    overflow: 'hidden',
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#E1E6EE',
    backgroundColor: '#E8ECE5',
  },
  mapBackground: { flex: 1, backgroundColor: '#E9EDE5', overflow: 'hidden' },
  road: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE2D8',
    borderRadius: 20,
  },
  roadOne: { width: '130%', height: 26, left: '-15%', top: '44%', transform: [{ rotate: '-18deg' }] },
  roadTwo: { width: 25, height: '130%', left: '47%', top: '-15%', transform: [{ rotate: '12deg' }] },
  roadThree: { width: '90%', height: 15, left: '8%', top: '23%', transform: [{ rotate: '7deg' }] },
  roadFour: { width: 13, height: '90%', left: '72%', top: '11%', transform: [{ rotate: '-29deg' }] },
  parkShape: {
    position: 'absolute',
    width: 120,
    height: 75,
    borderRadius: 40,
    backgroundColor: '#D6E7D0',
    left: -20,
    bottom: 20,
    transform: [{ rotate: '-20deg' }],
  },
  riverShape: {
    position: 'absolute',
    width: 50,
    height: 430,
    backgroundColor: '#CFE6EF',
    right: -2,
    top: -35,
    transform: [{ rotate: '17deg' }],
  },
  currentMarker: {
    position: 'absolute',
    left: '44%',
    bottom: '16%',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(46,107,255,0.23)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentMarkerInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2E6BFF', borderWidth: 2, borderColor: '#FFFFFF' },
  mapMarkerWrap: { position: 'absolute', alignItems: 'center' },
  mapMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2E6BFF',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1C376F',
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
  },
  mapMarkerText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  mapMarkerTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#2E6BFF',
    marginTop: -2,
  },
  mapBrand: {
    position: 'absolute',
    left: 10,
    bottom: 9,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  mapBrandText: { color: '#566274', fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  myLocationButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#334155',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  routeSummary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E9EDF3',
  },
  optimizedRow: { flexDirection: 'row', marginBottom: 7 },
  optimizedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: '#E7F7F1',
  },
  optimizedText: { color: '#087F5B', fontSize: 9, fontWeight: '800' },
  routeSummaryTitle: { color: '#17213A', fontSize: 15, fontWeight: '800' },
  routeSummaryCaption: { color: '#7D899B', fontSize: 11, marginTop: 4 },
  optimizeButton: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    borderRadius: 11,
    backgroundColor: '#2E6BFF',
    paddingHorizontal: 11,
    height: 39,
  },
  optimizeButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  routeLine: { position: 'relative' },
  routeItemWrap: { position: 'relative' },
  routeConnector: {
    position: 'absolute',
    left: 31,
    top: 37,
    width: 2,
    height: '100%',
    backgroundColor: '#C8D6F7',
    zIndex: 2,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#E9EDF4',
    borderRadius: 13,
    padding: 4,
    marginTop: 5,
    marginBottom: 13,
  },
  periodButton: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  periodButtonActive: { backgroundColor: '#FFFFFF' },
  periodButtonText: { color: '#7D899B', fontSize: 11, fontWeight: '700' },
  periodButtonTextActive: { color: '#26334D', fontWeight: '800' },
  profitCard: { borderRadius: 23, padding: 21, overflow: 'hidden' },
  vehicleSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 15,
    marginBottom: 13,
    borderWidth: 1,
    borderColor: '#E9EDF3',
  },
  vehicleSummaryTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  vehicleEditButton: {
    backgroundColor: '#EDF2FF',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  vehicleEditText: { color: '#2E6BFF', fontSize: 10, fontWeight: '800' },
  profitLabel: { color: '#AFC0E1', fontSize: 12, fontWeight: '600' },
  profitValue: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', marginTop: 7, letterSpacing: -0.8 },
  profitChange: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  profitChangeText: { color: '#6EE7B7', fontSize: 11, fontWeight: '700' },
  profitBreakdown: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    paddingTop: 15,
    marginTop: 20,
  },
  breakdownLabel: { color: '#94A7CB', fontSize: 10 },
  breakdownValue: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginTop: 4 },
  breakdownDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 30 },
  chartCard: {
    marginTop: 13,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 17,
    borderWidth: 1,
    borderColor: '#E9EDF3',
  },
  financeActions: { flexDirection: 'row', gap: 10, marginTop: 13 },
  mileageAction: {
    flex: 1,
    minHeight: 76,
    borderRadius: 16,
    backgroundColor: '#EDF2FF',
    padding: 13,
    gap: 8,
  },
  fuelAction: {
    flex: 1,
    minHeight: 76,
    borderRadius: 16,
    backgroundColor: '#FFF1E7',
    padding: 13,
    gap: 8,
  },
  financeActionTitle: { color: '#26334D', fontSize: 12, fontWeight: '800' },
  financeActionCaption: { color: '#7D899B', fontSize: 9, marginTop: 2 },
  chartLegend: { flexDirection: 'row', justifyContent: 'flex-end', gap: 14, marginTop: -5 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { color: '#7D899B', fontSize: 9 },
  chart: { height: 160, flexDirection: 'row', alignItems: 'flex-end', gap: 20, paddingTop: 20 },
  chartColumn: { flex: 1, alignItems: 'center', height: '100%' },
  bars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 5 },
  bar: { width: 12, minHeight: 5, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  chartLabel: { color: '#8995A6', fontSize: 9, marginTop: 7 },
  logCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#E9EDF3',
  },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 14 },
  logRowBorder: { borderBottomWidth: 1, borderBottomColor: '#EEF1F5' },
  fuelIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFF1E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logTitle: { color: '#26334D', fontSize: 12, fontWeight: '800' },
  logCaption: { color: '#8995A6', fontSize: 9, marginTop: 3 },
  logAmount: { color: '#E46F20', fontSize: 12, fontWeight: '800' },
  mileageAmount: { color: '#2E6BFF', fontSize: 13, fontWeight: '800' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.45)' },
  modalSheet: {
    backgroundColor: '#F8F9FC',
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  modalHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#CCD3DE', alignSelf: 'center', marginTop: 10 },
  calculatedAmount: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EAF0FF',
    padding: 14,
    borderRadius: 12,
  },
  calculatedLabel: { color: '#637598', fontSize: 11, fontWeight: '700' },
  calculatedValue: { color: '#2E6BFF', fontSize: 16, fontWeight: '800' },
  tankGauge: {
    height: 9,
    borderRadius: 5,
    backgroundColor: '#E3E8F0',
    overflow: 'hidden',
    marginTop: 13,
  },
  tankGaugeFill: { height: '100%', borderRadius: 5, backgroundColor: '#2E6BFF' },
  tankGaugeText: { color: '#7D899B', fontSize: 10, textAlign: 'right', marginTop: 5 },
  settingsIntro: {
    marginTop: 5,
    backgroundColor: '#EAF0FF',
    borderRadius: 17,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsIntroIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIntroTitle: { color: '#1F3766', fontSize: 13, fontWeight: '800' },
  settingsIntroText: { color: '#64769A', fontSize: 10, lineHeight: 15, marginTop: 3 },
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 17,
    borderWidth: 1,
    borderColor: '#E9EDF3',
    marginTop: 13,
  },
  themeSelector: { flexDirection: 'row', gap: 9 },
  themeOption: {
    flex: 1,
    minHeight: 54,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#DDE3EC',
    backgroundColor: '#F8FAFD',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  themeOptionSelected: { borderColor: '#2E6BFF', backgroundColor: '#EDF2FF' },
  themeOptionText: { color: '#68768C', fontSize: 11, fontWeight: '700' },
  themeOptionTextSelected: { color: '#2E6BFF', fontWeight: '800' },
  settingInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F6',
  },
  settingInputLabel: { color: '#536076', fontSize: 12, fontWeight: '600' },
  numberInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DCE2EC',
    borderRadius: 10,
    height: 39,
    paddingRight: 10,
    backgroundColor: '#FAFBFD',
  },
  numberInput: { width: 88, height: 39, textAlign: 'right', paddingHorizontal: 10, color: '#1D2941', fontSize: 13, fontWeight: '700' },
  numberUnit: { color: '#8995A6', fontSize: 10 },
  feeExample: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 10,
    backgroundColor: '#EEF3FF',
    padding: 11,
    marginTop: 12,
  },
  feeExampleText: { color: '#5570A6', fontSize: 10, flex: 1 },
  vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 9 },
  vehicleIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EDF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleName: { color: '#26334D', fontSize: 13, fontWeight: '800' },
  vehicleCaption: { color: '#8995A6', fontSize: 10, marginTop: 3 },
  integrationRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 5 },
  integrationIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  integrationTitle: { color: '#26334D', fontSize: 12, fontWeight: '800' },
  integrationCaption: { color: '#8995A6', fontSize: 9, marginTop: 3 },
  integrationDivider: { height: 1, backgroundColor: '#EEF1F5', marginVertical: 10 },
  readyBadge: { backgroundColor: '#FFF6D8', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  readyText: { color: '#A06A00', fontSize: 9, fontWeight: '800' },
  demoBadge: { backgroundColor: '#E8F7F1', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  demoText: { color: '#087F5B', fontSize: 9, fontWeight: '800' },
  resetButton: { alignItems: 'center', paddingVertical: 15 },
  resetButtonText: { color: '#D24F4F', fontSize: 12, fontWeight: '700' },
  versionText: { textAlign: 'center', color: '#A0AABA', fontSize: 9, marginBottom: 5 },
  bottomNav: {
    minHeight: 72,
    paddingTop: 7,
    paddingBottom: Platform.OS === 'ios' ? 3 : 7,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E7EBF1',
    flexDirection: 'row',
  },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navIconWrap: { height: 31, alignItems: 'center', justifyContent: 'center' },
  scanNavIcon: {
    width: 31,
    height: 31,
    backgroundColor: 'transparent',
    marginTop: 0,
  },
  scanNavIconActive: { backgroundColor: 'transparent' },
  navLabel: { color: '#8793A5', fontSize: 9, fontWeight: '600', marginTop: 2 },
  navLabelActive: { color: '#2E6BFF', fontWeight: '800' },
  darkApp: { backgroundColor: '#0F1726' },
  darkSurface: { backgroundColor: '#151F31', borderColor: '#26344B' },
  darkCard: { backgroundColor: '#182337', borderColor: '#293850' },
  darkInset: { backgroundColor: '#111B2C', borderColor: '#31405A' },
  darkBlueInset: { backgroundColor: '#1A2C4E' },
  darkInput: { backgroundColor: '#111B2C', borderColor: '#33425B', color: '#EEF4FF' },
  darkText: { color: '#F1F5FC' },
  darkMutedText: { color: '#AAB8D0' },
});
