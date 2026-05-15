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
import { useRouter } from 'expo-router';
import { getTenantProfile } from '../../src/lib/tenant-api';
import { useAsync } from '../../src/lib/hooks';
import { formatCurrency, formatDate } from '../../src/lib/format';
import { useAuth } from '../../src/context/AuthContext';
import { logout } from '../../src/lib/auth';

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

export default function ProfileScreen() {
  const { setUser } = useAuth();
  const router = useRouter();
  const { data: profile, loading, error, refetch } = useAsync(getTenantProfile, []);

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Your stay details</Text>
      </View>

      {loading && !profile && (
        <View style={styles.center}>
          <ActivityIndicator color="#4f46e5" />
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

      {profile && (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={loading && !!profile} onRefresh={refetch} />}
        >
          {/* Avatar */}
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile.user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name}>{profile.user.name}</Text>
          <Text style={styles.code}>{profile.tenantCode}</Text>

          <Section title="Contact">
            <Field label="Email" value={profile.user.email} />
            <Field label="Phone" value={profile.user.phone} />
          </Section>

          {profile.allocation && (
            <Section title="Current Stay">
              <Field label="Property" value={profile.allocation.property.name} />
              <Field label="Address" value={`${profile.allocation.property.address}, ${profile.allocation.property.city}`} />
              <Field
                label="Room / Bed"
                value={`Room ${profile.allocation.room.roomNumber}${profile.allocation.room.floor !== null ? ` (Floor ${profile.allocation.room.floor})` : ''} — Bed ${profile.allocation.bed.label}`}
              />
              <Field label="Move-in Date" value={formatDate(profile.allocation.startDate)} />
              {profile.expectedMoveOut && (
                <Field label="Expected Move-out" value={formatDate(profile.expectedMoveOut)} />
              )}
              {profile.monthlyRent !== null && (
                <Field label="Monthly Rent" value={formatCurrency(profile.monthlyRent)} />
              )}
            </Section>
          )}

          <Section title="Deposit">
            <Field label="Deposit Held" value={formatCurrency(profile.depositBalance)} />
          </Section>

          {(profile.emergencyContactName || profile.emergencyContactPhone) && (
            <Section title="Emergency Contact">
              <Field label="Name" value={profile.emergencyContactName} />
              <Field label="Phone" value={profile.emergencyContactPhone} />
            </Section>
          )}

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: {
    backgroundColor: '#4f46e5',
    paddingTop: 56,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  title: { fontSize: 24, fontWeight: '700', color: '#fff' },
  subtitle: { fontSize: 13, color: '#c7d2fe', marginTop: 2 },
  center: { paddingVertical: 40, alignItems: 'center' },
  errorBox: { margin: 16, backgroundColor: '#fef2f2', borderRadius: 12, padding: 16, alignItems: 'center' },
  errorText: { color: '#dc2626', fontSize: 14, textAlign: 'center' },
  retryBtn: { marginTop: 10, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#dc2626', borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  scroll: { padding: 16, paddingBottom: 40 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 10,
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: '#fff' },
  name: { fontSize: 20, fontWeight: '700', color: '#111827', textAlign: 'center' },
  code: { fontSize: 13, color: '#6b7280', textAlign: 'center', marginTop: 2, marginBottom: 20 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  sectionCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, gap: 10 },
  field: {},
  fieldLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '500', marginBottom: 1 },
  fieldValue: { fontSize: 14, color: '#111827', fontWeight: '500' },
  logoutBtn: {
    marginTop: 8,
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: { color: '#dc2626', fontSize: 16, fontWeight: '700' },
});
