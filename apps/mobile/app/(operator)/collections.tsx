import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getCollections,
  getOperatorProperties,
  recordPayment,
  type CollectionCycle,
  type PaymentMethod,
  type PaymentType,
} from '../../src/lib/operator-api';
import { useAsync } from '../../src/lib/hooks';
import { formatCurrency, formatDate, formatMonth } from '../../src/lib/format';
import { colors } from '../../src/theme';

const STATUS_FILTERS = ['ALL', 'PENDING', 'DUE', 'PARTIAL', 'OVERDUE', 'PAID', 'WAIVED'];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Pending', color: colors.yellowText, bg: colors.yellowBg },
  DUE:     { label: 'Due',     color: colors.yellowText, bg: colors.yellowBg },
  PARTIAL: { label: 'Partial', color: colors.blueText,   bg: colors.blueBg },
  PAID:    { label: 'Paid',    color: colors.greenText,  bg: colors.greenBg },
  OVERDUE: { label: 'Overdue', color: colors.redText,    bg: colors.redBg },
  WAIVED:  { label: 'Waived',  color: colors.gray500,    bg: colors.gray100 },
};

const METHODS: PaymentMethod[] = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'ONLINE'];
const TYPES: { value: PaymentType; label: string }[] = [
  { value: 'RENT', label: 'Rent' },
  { value: 'DEPOSIT', label: 'Deposit' },
  { value: 'FINE', label: 'Fine' },
  { value: 'MISCELLANEOUS', label: 'Misc.' },
];

function activeAllocation(cycle: CollectionCycle) {
  return cycle.tenant.allocations.find((a) => a.isActive) ?? cycle.tenant.allocations[0];
}

