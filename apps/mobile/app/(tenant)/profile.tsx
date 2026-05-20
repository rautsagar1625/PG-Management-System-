import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getTenantProfile } from '../../src/lib/tenant-api';
import { useAsync } from '../../src/lib/hooks';
import { formatCurrency, formatDate } from '../../src/lib/format';
import { useAuth } from '../../src/context/AuthContext';
import { logout } from '../../src/lib/auth';
import { colors, shadow, radius } from '../../src/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function Row({ icon, label, value }: { icon: IoniconName; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={rowStyles.container}>
      <View style={rowStyles.iconWrap}>
        <Ionicons name={icon} size={16} color="#6b7280" />
      </View>
      <View style={rowStyles.text}>
        <Text style={rowStyles.label}>{label}</Text>
        <Text style={rowStyles.value}>{value}</Text>
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  text: { flex: 1 },
  label: { fontSize: 11, color: '#9ca3af', fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.4 },
  value: { fontSize: 14, color: '#111827', fontWeight: '500', marginTop: 2, lineHeight: 20 },
});

function Section({ title, icon, children }: { title: string; icon: IoniconName; children: React.ReactNode }) {
  return (
    <View style={sectionStyles.container}>
      <View style={sectionStyles.header}>
        <Ionicons name={icon} size={14} color="#4f46e5" style={{ marginRight: 6 }} />
        <Text style={sectionStyles.title}>{title}</Text>
      </View>
      <View style={sectionStyles.card}>{children}</View>
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  container: { marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  title: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
});

export default function ProfileScreen() {
  const { setUser } = useAuth();
  const router = useRouter();
  const { top } = useSafeAreaInsets();
  const { data: profile, loading, error, refetch } = useAsync(getTenantProfile, []);

  const initials = profile?.user.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? '?';

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          setUser(null);
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  if (loading && !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#4f46e5" size="large" />
        <Text style={styles.loadingText}>Loading profile…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={36} color="#dc2626" style={{ marginBottom: 10 }} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={refetch} style={styles.retryBtn}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={loading && !!profile}
          onRefresh={refetch}
          tintColor="#4f46e5"
        />
      }
    >
      {/* Hero section */}
      <View style={[styles.hero, { paddingTop: top + 28 }]}>
        <View style={styles.avatarRing}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </View>
        <Text style={styles.heroName}>{profile?.user.name ?? '—'}</Text>
        <View style={styles.codeRow}>
          <Ionicons name="shield-checkmark-outline" size={13} color="rgba(255,255,255,0.7)" style={{ marginRight: 4 }} />
          <Text style={styles.heroCode}>{profile?.tenantCode ?? '—'}</Text>
        </View>
      </View>

      <View style={styles.body}>
        {profile && (
          <>
            <Section title="Contact Info" icon="person-outline">
              <Row icon="mail-outline" label="Email" value={profile.user.email} />
              <Row icon="call-outline" label="Phone" value={profile.user.phone} />
            </Section>

            {profile.allocation && (
              <Section title="Current Stay" icon="home-outline">
                <Row icon="business-outline" label="Property" value={profile.allocation.property.name} />
                <Row
                  icon="location-outline"
                  label="Address"
                  value={`${profile.allocation.property.address}, ${profile.allocation.property.city}`}
                />
                <Row
                  icon="bed-outline"
                  label="Room / Bed"
                  value={`Room ${profile.allocation.room.roomNumber}${profile.allocation.room.floor !== null ? ` (Floor ${profile.allocation.room.floor})` : ''} — Bed ${profile.allocation.bed.label}`}
                />
                <Row icon="calendar-outline" label="Move-in Date" value={formatDate(profile.allocation.startDate)} />
                {profile.expectedMoveOut && (
                  <Row icon="calendar-clear-outline" label="Expected Move-out" value={formatDate(profile.expectedMoveOut)} />
                )}
                {profile.monthlyRent !== null && (
                  <Row icon="cash-outline" label="Monthly Rent" value={formatCurrency(profile.monthlyRent)} />
                )}
              </Section>
            )}

            <Section title="Deposit" icon="shield-outline">
              <Row icon="wallet-outline" label="Security Deposit Held" value={formatCurrency(profile.depositBalance)} />
            </Section>

            {(profile.emergencyContactName || profile.emergencyContactPhone) && (
              <Section title="Emergency Contact" icon="call-outline">
                <Row icon="person-outline" label="Name" value={profile.emergencyContactName} />
                <Row icon="call-outline" label="Phone" value={profile.emergencyContactPhone} />
              </Section>
            )}

            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={handleLogout}
              activeOpacity={0.8}
            >
              <Ionicons name="log-out-outline" size={18} color="#dc2626" style={{ marginRight: 8 }} />
              <Text style={styles.logoutText}>Sign Out</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: 48 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  loadingText: { fontSize: 13, color: '#9ca3af' },
  errorText: { fontSize: 14, color: colors.red600, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 9, backgroundColor: colors.red500, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  /* Hero — paddingTop set inline via useSafeAreaInsets */
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
  heroName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  codeRow: { flexDirection: 'row', alignItems: 'center' },
  heroCode: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },

  /* Body */
  body: {
    padding: 16,
    marginTop: -16,
  },

  /* Logout */
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
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
