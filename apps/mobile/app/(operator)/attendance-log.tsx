import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useAuth } from '../../src/context/AuthContext';
import { useAsync } from '../../src/lib/hooks';
import { api } from '../../src/lib/api';
import { colors } from '../../src/theme';

interface AttendanceRecord {
  id: string;
  userId: string;
  type: 'CHECK_IN' | 'CHECK_OUT';
  isValid: boolean;
  createdAt: string;
  user: { name: string; phone?: string | null };
}

interface DailySummary {
  total: number;
  present: number;
  absent: number;
}

function toDateString(d: Date): string {
  return d.toISOString().split('T')[0] ?? '';
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export default function AttendanceLogScreen() {
  const { user } = useAuth();
  const { top } = useSafeAreaInsets();
  const [selectedDate, setSelectedDate] = useState(toDateString(new Date()));

  const propertyId =
    (user as unknown as { properties?: Array<{ id: string }> })?.properties?.[0]?.id ?? '';

  const { data: records, loading, refetch } = useAsync(async () => {
    if (!propertyId || !selectedDate) return [];
    const res = await api.get<{ success: boolean; data: AttendanceRecord[] }>(
      `/attendance?propertyId=${encodeURIComponent(propertyId)}&date=${encodeURIComponent(selectedDate)}`,
    );
    return res.data;
  }, [propertyId, selectedDate]);

  const { data: summary } = useAsync(async () => {
    if (!propertyId || !selectedDate) return null;
    const res = await api.get<{ success: boolean; data: DailySummary }>(
      `/attendance/summary?propertyId=${encodeURIComponent(propertyId)}&date=${encodeURIComponent(selectedDate)}`,
    );
    return res.data;
  }, [propertyId, selectedDate]);

  const changeDate = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(toDateString(d));
  };

  const todayStr = toDateString(new Date());
  const isToday = selectedDate === todayStr;
  const displayDate = isToday
    ? 'Today'
    : new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  // Group records by userId and consolidate check-in/out
  const byUser: Record<string, { name: string; phone?: string | null; checkIn?: string; checkOut?: string }> = {};
  for (const r of records ?? []) {
    const key = r.userId;
    const existing = byUser[key];
    if (!existing) {
      byUser[key] = { name: r.user.name, phone: r.user.phone };
    }
    const entry = byUser[key]!;
    if (r.type === 'CHECK_IN') entry.checkIn = r.createdAt;
    else entry.checkOut = r.createdAt;
  }
  const userList = Object.entries(byUser).map(([id, v]) => ({ id, ...v }));

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1e1b4b', '#312e81', '#4f46e5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: top + 20 }]}
      >
        <View style={styles.heroRing} />
        <Text style={styles.heroTitle}>Attendance Log</Text>

        {/* Date navigation */}
        <View style={styles.dateNav}>
          <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateArrow} activeOpacity={0.75}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.dateLabel}>{displayDate}</Text>
          <TouchableOpacity
            onPress={() => changeDate(1)}
            style={[styles.dateArrow, isToday && { opacity: 0.3 }]}
            disabled={isToday}
            activeOpacity={0.75}
          >
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.heroStrip}>
          <View style={styles.heroStripItem}>
            <Text style={styles.heroStripValue}>{summary?.present ?? 0}</Text>
            <Text style={styles.heroStripLabel}>Present</Text>
          </View>
          <View style={styles.heroStripDivider} />
          <View style={styles.heroStripItem}>
            <Text style={styles.heroStripValue}>{summary?.absent ?? 0}</Text>
            <Text style={styles.heroStripLabel}>Absent</Text>
          </View>
          <View style={styles.heroStripDivider} />
          <View style={styles.heroStripItem}>
            <Text style={styles.heroStripValue}>{summary?.total ?? 0}</Text>
            <Text style={styles.heroStripLabel}>Total</Text>
          </View>
        </View>
      </LinearGradient>

      {loading && !records ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : userList.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="calendar-outline" size={40} color={colors.gray300} style={{ marginBottom: 10 }} />
          <Text style={styles.emptyText}>No attendance records for this date</Text>
        </View>
      ) : (
        <FlatList
          data={userList}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={loading && !!records} onRefresh={refetch} tintColor={colors.primary} />
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardLeft}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={styles.userName}>{item.name}</Text>
                  {item.phone && <Text style={styles.userPhone}>{item.phone}</Text>}
                </View>
              </View>
              <View style={styles.times}>
                <TimeChip icon="log-in-outline" time={item.checkIn} label="In" />
                <TimeChip icon="log-out-outline" time={item.checkOut} label="Out" />
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

function TimeChip({ icon, time, label }: { icon: React.ComponentProps<typeof Ionicons>['name']; time?: string; label: string }) {
  return (
    <View style={chipStyles.wrap}>
      <Ionicons name={icon} size={12} color={time ? colors.green600 : colors.gray300} />
      <Text style={[chipStyles.label, !time && { color: colors.gray300 }]}>
        {label}: {time ? formatTime(time) : '—'}
      </Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  label: { fontSize: 11, fontWeight: '600', color: colors.gray700 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  hero: { paddingHorizontal: 20, paddingBottom: 24, overflow: 'hidden' },
  heroRing: {
    position: 'absolute', right: -60, top: -60,
    width: 200, height: 200, borderRadius: 100,
    borderWidth: 40, borderColor: 'rgba(255,255,255,0.05)',
  },
  heroTitle: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5, marginBottom: 12 },

  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 16 },
  dateArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  dateLabel: { fontSize: 15, fontWeight: '700', color: '#fff', minWidth: 120, textAlign: 'center' },

  heroStrip: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  heroStripItem: { flex: 1, alignItems: 'center', gap: 4 },
  heroStripDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)' },
  heroStripValue: { fontSize: 20, fontWeight: '800', color: '#fff' },
  heroStripLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 14, color: colors.gray400, fontWeight: '500', textAlign: 'center', paddingHorizontal: 20 },

  listContent: { padding: 16, gap: 8, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '800', color: colors.primary },
  userName: { fontSize: 13, fontWeight: '700', color: colors.gray900 },
  userPhone: { fontSize: 11, color: colors.gray400, marginTop: 1 },
  times: { gap: 4, alignItems: 'flex-end' },
});
