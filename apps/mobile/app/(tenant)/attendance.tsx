import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { useAuth } from '../../src/context/AuthContext';
import { useAsync } from '../../src/lib/hooks';
import { api } from '../../src/lib/api';
import { colors } from '../../src/theme';

interface AttendanceRecord {
  id: string;
  type: 'CHECK_IN' | 'CHECK_OUT';
  isValid: boolean;
  invalidReason?: string;
  createdAt: string;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function groupByDay(records: AttendanceRecord[]): Record<string, AttendanceRecord[]> {
  const groups: Record<string, AttendanceRecord[]> = {};
  for (const r of records) {
    const day = new Date(r.createdAt).toDateString();
    const existing = groups[day];
    if (!existing) groups[day] = [r];
    else existing.push(r);
  }
  return groups;
}

export default function AttendanceScreen() {
  const { user } = useAuth();
  const { top } = useSafeAreaInsets();
  const [checking, setChecking] = useState(false);
  const [lastAction, setLastAction] = useState<{ type: string; time: string } | null>(null);

  const propertyId = (user as unknown as { propertyId?: string })?.propertyId ?? '';

  const { data: history, loading, refetch } = useAsync(async () => {
    if (!propertyId) return [];
    const res = await api.get<{ success: boolean; data: AttendanceRecord[] }>(
      `/attendance/my?propertyId=${encodeURIComponent(propertyId)}`,
    );
    return res.data;
  }, [propertyId]);

  const todayStr = new Date().toDateString();
  const todayRecords = (history ?? []).filter(
    (r: AttendanceRecord) => new Date(r.createdAt).toDateString() === todayStr,
  );
  const lastRecord = history?.[0];
  const nextType = !lastRecord || lastRecord.type === 'CHECK_OUT' ? 'CHECK_IN' : 'CHECK_OUT';
  const alreadyDoneBoth =
    todayRecords.some((r) => r.type === 'CHECK_IN') &&
    todayRecords.some((r) => r.type === 'CHECK_OUT');

  const todayCheckIn = todayRecords.find((r) => r.type === 'CHECK_IN');
  const todayCheckOut = todayRecords.find((r) => r.type === 'CHECK_OUT');

  const handleAttendance = async () => {
    if (alreadyDoneBoth) return;
    setChecking(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let latitude: number | undefined;
      let longitude: number | undefined;
      let accuracy: number | undefined;

      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        latitude = loc.coords.latitude;
        longitude = loc.coords.longitude;
        accuracy = loc.coords.accuracy ?? undefined;
      }

      const endpoint = nextType === 'CHECK_IN' ? '/attendance/check-in' : '/attendance/check-out';
      await api.post(endpoint, { propertyId, latitude, longitude, accuracy });

      setLastAction({ type: nextType, time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) });
      await refetch();
    } catch {
      Alert.alert('Error', 'Could not record attendance. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  const grouped = groupByDay(history ?? []);
  const days = Object.keys(grouped);

  const todayLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading && !!history} onRefresh={refetch} tintColor={colors.primary} />
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
        <Text style={styles.heroTitle}>Attendance</Text>
        <Text style={styles.heroDate}>{todayLabel}</Text>

        {/* Today's status strip */}
        <View style={styles.heroStrip}>
          <View style={styles.heroStripItem}>
            <Ionicons
              name={todayCheckIn ? 'checkmark-circle' : 'time-outline'}
              size={16}
              color={todayCheckIn ? '#6ee7b7' : 'rgba(255,255,255,0.4)'}
            />
            <Text style={styles.heroStripLabel}>Check-in</Text>
            <Text style={[styles.heroStripValue, !todayCheckIn && { color: 'rgba(255,255,255,0.4)' }]}>
              {todayCheckIn ? formatTime(todayCheckIn.createdAt) : '—'}
            </Text>
          </View>
          <View style={styles.heroStripDivider} />
          <View style={styles.heroStripItem}>
            <Ionicons
              name={todayCheckOut ? 'checkmark-circle' : 'time-outline'}
              size={16}
              color={todayCheckOut ? '#6ee7b7' : 'rgba(255,255,255,0.4)'}
            />
            <Text style={styles.heroStripLabel}>Check-out</Text>
            <Text style={[styles.heroStripValue, !todayCheckOut && { color: 'rgba(255,255,255,0.4)' }]}>
              {todayCheckOut ? formatTime(todayCheckOut.createdAt) : '—'}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Big check-in/out button */}
      <View style={styles.btnWrap}>
        {lastAction ? (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={40} color={colors.green500} style={{ marginBottom: 8 }} />
            <Text style={styles.successTitle}>
              {lastAction.type === 'CHECK_IN' ? 'Checked In' : 'Checked Out'}
            </Text>
            <Text style={styles.successTime}>{lastAction.time}</Text>
          </View>
        ) : (
          <TouchableOpacity
            onPress={handleAttendance}
            activeOpacity={0.85}
            disabled={checking || alreadyDoneBoth}
            style={[styles.bigBtn, alreadyDoneBoth && styles.bigBtnDisabled]}
          >
            {checking ? (
              <ActivityIndicator color="#fff" size="large" />
            ) : alreadyDoneBoth ? (
              <>
                <Ionicons name="checkmark-done-circle" size={48} color="rgba(255,255,255,0.6)" />
                <Text style={styles.bigBtnText}>Done for today</Text>
              </>
            ) : (
              <>
                <LinearGradient
                  colors={nextType === 'CHECK_IN' ? ['#059669', '#10b981'] : ['#dc2626', '#ef4444']}
                  style={styles.bigBtnGradient}
                >
                  <Ionicons
                    name={nextType === 'CHECK_IN' ? 'log-in-outline' : 'log-out-outline'}
                    size={48}
                    color="#fff"
                  />
                </LinearGradient>
                <Text style={styles.bigBtnText}>
                  {nextType === 'CHECK_IN' ? 'Check In' : 'Check Out'}
                </Text>
                <Text style={styles.bigBtnSub}>Tap to record with GPS</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* History */}
      {days.length > 0 && (
        <View style={styles.history}>
          <Text style={styles.historyTitle}>Recent History</Text>
          {days.map((day) => {
            const dayRecords = grouped[day] as AttendanceRecord[];
            const checkIn = dayRecords.find((r) => r.type === 'CHECK_IN');
            const checkOut = dayRecords.find((r) => r.type === 'CHECK_OUT');
            return (
              <View key={day} style={styles.historyCard}>
                <Text style={styles.historyDay}>{formatDateLabel(dayRecords[0]!.createdAt)}</Text>
                <View style={styles.historyRow}>
                  <HistoryItem icon="log-in-outline" label="In" time={checkIn ? formatTime(checkIn.createdAt) : '—'} valid={!!checkIn} />
                  <HistoryItem icon="log-out-outline" label="Out" time={checkOut ? formatTime(checkOut.createdAt) : '—'} valid={!!checkOut} />
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

function HistoryItem({ icon, label, time, valid }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; time: string; valid: boolean }) {
  return (
    <View style={styles.historyItem}>
      <Ionicons name={icon} size={16} color={valid ? colors.green500 : colors.gray300} />
      <Text style={styles.historyItemLabel}>{label}</Text>
      <Text style={[styles.historyItemTime, !valid && { color: colors.gray300 }]}>{time}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 40 },

  hero: { paddingHorizontal: 20, paddingBottom: 28, overflow: 'hidden' },
  heroRing: {
    position: 'absolute', right: -60, top: -60,
    width: 200, height: 200, borderRadius: 100,
    borderWidth: 40, borderColor: 'rgba(255,255,255,0.05)',
  },
  heroTitle: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  heroDate: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 3, marginBottom: 16 },
  heroStrip: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroStripItem: { flex: 1, alignItems: 'center', gap: 4 },
  heroStripDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)' },
  heroStripLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroStripValue: { fontSize: 16, fontWeight: '800', color: '#fff' },

  btnWrap: { padding: 20, alignItems: 'center' },
  bigBtn: { alignItems: 'center', gap: 8 },
  bigBtnDisabled: { opacity: 0.5 },
  bigBtnGradient: {
    width: 120, height: 120, borderRadius: 60,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  bigBtnText: { fontSize: 18, fontWeight: '800', color: colors.gray900, marginTop: 4 },
  bigBtnSub: { fontSize: 12, color: colors.gray400 },

  successBox: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%' },
  successTitle: { fontSize: 18, fontWeight: '800', color: colors.gray900 },
  successTime: { fontSize: 13, color: colors.gray400, marginTop: 4 },

  history: { paddingHorizontal: 16, paddingBottom: 20 },
  historyTitle: { fontSize: 11, fontWeight: '700', color: colors.gray400, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  historyCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  historyDay: { fontSize: 12, fontWeight: '700', color: colors.gray700, marginBottom: 10 },
  historyRow: { flexDirection: 'row', gap: 24 },
  historyItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  historyItemLabel: { fontSize: 12, color: colors.gray500, fontWeight: '500' },
  historyItemTime: { fontSize: 13, fontWeight: '700', color: colors.gray900 },
});
