/**
 * Staff Home — shows a quick summary of open/assigned complaints
 * and quick-action buttons. No financial data is exposed.
 */
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { getOperatorProperties, getOperatorComplaints } from '../../src/lib/operator-api';
import { useAsync } from '../../src/lib/hooks';
import { colors, shadow, radius } from '../../src/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function QuickAction({
  icon, label, color, bg, onPress,
}: {
  icon: IoniconName; label: string; color: string; bg: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.qaBtn} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.qaIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={22} color={color} />
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

export default function StaffHomeScreen() {
  const { user } = useAuth();
  const { top } = useSafeAreaInsets();
  const router = useRouter();
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  // Load properties to get the first propertyId for complaints
  const { data: properties = [], loading: propsLoading } = useAsync(getOperatorProperties, []);
  const propertyId = properties[0]?.id ?? '';

  const { data: allComplaints = [], loading: complaintsLoading, refetch } = useAsync(
    () => propertyId ? getOperatorComplaints({ propertyId }) : Promise.resolve([]),
    [propertyId],
  );

  const loading = propsLoading || complaintsLoading;
  const open = allComplaints.filter((c) => c.status === 'OPEN' || c.status === 'ASSIGNED' || c.status === 'IN_PROGRESS');
  const resolved = allComplaints.filter((c) => c.status === 'RESOLVED' || c.status === 'CLOSED');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading && allComplaints.length > 0} onRefresh={refetch} tintColor="#4f46e5" />
      }
    >
      {/* Hero */}
      <LinearGradient
        colors={['#1e1b4b', '#312e81', '#4f46e5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: top + 20 }]}
      >
        <View style={styles.heroRing} />
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroGreeting}>{getGreeting()},</Text>
            <Text style={styles.heroName}>{firstName} 👋</Text>
          </View>
          <View style={styles.staffBadge}>
            <Ionicons name="briefcase-outline" size={12} color="rgba(255,255,255,0.8)" />
            <Text style={styles.staffBadgeText}>Staff</Text>
          </View>
        </View>

        {/* Quick stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.statNum}>{open.length}</Text>
            }
            <Text style={styles.statLabel}>Open Tasks</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.statNum}>{resolved.length}</Text>
            }
            <Text style={styles.statLabel}>Resolved Today</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        {/* Quick actions */}
        <Text style={styles.sectionLabel}>Quick Actions</Text>
        <View style={styles.qaGrid}>
          <QuickAction
            icon="chatbubble-ellipses-outline"
            label="Complaints"
            color="#7c3aed"
            bg="#ede9fe"
            onPress={() => router.push('/(staff)/complaints' as never)}
          />
          <QuickAction
            icon="location-outline"
            label="Attendance"
            color="#2563eb"
            bg="#dbeafe"
            onPress={() => router.push('/(staff)/attendance' as never)}
          />
          <QuickAction
            icon="restaurant-outline"
            label="Food Menu"
            color="#d97706"
            bg="#fef3c7"
            onPress={() => router.push('/(staff)/food-menu' as never)}
          />
          <QuickAction
            icon="person-circle-outline"
            label="My Profile"
            color="#059669"
            bg="#d1fae5"
            onPress={() => router.push('/(staff)/profile' as never)}
          />
        </View>

        {/* Open complaints preview */}
        {open.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>Open Complaints</Text>
              <TouchableOpacity onPress={() => router.push('/(staff)/complaints' as never)}>
                <Text style={styles.seeAll}>See all →</Text>
              </TouchableOpacity>
            </View>
            {open.slice(0, 3).map((c) => (
              <TouchableOpacity
                key={c.id}
                style={styles.complaintCard}
                onPress={() => router.push('/(staff)/complaints' as never)}
                activeOpacity={0.8}
              >
                <View style={[styles.priorityDot, {
                  backgroundColor:
                    c.priority === 'URGENT' ? '#ef4444'
                    : c.priority === 'HIGH' ? '#f97316'
                    : c.priority === 'MEDIUM' ? '#f59e0b'
                    : '#6b7280',
                }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.complaintTitle} numberOfLines={1}>{c.title}</Text>
                  <Text style={styles.complaintMeta}>
                    {c.tenant?.user.name ?? 'Unknown'} · {c.priority}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.gray400} />
              </TouchableOpacity>
            ))}
          </>
        )}

        {!loading && open.length === 0 && (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-circle-outline" size={40} color={colors.green500} />
            <Text style={styles.emptyTitle}>All clear!</Text>
            <Text style={styles.emptyText}>No open complaints assigned. Check back later.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 40 },

  // Hero
  hero: { paddingHorizontal: 20, paddingBottom: 32 },
  heroRing: {
    position: 'absolute', top: -60, right: -60,
    width: 200, height: 200, borderRadius: 100,
    borderWidth: 40, borderColor: 'rgba(255,255,255,0.04)',
  },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 },
  heroGreeting: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  heroName: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5, marginTop: 2 },
  staffBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  staffBadgeText: { fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    padding: 16,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  statNum: { fontSize: 28, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2, fontWeight: '500' },

  body: { padding: 16, marginTop: -12 },

  // Quick actions
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.gray400, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10, marginTop: 4 },
  qaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  qaBtn: {
    width: '47%', backgroundColor: '#fff', borderRadius: radius.md,
    padding: 16, alignItems: 'center', gap: 8,
    ...shadow.card,
  },
  qaIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  qaLabel: { fontSize: 13, fontWeight: '600', color: colors.gray700 },

  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  seeAll: { fontSize: 12, color: colors.primary, fontWeight: '600' },

  // Complaint cards
  complaintCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: radius.md, padding: 14,
    marginBottom: 8, ...shadow.card,
  },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  complaintTitle: { fontSize: 14, fontWeight: '600', color: colors.gray900 },
  complaintMeta: { fontSize: 12, color: colors.gray500, marginTop: 2 },

  // Empty
  emptyCard: {
    backgroundColor: '#fff', borderRadius: radius.lg, padding: 32,
    alignItems: 'center', gap: 8, ...shadow.card,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.gray800 },
  emptyText: { fontSize: 13, color: colors.gray400, textAlign: 'center', lineHeight: 20 },
});
