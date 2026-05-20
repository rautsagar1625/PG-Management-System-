import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { getOperatorDashboard, type PropertyCard } from '../../src/lib/operator-api';
import { useAsync } from '../../src/lib/hooks';
import { formatCurrency } from '../../src/lib/format';
import { colors } from '../../src/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function QuickAction({
  icon,
  label,
  color,
  bg,
  onPress,
}: {
  icon: IoniconName;
  label: string;
  color: string;
  bg: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.qaBtn} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.qaIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.qaLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function StatCard({
  icon,
  label,
  value,
  color,
  bg,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  color: string;
  bg: string;
}) {
  return (
    <View style={[styles.statCard, { flex: 1 }]}>
      <View style={[styles.statIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function PropertyRow({ p }: { p: PropertyCard }) {
  const occupancyPct = p.totalBeds > 0 ? Math.round((p.occupiedBeds / p.totalBeds) * 100) : 0;
  const collectionPct = Math.min(100, Math.round(p.rentCollectionRate));

  return (
    <View style={styles.propCard}>
      <View style={styles.propHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.propName}>{p.propertyName}</Text>
          <Text style={styles.propCity}>{p.city}</Text>
        </View>
        {p.openComplaints > 0 && (
          <View style={styles.complaintBadge}>
            <Ionicons name="alert-circle" size={11} color={colors.red600} style={{ marginRight: 3 }} />
            <Text style={styles.complaintBadgeText}>{p.openComplaints}</Text>
          </View>
        )}
      </View>

      <View style={styles.propStats}>
        <View style={{ flex: 1 }}>
          <View style={styles.barRow}>
            <Text style={styles.barLabel}>Occupancy</Text>
            <Text style={styles.barPct}>{occupancyPct}%</Text>
          </View>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  width: `${occupancyPct}%` as `${number}%`,
                  backgroundColor: occupancyPct >= 80 ? colors.green500 : colors.primary,
                },
              ]}
            />
          </View>
          <Text style={styles.barSub}>
            {p.occupiedBeds}/{p.totalBeds} beds
          </Text>
        </View>

        <View style={styles.propDivider} />

        <View style={{ flex: 1 }}>
          <View style={styles.barRow}>
            <Text style={styles.barLabel}>Collection</Text>
            <Text style={styles.barPct}>{collectionPct}%</Text>
          </View>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  width: `${collectionPct}%` as `${number}%`,
                  backgroundColor: collectionPct >= 80 ? colors.green500 : colors.yellow400,
                },
              ]}
            />
          </View>
          <Text style={styles.barSub}>{formatCurrency(p.totalCollectedRent)} collected</Text>
        </View>
      </View>

      {p.pendingRent > 0 && (
        <View style={styles.pendingRow}>
          <Ionicons name="time-outline" size={12} color={colors.red600} style={{ marginRight: 4 }} />
          <Text style={styles.pendingText}>{formatCurrency(p.pendingRent)} pending</Text>
        </View>
      )}
    </View>
  );
}

