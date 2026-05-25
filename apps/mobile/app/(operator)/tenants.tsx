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
  Linking,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getOperatorTenants,
  getOperatorProperties,
  createTenant,
  type OperatorTenant,
  type CreateTenantDto,
} from '../../src/lib/operator-api';
import { useAsync } from '../../src/lib/hooks';
import { formatCurrency, formatDate } from '../../src/lib/format';
import { colors } from '../../src/theme';

const STATUS_FILTERS = ['ALL', 'ACTIVE', 'OVERDUE', 'NOTICE_PERIOD', 'MOVED_OUT'];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  LEAD:             { label: 'Lead',          color: colors.blueText, bg: colors.blueBg },
  VISIT_SCHEDULED:  { label: 'Visit Sched.',  color: colors.blueText, bg: colors.blueBg },
  VISITED:          { label: 'Visited',       color: colors.blueText, bg: colors.blueBg },
  ROOM_FINALIZED:   { label: 'Finalised',     color: colors.yellowText, bg: colors.yellowBg },
  DEPOSIT_PENDING:  { label: 'Dep. Pending',  color: colors.yellowText, bg: colors.yellowBg },
  KYC_PENDING:      { label: 'KYC Pending',   color: colors.yellowText, bg: colors.yellowBg },
  ACTIVE:           { label: 'Active',        color: colors.greenText, bg: colors.greenBg },
  NOTICE_PERIOD:    { label: 'Notice',        color: colors.yellowText, bg: colors.yellowBg },
  MOVED_OUT:        { label: 'Moved Out',     color: colors.gray500, bg: colors.gray100 },
  REJECTED:         { label: 'Rejected',      color: colors.gray500, bg: colors.gray100 },
};

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function activeAllocation(tenant: OperatorTenant) {
  return tenant.allocations.find((a) => a.isActive) ?? tenant.allocations[0];
}

function TenantCard({
  tenant,
  onPress,
}: {
  tenant: OperatorTenant;
  onPress: () => void;
}) {
  const alloc = activeAllocation(tenant);
  const sCfg = STATUS_CONFIG[tenant.status] ?? { label: tenant.status, color: colors.gray500, bg: colors.gray100 };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardLeft}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(tenant.user.name)}</Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.tenantName} numberOfLines={1}>{tenant.user.name}</Text>
        <Text style={styles.tenantCode}>{tenant.tenantCode}</Text>
        {alloc && (
          <Text style={styles.tenantRoom} numberOfLines={1}>
            Room {alloc.bed.room.number} · Bed {alloc.bed.label}
            {alloc.bed.room.floor != null ? ` · Floor ${alloc.bed.room.floor}` : ''}
          </Text>
        )}
      </View>
      <View style={[styles.badge, { backgroundColor: sCfg.bg }]}>
        <Text style={[styles.badgeText, { color: sCfg.color }]}>{sCfg.label}</Text>
      </View>
    </TouchableOpacity>
  );
}

