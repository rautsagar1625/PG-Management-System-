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
import { useState } from 'react';
import { useAuth } from '../../src/context/AuthContext';
import { useAsync } from '../../src/lib/hooks';
import { api } from '../../src/lib/api';
import { colors } from '../../src/theme';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MEALS = [
  { key: 'BREAKFAST',     label: 'Breakfast',      icon: 'sunny-outline' as const,      color: '#d97706' },
  { key: 'LUNCH',         label: 'Lunch',           icon: 'restaurant-outline' as const,  color: '#059669' },
  { key: 'EVENING_SNACK', label: 'Evening Snack',   icon: 'cafe-outline' as const,        color: '#7c3aed' },
  { key: 'DINNER',        label: 'Dinner',          icon: 'moon-outline' as const,        color: '#2563eb' },
] as const;

interface FoodMenuEntry {
  id: string;
  dayOfWeek: number;
  mealType: string;
  items: string[];
  timing?: string;
  isActive: boolean;
}

export default function FoodMenuScreen() {
  const { user } = useAuth();
  const { top } = useSafeAreaInsets();
  const today = new Date().getDay();
  const [selectedDay, setSelectedDay] = useState(today);

  const propertyId = (user as unknown as { propertyId?: string })?.propertyId ?? '';

  const { data, loading, refetch } = useAsync(async () => {
    if (!propertyId) return [];
    const res = await api.get<{ success: boolean; data: { entries: FoodMenuEntry[] } }>(
      `/food-menu?propertyId=${encodeURIComponent(propertyId)}`,
    );
    return res.data.entries;
  }, [propertyId]);

  const dayMenu = (data ?? []).filter(
    (e: FoodMenuEntry) => e.dayOfWeek === selectedDay && e.isActive,
  );

  const todayStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading && !!data} onRefresh={refetch} tintColor={colors.primary} />
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
        <Ionicons name="restaurant" size={28} color="rgba(255,255,255,0.8)" style={{ marginBottom: 8 }} />
        <Text style={styles.heroTitle}>Food Menu</Text>
        <Text style={styles.heroDate}>{todayStr}</Text>
      </LinearGradient>

      {/* Day selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dayScrollContent}
        style={styles.dayScroll}
      >
        {DAYS.map((day, idx) => {
          const isToday = idx === today;
          const isSelected = idx === selectedDay;
          return (
            <TouchableOpacity
              key={day}
              onPress={() => setSelectedDay(idx)}
              style={[
                styles.dayPill,
                isSelected && styles.dayPillActive,
                isToday && !isSelected && styles.dayPillToday,
              ]}
              activeOpacity={0.75}
            >
              <Text style={[styles.dayPillText, isSelected && styles.dayPillTextActive]}>
                {day}
              </Text>
              {isToday && <View style={[styles.todayDot, isSelected && { backgroundColor: '#fff' }]} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Meals */}
      {loading && !data ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : dayMenu.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="calendar-outline" size={36} color={colors.gray300} style={{ marginBottom: 10 }} />
          <Text style={styles.emptyTitle}>No menu for {DAYS[selectedDay]}</Text>
          <Text style={styles.emptyText}>Menu hasn't been set for this day yet.</Text>
        </View>
      ) : (
        <View style={styles.mealList}>
          {MEALS.map(({ key, label, icon, color }) => {
            const entry = dayMenu.find((e: FoodMenuEntry) => e.mealType === key);
            if (!entry) return null;
            return (
              <View key={key} style={styles.mealCard}>
                <View style={styles.mealHeader}>
                  <View style={[styles.mealIconWrap, { backgroundColor: `${color}18` }]}>
                    <Ionicons name={icon} size={20} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mealLabel}>{label}</Text>
                    {entry.timing && (
                      <Text style={styles.mealTiming}>{entry.timing}</Text>
                    )}
                  </View>
                </View>
                <View style={styles.itemsRow}>
                  {entry.items.map((item: string, i: number) => (
                    <View key={i} style={styles.itemChip}>
                      <Text style={styles.itemChipText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 40 },

  hero: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    alignItems: 'center',
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
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  heroDate: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 },

  dayScroll: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  dayScrollContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  dayPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.gray100,
    alignItems: 'center',
  },
  dayPillActive: { backgroundColor: colors.primary },
  dayPillToday: { backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primary },
  dayPillText: { fontSize: 12, fontWeight: '600', color: colors.gray600 },
  dayPillTextActive: { color: '#fff' },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginTop: 3,
  },

  center: { paddingVertical: 60, alignItems: 'center' },
  emptyBox: { margin: 20, padding: 32, backgroundColor: '#fff', borderRadius: 16, alignItems: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.gray700, marginBottom: 4 },
  emptyText: { fontSize: 13, color: colors.gray400, textAlign: 'center' },

  mealList: { padding: 16, gap: 12 },
  mealCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  mealHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  mealIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealLabel: { fontSize: 15, fontWeight: '700', color: colors.gray900 },
  mealTiming: { fontSize: 12, color: colors.gray400, marginTop: 1 },
  itemsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  itemChip: {
    backgroundColor: colors.gray100,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  itemChipText: { fontSize: 12, color: colors.gray700, fontWeight: '500' },
});
