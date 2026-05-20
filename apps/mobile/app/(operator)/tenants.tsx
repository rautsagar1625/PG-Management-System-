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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getOperatorTenants,
  getOperatorProperties,
  type OperatorTenant,
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

export default function TenantsScreen() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [propertyId, setPropertyId] = useState('');
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState<OperatorTenant | null>(null);

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