function TenantDetailModal({
  tenant,
  visible,
  onClose,
}: {
  tenant: OperatorTenant | null;
  visible: boolean;
  onClose: () => void;
}) {
  if (!tenant) return null;
  const alloc = activeAllocation(tenant);
  const sCfg = STATUS_CONFIG[tenant.status] ?? { label: tenant.status, color: colors.gray500, bg: colors.gray100 };

  const callTenant = () => {
    if (!tenant.user.phone) {
      Alert.alert('No phone', 'This tenant has no phone number on record.');
      return;
    }
    Linking.openURL(`tel:${tenant.user.phone}`);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={modal.container}>
        <View style={modal.header}>
          <TouchableOpacity onPress={onClose} style={modal.closeBtn}>
            <Ionicons name="close" size={22} color={colors.gray600} />
          </TouchableOpacity>
          <Text style={modal.title}>Tenant Details</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={modal.body} showsVerticalScrollIndicator={false}>
          {/* Avatar hero */}
          <View style={modal.avatarWrap}>
            <View style={modal.bigAvatar}>
              <Text style={modal.bigAvatarText}>{initials(tenant.user.name)}</Text>
            </View>
            <Text style={modal.bigName}>{tenant.user.name}</Text>
            <View style={[modal.statusPill, { backgroundColor: sCfg.bg }]}>
              <Text style={[modal.statusPillText, { color: sCfg.color }]}>{sCfg.label}</Text>
            </View>
          </View>

          {/* Contact actions */}
          <View style={modal.actions}>
            <TouchableOpacity style={modal.actionBtn} onPress={callTenant}>
              <Ionicons name="call" size={20} color={colors.primary} />
              <Text style={modal.actionLabel}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={modal.actionBtn}
              onPress={() => {
                if (!tenant.user.phone) return;
                Linking.openURL(`sms:${tenant.user.phone}`);
              }}
            >
              <Ionicons name="chatbubble" size={20} color={colors.primary} />
              <Text style={modal.actionLabel}>SMS</Text>
            </TouchableOpacity>
          </View>

          {/* Info rows */}
          <View style={modal.section}>
            <ModalRow icon="id-card-outline" label="Tenant Code" value={tenant.tenantCode} />
            <ModalRow icon="mail-outline" label="Email" value={tenant.user.email} />
            <ModalRow icon="call-outline" label="Phone" value={tenant.user.phone ?? '—'} />
          </View>

          {alloc && (
            <View style={modal.section}>
              <Text style={modal.sectionTitle}>Current Allocation</Text>
              <ModalRow
                icon="bed-outline"
                label="Room / Bed"
                value={`Room ${alloc.bed.room.number}${alloc.bed.room.floor != null ? ` (Floor ${alloc.bed.room.floor})` : ''} · Bed ${alloc.bed.label}`}
              />
              <ModalRow icon="calendar-outline" label="Move-in" value={formatDate(alloc.startDate)} />
              <ModalRow icon="cash-outline" label="Monthly Rent" value={formatCurrency(alloc.monthlyRent)} />
            </View>
          )}

          <View style={modal.section}>
            <ModalRow icon="shield-outline" label="Security Deposit" value={formatCurrency(tenant.depositBalance)} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function ModalRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
}) {
  return (
    <View style={modal.row}>
      <Ionicons name={icon} size={15} color={colors.gray400} style={{ marginRight: 10, marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={modal.rowLabel}>{label}</Text>
        <Text style={modal.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

function PropertyPicker({
  properties,
  selectedId,
  onSelect,
}: {
  properties: { id: string; name: string }[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  if (properties.length <= 1) return null;
  const selected = properties.find((p) => p.id === selectedId);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.propScroll} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
      {properties.map((p) => (
        <TouchableOpacity
          key={p.id}
          onPress={() => onSelect(p.id)}
          style={[styles.propChip, p.id === selectedId && styles.propChipActive]}
        >
          <Text style={[styles.propChipText, p.id === selectedId && styles.propChipTextActive]}>
            {p.name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ─── Add Tenant Modal ─────────────────────────────────────────────────────────

const LEAD_SOURCES = ['Walk-in', 'Website', 'Referral', 'Facebook', 'Instagram', 'JustDial', 'Other'];

interface AddTenantModalProps {
  visible: boolean;
  properties: { id: string; name: string }[];
  defaultPropertyId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function AddTenantModal({ visible, properties, defaultPropertyId, onClose, onSuccess }: AddTenantModalProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [name,      setName]      = useState('');
  const [email,     setEmail]     = useState('');
  const [phone,     setPhone]     = useState('');
  const [propId,    setPropId]    = useState(defaultPropertyId);
  const [deposit,   setDeposit]   = useState('');
  const [source,    setSource]    = useState('');

  const reset = useCallback(() => {
    setStep(1);
    setName(''); setEmail(''); setPhone('');
    setPropId(defaultPropertyId);
    setDeposit(''); setSource('');
  }, [defaultPropertyId]);

  const handleClose = () => { reset(); onClose(); };

  const validateStep1 = () => {
    if (!name.trim() || name.trim().length < 2) {
      Alert.alert('Validation', 'Please enter the tenant\'s full name.'); return false;
    }
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Validation', 'Please enter a valid email address.'); return false;
    }
    if (!phone.trim() || phone.trim().length < 8) {
      Alert.alert('Validation', 'Please enter a valid phone number.'); return false;
    }
    return true;
  };

  const handleSubmit = useCallback(async () => {
    if (!propId) { Alert.alert('Validation', 'Please select a property.'); return; }
    const dep = parseFloat(deposit) || 0;
    if (dep < 0) { Alert.alert('Validation', 'Deposit amount cannot be negative.'); return; }

    setLoading(true);
    try {
      const dto: CreateTenantDto = {
        name:          name.trim(),
        email:         email.trim().toLowerCase(),
        phone:         phone.trim(),
        propertyId:    propId,
        depositAmount: dep,
        ...(source ? { leadSource: source } : {}),
      };
      await createTenant(dto);
      Alert.alert('✅ Lead Added', `${dto.name} has been added as a new lead. They'll receive an invite to set up their account.`);
      reset();
      onSuccess();
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not create tenant.');
    } finally {
      setLoading(false);
    }
  }, [name, email, phone, propId, deposit, source, reset, onSuccess]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={addModal.container}>
          {/* Header */}
          <View style={addModal.header}>
            <TouchableOpacity onPress={handleClose} style={addModal.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={colors.gray600} />
            </TouchableOpacity>
            <Text style={addModal.title}>Add New Lead / Tenant</Text>
            <View style={{ width: 36 }} />
          </View>

          {/* Step indicator */}
          <View style={addModal.steps}>
            {[1, 2].map((s) => (
              <View key={s} style={[addModal.stepDot, s === step && addModal.stepDotActive, s < step && addModal.stepDotDone]}>
                {s < step
                  ? <Ionicons name="checkmark" size={12} color="#fff" />
                  : <Text style={[addModal.stepNum, s === step && { color: '#fff' }]}>{s}</Text>
                }
              </View>
            ))}
            <View style={addModal.stepLine} />
          </View>

          <ScrollView contentContainerStyle={addModal.body} keyboardShouldPersistTaps="handled">
            {step === 1 ? (
              <>
                <Text style={addModal.stepLabel}>Step 1 of 2 — Personal Information</Text>

                <Text style={addModal.fieldLabel}>Full Name *</Text>
                <TextInput
                  style={addModal.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Rahul Sharma"
                  autoCapitalize="words"
                  autoCorrect={false}
                  placeholderTextColor="#9ca3af"
                  returnKeyType="next"
                />

                <Text style={addModal.fieldLabel}>Email Address *</Text>
                <TextInput
                  style={addModal.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="rahul@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor="#9ca3af"
                  returnKeyType="next"
                />

                <Text style={addModal.fieldLabel}>Phone Number *</Text>
                <TextInput
                  style={addModal.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+91 9876543210"
                  keyboardType="phone-pad"
                  placeholderTextColor="#9ca3af"
                  returnKeyType="done"
                />

                <TouchableOpacity
                  style={addModal.nextBtn}
                  onPress={() => { if (validateStep1()) setStep(2); }}
                  activeOpacity={0.85}
                >
                  <Text style={addModal.nextBtnText}>Next →</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={addModal.stepLabel}>Step 2 of 2 — Property & Deposit</Text>

                <Text style={addModal.fieldLabel}>Property *</Text>
                {properties.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[addModal.propChip, propId === p.id && addModal.propChipSelected]}
                    onPress={() => setPropId(p.id)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={propId === p.id ? 'radio-button-on' : 'radio-button-off'}
                      size={16}
                      color={propId === p.id ? colors.primary : '#9ca3af'}
                      style={{ marginRight: 8 }}
                    />
                    <Text style={[addModal.propChipText, propId === p.id && { color: colors.primary, fontWeight: '700' }]}>
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                ))}

                <Text style={[addModal.fieldLabel, { marginTop: 16 }]}>Security Deposit (₹)</Text>
                <TextInput
                  style={addModal.input}
                  value={deposit}
                  onChangeText={setDeposit}
                  placeholder="e.g. 10000"
                  keyboardType="numeric"
                  placeholderTextColor="#9ca3af"
                  returnKeyType="done"
                />

                <Text style={[addModal.fieldLabel, { marginTop: 4 }]}>Lead Source (optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {LEAD_SOURCES.map((s) => (
                      <TouchableOpacity
                        key={s}
                        style={[addModal.sourceChip, source === s && addModal.sourceChipSelected]}
                        onPress={() => setSource(source === s ? '' : s)}
                      >
                        <Text style={[addModal.sourceChipText, source === s && { color: colors.primary }]}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                <View style={addModal.stepBtns}>
                  <TouchableOpacity style={addModal.backBtn} onPress={() => setStep(1)} activeOpacity={0.8}>
                    <Text style={addModal.backBtnText}>← Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[addModal.submitBtn, loading && addModal.submitBtnDisabled]}
                    onPress={handleSubmit}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Ionicons name="person-add" size={16} color="#fff" />
                    }
                    <Text style={addModal.submitBtnText}>{loading ? 'Adding…' : 'Add Lead'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const addModal = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.gray900 },

  steps: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, gap: 0 },
  stepLine: { flex: 1, height: 2, backgroundColor: '#e5e7eb', position: 'absolute', left: 54, right: 54, top: 28 },
  stepDot: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#e5e7eb',
    alignItems: 'center', justifyContent: 'center', zIndex: 1,
    marginRight: 'auto',
  },
  stepDotActive: { backgroundColor: colors.primary },
  stepDotDone:   { backgroundColor: '#10b981' },
  stepNum: { fontSize: 12, fontWeight: '700', color: '#9ca3af' },

  body: { padding: 20, paddingBottom: 40 },
  stepLabel: { fontSize: 13, color: '#6b7280', marginBottom: 20, fontWeight: '500' },

  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  input: {
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111827',
    backgroundColor: '#f9fafb', marginBottom: 16,
  },

  propChip: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11, backgroundColor: '#f9fafb',
    marginBottom: 8,
  },
  propChipSelected: { borderColor: colors.primary, backgroundColor: '#eef2ff' },
  propChipText: { fontSize: 14, color: '#374151', fontWeight: '500' },

  sourceChip: {
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#f9fafb',
  },
  sourceChipSelected: { borderColor: colors.primary, backgroundColor: '#eef2ff' },
  sourceChipText: { fontSize: 13, color: '#374151', fontWeight: '500' },

  stepBtns: { flexDirection: 'row', gap: 12 },
  backBtn: {
    flex: 1, borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12,
    paddingVertical: 13, alignItems: 'center', justifyContent: 'center',
  },
  backBtnText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  submitBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13,
  },
  submitBtnDisabled: { backgroundColor: '#a5b4fc' },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  nextBtn: {
    backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
  },
  nextBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function TenantsScreen() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [propertyId, setPropertyId] = useState('');
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState<OperatorTenant | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Load properties once
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
          ? getOperatorTenants({ propertyId, status: statusFilter, search })
          : Promise.resolve({ tenants: [], meta: { total: 0, page: 1, limit: 30, totalPages: 1 } }),
      [propertyId, statusFilter, search],
    ),
    [propertyId, statusFilter, search],
  );

  const tenants = data?.tenants ?? [];

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={colors.gray400} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search tenants…"
          placeholderTextColor={colors.gray400}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={colors.gray400} />
          </TouchableOpacity>
        )}
      </View>

      {/* Property picker */}
      <PropertyPicker properties={properties} selectedId={propertyId} onSelect={setPropertyId} />

      {/* Status filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        {STATUS_FILTERS.map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => setStatusFilter(s)}
            style={[styles.filterChip, s === statusFilter && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, s === statusFilter && styles.filterChipTextActive]}>
              {s.replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Loading */}
      {loading && !data && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {/* Error */}
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={refetch} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* List */}
      <FlatList
        data={tenants}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => (
          <TenantCard tenant={item} onPress={() => setSelected(item)} />
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
              <Ionicons name="people-outline" size={44} color={colors.gray300} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>No tenants found</Text>
              <Text style={styles.emptyText}>Try changing the filter or search term.</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          data && data.meta.total > 0 ? (
            <Text style={styles.countText}>{data.meta.total} tenant{data.meta.total !== 1 ? 's' : ''}</Text>
          ) : null
        }
      />

      <TenantDetailModal
        tenant={selected}
        visible={!!selected}
        onClose={() => setSelected(null)}
      />

      {/* Add Tenant FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="person-add" size={20} color="#fff" />
        <Text style={styles.fabText}>Add Lead</Text>
      </TouchableOpacity>

      <AddTenantModal
        visible={showAddModal}
        properties={properties}
        defaultPropertyId={propertyId}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => { setShowAddModal(false); refetch(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { paddingVertical: 48, alignItems: 'center' },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: colors.gray900 },

  propScroll: { marginBottom: 8 },
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

  list: { paddingHorizontal: 12, paddingBottom: 32, gap: 8 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardLeft: { marginRight: 12 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '700', color: colors.primary },
  cardBody: { flex: 1 },
  tenantName: { fontSize: 14, fontWeight: '700', color: colors.gray900 },
  tenantCode: { fontSize: 11, color: colors.gray400, marginTop: 1 },
  tenantRoom: { fontSize: 11, color: colors.gray500, marginTop: 2 },
  badge: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4, flexShrink: 0, marginLeft: 8 },
  badgeText: { fontSize: 10, fontWeight: '700' },

  errorBox: { margin: 16, backgroundColor: '#fef2f2', borderRadius: 12, padding: 16, alignItems: 'center' },
  errorText: { color: colors.red600, fontSize: 14, textAlign: 'center' },
  retryBtn: { marginTop: 10, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: colors.red500, borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  emptyBox: { paddingVertical: 60, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.gray700, marginBottom: 4 },
  emptyText: { fontSize: 13, color: colors.gray400, textAlign: 'center', paddingHorizontal: 24 },

  countText: { textAlign: 'center', fontSize: 12, color: colors.gray400, paddingVertical: 12 },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 28,
    paddingVertical: 13,
    paddingHorizontal: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

const modal = StyleSheet.create({
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
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.gray900 },

  body: { padding: 20, paddingBottom: 48 },

  avatarWrap: { alignItems: 'center', marginBottom: 20 },
  bigAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  bigAvatarText: { fontSize: 26, fontWeight: '800', color: colors.primary },
  bigName: { fontSize: 20, fontWeight: '800', color: colors.gray900, marginBottom: 8 },
  statusPill: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  statusPillText: { fontSize: 12, fontWeight: '700' },

  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    justifyContent: 'center',
  },
  actionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 28,
    gap: 6,
  },
  actionLabel: { fontSize: 12, fontWeight: '700', color: colors.primary },

  section: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.gray100,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingTop: 10,
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  rowLabel: { fontSize: 10, color: colors.gray400, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  rowValue: { fontSize: 14, color: colors.gray900, fontWeight: '500', lineHeight: 20 },
});