function CycleCard({
  cycle,
  onRecord,
}: {
  cycle: CollectionCycle;
  onRecord: () => void;
}) {
  const cfg = STATUS_CONFIG[cycle.status] ?? { label: cycle.status, color: colors.gray500, bg: colors.gray100 };
  const alloc = activeAllocation(cycle);
  const pct = cycle.rentAmount > 0 ? Math.min(100, (cycle.paidAmount / cycle.rentAmount) * 100) : 0;
  const canPay = cycle.status !== 'PAID' && cycle.status !== 'WAIVED';

  return (
    <View style={[styles.card, cycle.status === 'OVERDUE' && styles.overdueCard]}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.tenantName} numberOfLines={1}>{cycle.tenant.user.name}</Text>
          <Text style={styles.tenantSub}>
            {cycle.tenant.tenantCode}
            {alloc ? ` · Room ${alloc.bed.room.number} · Bed ${alloc.bed.label}` : ''}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
          <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${pct}%` as `${number}%`,
              backgroundColor: cycle.status === 'OVERDUE' ? colors.red500 : colors.primary,
            },
          ]}
        />
      </View>

      <View style={styles.amountsRow}>
        <AmountCell label="Expected" value={formatCurrency(cycle.rentAmount)} />
        <View style={styles.amountDivider} />
        <AmountCell label="Paid" value={formatCurrency(cycle.paidAmount)} valueColor={colors.green500} />
        {cycle.remainingAmount > 0 && (
          <>
            <View style={styles.amountDivider} />
            <AmountCell label="Due" value={formatCurrency(cycle.remainingAmount)} valueColor={colors.red500} />
          </>
        )}
      </View>

      {canPay && (
        <TouchableOpacity style={styles.recordBtn} onPress={onRecord} activeOpacity={0.85}>
          <Ionicons name="add-circle-outline" size={15} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.recordBtnText}>Record Payment</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function AmountCell({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.amountCell}>
      <Text style={styles.amountLabel}>{label}</Text>
      <Text style={[styles.amountValue, valueColor ? { color: valueColor } : {}]}>{value}</Text>
    </View>
  );
}

function RecordPaymentModal({
  cycle,
  visible,
  onClose,
  onSuccess,
}: {
  cycle: CollectionCycle | null;
  visible: boolean;
  onClose: () => void;
  onSuccess: (receiptNo: string) => void;
}) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [type, setType] = useState<PaymentType>('RENT');
  const [refNo, setRefNo] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setAmount('');
    setMethod('CASH');
    setType('RENT');
    setRefNo('');
    setNotes('');
  };

  const submit = async () => {
    if (!cycle) return;
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await recordPayment({
        tenantId: cycle.tenantId,
        rentCycleId: cycle.id,
        amount: parsed,
        type,
        method,
        referenceNo: refNo.trim() || undefined,
        notes: notes.trim() || undefined,
        paidAt: new Date().toISOString(),
      });
      reset();
      onSuccess(result.receiptNo);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!cycle) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={pmModal.container}>
          <View style={pmModal.header}>
            <TouchableOpacity onPress={() => { onClose(); reset(); }}>
              <Text style={pmModal.cancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={pmModal.title}>Record Payment</Text>
            <TouchableOpacity
              onPress={submit}
              disabled={submitting}
              style={[pmModal.submitBtn, submitting && { opacity: 0.5 }]}
            >
              {submitting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={pmModal.submitText}>Save</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={pmModal.body} keyboardShouldPersistTaps="handled">
            {/* Context */}
            <View style={pmModal.context}>
              <Text style={pmModal.contextName}>{cycle.tenant.user.name}</Text>
              <Text style={pmModal.contextSub}>
                {formatMonth(cycle.month, cycle.year)} · Remaining: {formatCurrency(cycle.remainingAmount)}
              </Text>
            </View>

            {/* Amount */}
            <Text style={pmModal.label}>Amount <Text style={pmModal.required}>*</Text></Text>
            <TextInput
              style={pmModal.input}
              value={amount}
              onChangeText={setAmount}
              placeholder={`Max ${formatCurrency(cycle.remainingAmount)}`}
              placeholderTextColor={colors.gray400}
              keyboardType="numeric"
              returnKeyType="next"
            />

            {/* Type */}
            <Text style={[pmModal.label, { marginTop: 16 }]}>Payment Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={pmModal.chipScroll}>
              {TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  onPress={() => setType(t.value)}
                  style={[pmModal.chip, type === t.value && pmModal.chipActive]}
                >
                  <Text style={[pmModal.chipText, type === t.value && pmModal.chipTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Method */}
            <Text style={[pmModal.label, { marginTop: 16 }]}>Payment Method</Text>
            <View style={pmModal.methodGrid}>
              {METHODS.map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setMethod(m)}
                  style={[pmModal.methodBtn, m === method && pmModal.methodBtnActive]}
                >
                  <Text style={[pmModal.methodText, m === method && pmModal.methodTextActive]}>
                    {m.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Reference */}
            <Text style={[pmModal.label, { marginTop: 16 }]}>Reference No. (optional)</Text>
            <TextInput
              style={pmModal.input}
              value={refNo}
              onChangeText={setRefNo}
              placeholder="UPI ID, cheque no., etc."
              placeholderTextColor={colors.gray400}
            />

            {/* Notes */}
            <Text style={[pmModal.label, { marginTop: 16 }]}>Notes (optional)</Text>
            <TextInput
              style={[pmModal.input, { minHeight: 70, paddingTop: 10 }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any additional notes…"
              placeholderTextColor={colors.gray400}
              multiline
              textAlignVertical="top"
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function CollectionsScreen() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [propertyId, setPropertyId] = useState('');
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [activeCycle, setActiveCycle] = useState<CollectionCycle | null>(null);

  useAsync(
    useCallback(async () => {
      const props = await getOperatorProperties();
      setProperties(props);
      const [first] = props;
      if (first && !propertyId) setPropertyId(first.id);
      return props;
    }, []),
    [],
  );

  const { data, loading, error, refetch } = useAsync(
    useCallback(
      () =>
        propertyId
          ? getCollections({ propertyId, month, year, status: statusFilter })
          : Promise.resolve(null),
      [propertyId, month, year, statusFilter],
    ),
    [propertyId, month, year, statusFilter],
  );

  const cycles = data?.cycles ?? [];
  const summary = data?.summary;

  const shiftMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y += 1; }
    if (m < 1)  { m = 12; y -= 1; }
    setMonth(m);
    setYear(y);
  };

  const handlePaymentSuccess = (receiptNo: string) => {
    setActiveCycle(null);
    Alert.alert('Payment Recorded', `Receipt: ${receiptNo}`, [{ text: 'OK', onPress: refetch }]);
  };

  const collPct = summary && summary.totalExpected > 0
    ? Math.min(100, (summary.totalCollected / summary.totalExpected) * 100)
    : 0;

  return (
    <View style={styles.container}>
      {/* Property picker */}
      {properties.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.propScroll}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 8 }}
        >
          {properties.map((p) => (
            <TouchableOpacity
              key={p.id}
              onPress={() => setPropertyId(p.id)}
              style={[styles.propChip, p.id === propertyId && styles.propChipActive]}
            >
              <Text style={[styles.propChipText, p.id === propertyId && styles.propChipTextActive]}>
                {p.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Month selector */}
      <View style={styles.monthSelector}>
        <TouchableOpacity onPress={() => shiftMonth(-1)} style={styles.monthArrow}>
          <Ionicons name="chevron-back" size={20} color={colors.gray600} />
        </TouchableOpacity>
        <Text style={styles.monthText}>{formatMonth(month, year)}</Text>
        <TouchableOpacity onPress={() => shiftMonth(1)} style={styles.monthArrow}>
          <Ionicons name="chevron-forward" size={20} color={colors.gray600} />
        </TouchableOpacity>
      </View>

      {/* Summary banner */}
      {summary && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryTrack}>
            <View
              style={[styles.summaryFill, { width: `${collPct}%` as `${number}%` }]}
            />
          </View>
          <View style={styles.summaryRow}>
            <SummaryCell label="Expected" value={formatCurrency(summary.totalExpected)} />
            <SummaryCell label="Collected" value={formatCurrency(summary.totalCollected)} valueColor={colors.green600} />
            <SummaryCell label="Remaining" value={formatCurrency(summary.totalRemaining)} valueColor={summary.totalRemaining > 0 ? colors.red500 : colors.gray400} />
          </View>
          <Text style={styles.collRate}>{Math.round(collPct)}% collected</Text>
        </View>
      )}

      {/* Status filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
      >
        {STATUS_FILTERS.map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => setStatusFilter(s)}
            style={[styles.filterChip, s === statusFilter && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, s === statusFilter && styles.filterChipTextActive]}>
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading && !data && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={refetch} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={cycles}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <CycleCard cycle={item} onRecord={() => setActiveCycle(item)} />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={loading && !!data}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyBox}>
              <Ionicons name="wallet-outline" size={44} color={colors.gray300} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>No rent cycles</Text>
              <Text style={styles.emptyText}>No cycles found for this filter.</Text>
            </View>
          ) : null
        }
      />

      <RecordPaymentModal
        cycle={activeCycle}
        visible={!!activeCycle}
        onClose={() => setActiveCycle(null)}
        onSuccess={handlePaymentSuccess}
      />
    </View>
  );
}

function SummaryCell({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, valueColor ? { color: valueColor } : {}]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { paddingVertical: 48, alignItems: 'center' },

  propScroll: {},
  propChip: {
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  propChipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  propChipText: { fontSize: 12, color: colors.gray700, fontWeight: '500' },
  propChipTextActive: { color: colors.primary, fontWeight: '700' },

  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  monthArrow: { padding: 4 },
  monthText: { fontSize: 16, fontWeight: '700', color: colors.gray900 },

  summaryCard: {
    margin: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  summaryTrack: {
    height: 5,
    backgroundColor: colors.gray100,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  summaryFill: { height: 5, borderRadius: 3, backgroundColor: colors.primary },
  summaryRow: { flexDirection: 'row', marginBottom: 8 },
  summaryLabel: { fontSize: 10, color: colors.gray400, textTransform: 'uppercase', fontWeight: '600', marginBottom: 3 },
  summaryValue: { fontSize: 14, fontWeight: '800', color: colors.gray900 },
  collRate: { fontSize: 11, color: colors.gray400, textAlign: 'center' },

  filterScroll: { marginBottom: 8 },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: 12, color: colors.gray600, fontWeight: '500' },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },

  list: { paddingHorizontal: 12, paddingBottom: 32, gap: 10 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  overdueCard: { borderLeftWidth: 3, borderLeftColor: colors.red500 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  tenantName: { fontSize: 14, fontWeight: '700', color: colors.gray900 },
  tenantSub: { fontSize: 11, color: colors.gray400, marginTop: 2 },
  badge: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4, flexShrink: 0, marginLeft: 8 },
  badgeText: { fontSize: 10, fontWeight: '700' },

  progressTrack: { height: 4, backgroundColor: colors.gray100, borderRadius: 2, overflow: 'hidden', marginBottom: 12 },
  progressFill: { height: 4, borderRadius: 2 },

  amountsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  amountDivider: { width: 1, height: 28, backgroundColor: colors.gray200, marginHorizontal: 12 },
  amountCell: { flex: 1 },
  amountLabel: { fontSize: 9, color: colors.gray400, textTransform: 'uppercase', fontWeight: '600', marginBottom: 2 },
  amountValue: { fontSize: 13, fontWeight: '700', color: colors.gray900 },

  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 9,
  },
  recordBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  errorBox: { margin: 16, backgroundColor: '#fef2f2', borderRadius: 12, padding: 16, alignItems: 'center' },
  errorText: { color: colors.red600, fontSize: 14, textAlign: 'center' },
  retryBtn: { marginTop: 10, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: colors.red500, borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  emptyBox: { paddingVertical: 60, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.gray700, marginBottom: 4 },
  emptyText: { fontSize: 13, color: colors.gray400, textAlign: 'center' },
});

const pmModal = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  cancel: { fontSize: 15, color: colors.gray500, fontWeight: '500' },
  title: { fontSize: 17, fontWeight: '700', color: colors.gray900 },
  submitBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  body: { padding: 20, paddingBottom: 48 },
  context: {
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  contextName: { fontSize: 15, fontWeight: '700', color: colors.primary },
  contextSub: { fontSize: 12, color: colors.primary, marginTop: 3, opacity: 0.8 },

  label: { fontSize: 13, fontWeight: '600', color: colors.gray700, marginBottom: 8 },
  required: { color: colors.red500 },
  input: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.gray900,
    backgroundColor: colors.gray50,
  },

  chipScroll: { marginBottom: 4 },
  chip: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, color: colors.gray600, fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '700' },

  methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodBtn: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  methodBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  methodText: { fontSize: 12, color: colors.gray700, fontWeight: '600' },
  methodTextActive: { color: '#fff' },
});
