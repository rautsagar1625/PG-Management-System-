import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { getTenantDashboard } from '../../src/lib/tenant-api';
import { useAsync } from '../../src/lib/hooks';
import { formatCurrency, formatDate } from '../../src/lib/format';
import { colors, shadow, radius } from '../../src/theme';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  PENDING: { label: 'Pending',  color: '#92400e', bg: '#fef3c7', icon: 'time-outline' },
  PAID:    { label: 'Paid',     color: '#065f46', bg: '#d1fae5', icon: 'checkmark-circle-outline' },
  PARTIAL: { label: 'Partial',  color: '#1e40af', bg: '#dbeafe', icon: 'stats-chart-outline' },
  OVERDUE: { label: 'Overdue',  color: '#991b1b', bg: '#fee2e2', icon: 'alert-circle-outline' },
  DUE:     { label: 'Due',      color: '#92400e', bg: '#fef3c7', icon: 'time-outline' },
};

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { top } = useSafeAreaInsets();
  const router = useRouter();
  const { data, loading, error, refetch } = useAsync(getTenantDashboard, []);

  const dashboard = data;
  const cycle = dashboard?.currentCycle;
  const allocation = dashboard?.allocation;
  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const paidPct = cycle && cycle.expectedRent > 0
    ? Math.min(100, (cycle.paidAmount / cycle.expectedRent) * 100)
    : 0;
  const statusCfg = cycle ? (STATUS_CONFIG[cycle.status] ?? { label: cycle.status, color: '#374151', bg: colors.gray100, icon: 'ellipse-outline' as const }) : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={refetch} tintColor="#4f46e5" />}
    >
      {/* Hero header */}
      <LinearGradient
        colors={['#1e1b4b', '#312e81', '#4f46e5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: top + 20 }]}
      >
        {/* Decorative ring */}
        <View style={styles.heroRing} />

        <View style={styles.heroTop}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroGreeting}>{getGreeting()},</Text>
            <Text style={styles.heroName}>{firstName} 👋</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => router.push('/(tenant)/notifications' as never)}
              style={styles.bellBtn}
              activeOpacity={0.75}
            >
              <Ionicons name="notifications-outline" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={styles.heroBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#4f46e5" style={{ marginRight: 4 }} />
              <Text style={styles.heroBadgeText} numberOfLines={1}>
                {dashboard?.tenant.tenantCode ?? '—'}
              </Text>
            </View>
          </View>
        </View>

        {allocation && (
          <View style={styles.heroLocation}>
            <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.7)" />
            <Text style={styles.heroLocationText} numberOfLines={1}>
              {allocation.property.name} · Room {allocation.room.roomNumber}, Bed {allocation.bed.label}
            </Text>
          </View>
        )}
      </LinearGradient>

      {/* Loading */}
      {loading && !data && (
        <View style={styles.center}>
          <ActivityIndicator color="#4f46e5" size="large" />
          <Text style={styles.loadingText}>Loading your dashboard…</Text>
        </View>
      )}

      {/* Error */}
      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="cloud-offline-outline" size={32} color="#dc2626" style={{ marginBottom: 8 }} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={refetch} style={styles.retryBtn}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}

      {dashboard && (
        <View style={styles.cards}>
          {/* This month's rent card */}
          {cycle && statusCfg ? (
            <View style={[styles.rentCard, cycle.status === 'OVERDUE' && styles.rentCardOverdue]}>
              <View style={styles.rentTop}>
                <View>
                  <Text style={styles.cardLabel}>This Month's Rent</Text>
                  <Text style={styles.rentPeriod}>
                    {MONTH_NAMES[cycle.month - 1]} {cycle.year}
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: statusCfg.bg }]}>
                  <Ionicons name={statusCfg.icon} size={12} color={statusCfg.color} style={{ marginRight: 4 }} />
                  <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                </View>
              </View>

              {/* Amount grid */}
              <View style={styles.amountGrid}>
                <View style={styles.amountCell}>
                  <Text style={styles.amountLabel}>Due</Text>
                  <Text style={[styles.amountValue, cycle.remainingAmount > 0 && { color: '#dc2626' }]}>
                    {formatCurrency(cycle.remainingAmount)}
                  </Text>
                </View>
                <View style={styles.amountDivider} />
                <View style={styles.amountCell}>
                  <Text style={styles.amountLabel}>Paid</Text>
                  <Text style={[styles.amountValue, { color: '#059669' }]}>
                    {formatCurrency(cycle.paidAmount)}
                  </Text>
                </View>
                <View style={styles.amountDivider} />
                <View style={styles.amountCell}>
                  <Text style={styles.amountLabel}>Total</Text>
                  <Text style={styles.amountValue}>{formatCurrency(cycle.expectedRent)}</Text>
                </View>
              </View>

              {/* Progress bar */}
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${paidPct}%` as `${number}%`,
                      backgroundColor: cycle.status === 'OVERDUE' ? '#ef4444' : colors.primary,
                    },
                  ]}
                />
              </View>
              <View style={styles.progressLabels}>
                <Text style={styles.progressLabelText}>{Math.round(paidPct)}% paid</Text>
                <Text style={styles.progressLabelText}>Due {formatDate(cycle.dueDate)}</Text>
              </View>
            </View>
          ) : (
            !loading && (
              <View style={styles.emptyCard}>
                <Ionicons name="calendar-outline" size={28} color="#9ca3af" style={{ marginBottom: 8 }} />
                <Text style={styles.emptyTitle}>No rent cycle yet</Text>
                <Text style={styles.emptyText}>Your rent for this month hasn't been generated.</Text>
              </View>
            )
          )}

          {/* Room info card */}
          {allocation ? (
            <View style={styles.infoCard}>
              <View style={styles.infoCardHeader}>
                <View style={styles.infoIconWrap}>
                  <Ionicons name="bed-outline" size={18} color="#4f46e5" />
                </View>
                <Text style={styles.infoCardTitle}>Your Room</Text>
              </View>
              <View style={styles.infoRows}>
                <InfoRow icon="business-outline" label="Property" value={allocation.property.name} />
                <InfoRow icon="location-outline" label="Address" value={`${allocation.property.address}, ${allocation.property.city}`} />
                <InfoRow
                  icon="layers-outline"
                  label="Room / Bed"
                  value={`Room ${allocation.room.roomNumber}${allocation.room.floor != null ? ` · Floor ${allocation.room.floor}` : ''} · Bed ${allocation.bed.label}`}
                />
                <InfoRow icon="calendar-outline" label="Move-in" value={formatDate(allocation.startDate)} />
              </View>
            </View>
          ) : (
            !loading && (
              <View style={styles.emptyCard}>
                <Ionicons name="bed-outline" size={28} color="#9ca3af" style={{ marginBottom: 8 }} />
                <Text style={styles.emptyTitle}>No room assigned</Text>
                <Text style={styles.emptyText}>Contact your PG manager for room allocation.</Text>
              </View>
            )
          )}

          {/* Deposit card */}
          <View style={styles.depositCard}>
            <View style={styles.depositLeft}>
              <View style={styles.infoIconWrap}>
                <Ionicons name="shield-outline" size={18} color="#7c3aed" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.depositLabel}>Security Deposit</Text>
                <Text style={styles.depositSub}>Held securely on your behalf</Text>
              </View>
            </View>
            <Text style={styles.depositAmount}>{formatCurrency(dashboard.tenant.depositBalance)}</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
}) {
  return (
    <View style={infoRowStyles.row}>
      <Ionicons name={icon} size={15} color="#9ca3af" style={infoRowStyles.icon} />
      <View style={{ flex: 1 }}>
        <Text style={infoRowStyles.label}>{label}</Text>
        <Text style={infoRowStyles.value}>{value}</Text>
      </View>
    </View>
  );
}

const infoRowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8 },
  icon: { marginRight: 10, marginTop: 1 },
  label: { fontSize: 10, color: '#9ca3af', fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 1 },
  value: { fontSize: 13, color: '#111827', fontWeight: '500', lineHeight: 18 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 32 },

  /* Hero — paddingTop is set inline via useSafeAreaInsets */
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    overflow: 'hidden',
  },
  heroRing: {
    position: 'absolute',
    right: -60,
    top: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 40,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  heroLeft: { flex: 1, marginRight: 12 },
  heroGreeting: { fontSize: 14, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  heroName: { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 2, letterSpacing: -0.5 },
  bellBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  heroBadgeText: { fontSize: 12, color: colors.primary, fontWeight: '700' },
  heroLocation: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroLocationText: { fontSize: 12, color: 'rgba(255,255,255,0.7)', flex: 1 },

  center: { paddingVertical: 48, alignItems: 'center', gap: 10 },
  loadingText: { fontSize: 13, color: '#9ca3af' },

  errorBox: { margin: 20, backgroundColor: '#fef2f2', borderRadius: 16, padding: 20, alignItems: 'center' },
  errorText: { color: '#dc2626', fontSize: 14, textAlign: 'center', marginBottom: 12 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 9, backgroundColor: '#ef4444', borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  cards: { padding: 16, gap: 12, marginTop: -8 },

  /* Rent card */
  rentCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  rentCardOverdue: {
    borderWidth: 1.5,
    borderColor: '#fecaca',
  },
  rentTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  rentPeriod: { fontSize: 17, fontWeight: '700', color: '#111827' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexShrink: 0,
  },
  statusText: { fontSize: 11, fontWeight: '700' },

  amountGrid: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  amountCell: { flex: 1, alignItems: 'center' },
  amountDivider: { width: 1, height: 32, backgroundColor: colors.gray100 },
  amountLabel: {
    fontSize: 9,
    color: '#9ca3af',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  amountValue: { fontSize: 15, fontWeight: '700', color: '#111827' },

  progressTrack: { height: 5, backgroundColor: colors.gray100, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: 5, borderRadius: 3 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabelText: { fontSize: 11, color: '#9ca3af' },

  /* Info card (room) */
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  infoCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  infoIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCardTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  infoRows: { gap: 0 },

  /* Empty */
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#374151', marginBottom: 4 },
  emptyText: { fontSize: 13, color: '#9ca3af', textAlign: 'center' },

  /* Deposit card */
  depositCard: {
    backgroundColor: '#ede9fe',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  depositLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  depositLabel: { fontSize: 13, fontWeight: '700', color: '#4c1d95', marginBottom: 1 },
  depositSub: { fontSize: 11, color: '#7c3aed' },
  depositAmount: { fontSize: 18, fontWeight: '800', color: '#4c1d95' },
});
