import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { getOperatorDashboard, clearOperatorCache } from '../../src/lib/operator-api';
import { useAsync } from '../../src/lib/hooks';
import { formatCurrency } from '../../src/lib/format';
import { logout } from '../../src/lib/auth';
import { colors } from '../../src/theme';

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  OWNER: 'Owner',
  OPERATOR: 'Operator',
  CO_OPERATOR: 'Co-Operator',
  STAFF: 'Staff',
};

function StatBadge({ label, value, icon }: { label: string; value: string; icon: React.ComponentProps<typeof Ionicons>['name'] }) {
  return (
    <View style={styles.statBadge}>
      <Ionicons name={icon} size={18} color={colors.primary} style={{ marginBottom: 6 }} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function OperatorProfileScreen() {
  const { user, setUser } = useAuth();
  const router = useRouter();
  const { top } = useSafeAreaInsets();
  const { data, loading, refetch } = useAsync(getOperatorDashboard, []);

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? '?';

  const roleLabel = ROLE_LABELS[user?.role ?? ''] ?? user?.role ?? 'Operator';

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          clearOperatorCache();
          await logout();
          setUser(null);
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const g = data?.globalSummary;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading && !!data} onRefresh={refetch} tintColor={colors.primary} />
      }
    >
      {/* Hero */}
      <View style={[styles.hero, { paddingTop: top + 28 }]}>
        <View style={styles.avatarRing}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </View>
        <Text style={styles.heroName}>{user?.name ?? '—'}</Text>
        <View style={styles.rolePill}>
          <Ionicons name="briefcase-outline" size={12} color="rgba(255,255,255,0.8)" style={{ marginRight: 4 }} />
          <Text style={styles.roleText}>{roleLabel}</Text>
        </View>
      </View>

      <View style={styles.body}>
        {/* Stats */}
        {g && (
          <View style={styles.statsRow}>
            <StatBadge icon="business-outline" label="Properties" value={String(g.totalProperties)} />
            <View style={styles.statDivider} />
            <StatBadge icon="people-outline" label="Pending Rent" value={formatCurrency(g.totalPendingRent)} />
            <View style={styles.statDivider} />
            <StatBadge icon="chatbubble-ellipses-outline" label="Open Issues" value={String(g.totalOpenComplaints)} />
          </View>
        )}
        {loading && !data && (
          <View style={styles.statsRow}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}

        {/* Account info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <InfoRow icon="mail-outline" label="Email" value={user?.email ?? '—'} />
          {user?.phone && (
            <InfoRow icon="call-outline" label="Phone" value={user.phone} />
          )}
          <InfoRow icon="shield-outline" label="Role" value={roleLabel} />
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color={colors.red600} style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string }) {
  return (
    <View style={infoRow.container}>
      <View style={infoRow.iconWrap}>
        <Ionicons name={icon} size={15} color={colors.gray500} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={infoRow.label}>{label}</Text>
        <Text style={infoRow.value}>{value}</Text>
      </View>
    </View>
  );
}

const infoRow = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.gray50,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  label: { fontSize: 10, color: colors.gray400, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  value: { fontSize: 14, color: colors.gray900, fontWeight: '500', lineHeight: 20 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: 48 },

  hero: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    paddingBottom: 40,
  },
  avatarRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 30, fontWeight: '800', color: '#fff' },
  heroName: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.3, marginBottom: 8 },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  roleText: { fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },

  body: { padding: 16, marginTop: -16 },

  statsRow: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statBadge: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 44, backgroundColor: colors.gray100 },
  statValue: { fontSize: 13, fontWeight: '800', color: colors.gray900, textAlign: 'center' },
  statLabel: { fontSize: 10, color: colors.gray400, marginTop: 2, textAlign: 'center' },

  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingTop: 12,
    paddingBottom: 4,
  },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 15,
    borderWidth: 1.5,
    borderColor: '#fecaca',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  logoutText: { fontSize: 15, color: colors.red600, fontWeight: '700' },
});