export default function OperatorDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { top } = useSafeAreaInsets();
  const { data, loading, error, refetch } = useAsync(getOperatorDashboard, []);

  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const g = data?.globalSummary;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={loading && !!data}
          onRefresh={refetch}
          tintColor={colors.primary}
        />
      }
    >
      {/* Hero */}
      <View style={[styles.hero, { paddingTop: top + 16 }]}>
        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.heroName}>{firstName} 👋</Text>
          </View>
          <View style={styles.roleBadge}>
            <Ionicons name="briefcase-outline" size={12} color={colors.primary} style={{ marginRight: 4 }} />
            <Text style={styles.roleBadgeText} numberOfLines={1}>
              {user?.role ?? 'Operator'}
            </Text>
          </View>
        </View>
      </View>

      {loading && !data && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading dashboard…</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="cloud-offline-outline" size={30} color={colors.red600} style={{ marginBottom: 8 }} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={refetch} style={styles.retryBtn}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Quick Actions — always visible once hero renders */}
      <View style={styles.qaRow}>
        <QuickAction
          icon="card-outline"
          label="Collect Rent"
          color={colors.green600}
          bg={colors.greenBg}
          onPress={() => router.push('/(operator)/collections' as never)}
        />
        <QuickAction
          icon="person-add-outline"
          label="Add Tenant"
          color={colors.primary}
          bg={colors.primaryLight}
          onPress={() => router.push('/(operator)/tenants' as never)}
        />
        <QuickAction
          icon="chatbubble-ellipses-outline"
          label="Complaints"
          color={colors.yellowText}
          bg={colors.yellowBg}
          onPress={() => router.push('/(operator)/complaints' as never)}
        />
        <QuickAction
          icon="people-outline"
          label="Tenants"
          color={colors.gray700}
          bg={colors.gray100}
          onPress={() => router.push('/(operator)/tenants' as never)}
        />
      </View>

      {g && (
        <View style={styles.body}>
          {/* Global KPIs */}
          <Text style={styles.sectionLabel}>Overview</Text>
          <View style={styles.statRow}>
            <StatCard
              icon="business-outline"
              label="Properties"
              value={String(g.totalProperties)}
              color={colors.primary}
              bg={colors.primaryLight}
            />
            <View style={{ width: 10 }} />
            <StatCard
              icon="trending-up-outline"
              label="Monthly Rev."
              value={formatCurrency(g.totalMonthlyRevenue)}
              color={colors.green600}
              bg={colors.greenBg}
            />
          </View>
          <View style={[styles.statRow, { marginTop: 10 }]}>
            <StatCard
              icon="time-outline"
              label="Pending Rent"
              value={formatCurrency(g.totalPendingRent)}
              color={colors.red600}
              bg={colors.redBg}
            />
            <View style={{ width: 10 }} />
            <StatCard
              icon="chatbubble-ellipses-outline"
              label="Open Complaints"
              value={String(g.totalOpenComplaints)}
              color={colors.yellowText}
              bg={colors.yellowBg}
            />
          </View>

          {/* Per-property cards */}
          {data.properties.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Properties</Text>
              {data.properties.map((p) => (
                <PropertyRow key={p.propertyId} p={p} />
              ))}
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 32 },

  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  greeting: { fontSize: 14, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  heroName: { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 2, letterSpacing: -0.5 },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: 130,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  roleBadgeText: { fontSize: 11, color: colors.primary, fontWeight: '700' },

  center: { paddingVertical: 48, alignItems: 'center', gap: 10 },
  loadingText: { fontSize: 13, color: colors.gray400 },
  errorBox: { margin: 20, backgroundColor: '#fef2f2', borderRadius: 16, padding: 20, alignItems: 'center' },
  errorText: { color: colors.red600, fontSize: 14, textAlign: 'center', marginBottom: 12 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 9, backgroundColor: colors.red500, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  qaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  qaBtn: { alignItems: 'center', flex: 1 },
  qaIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  qaLabel: { fontSize: 10, fontWeight: '600', color: colors.gray600, textAlign: 'center' },

  body: { padding: 16, marginTop: -8 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },

  statRow: { flexDirection: 'row' },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: { fontSize: 17, fontWeight: '800', color: colors.gray900, marginBottom: 3 },
  statLabel: { fontSize: 11, color: colors.gray400, fontWeight: '500' },

  propCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  propHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  propName: { fontSize: 15, fontWeight: '700', color: colors.gray900 },
  propCity: { fontSize: 12, color: colors.gray400, marginTop: 2 },
  complaintBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.redBg,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  complaintBadgeText: { fontSize: 11, fontWeight: '700', color: colors.red600 },

  propStats: { flexDirection: 'row', gap: 12 },
  propDivider: { width: 1, backgroundColor: colors.gray200 },
  barRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  barLabel: { fontSize: 11, color: colors.gray500, fontWeight: '500' },
  barPct: { fontSize: 11, fontWeight: '700', color: colors.gray700 },
  track: { height: 4, backgroundColor: colors.gray100, borderRadius: 2, overflow: 'hidden', marginBottom: 4 },
  fill: { height: 4, borderRadius: 2 },
  barSub: { fontSize: 10, color: colors.gray400 },

  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  pendingText: { fontSize: 12, color: colors.red600, fontWeight: '600' },
});
