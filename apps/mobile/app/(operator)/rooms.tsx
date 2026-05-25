import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAsync } from '../../src/lib/hooks';
import { api } from '../../src/lib/api';
import { useOperatorProperty } from '../../src/hooks/useOperatorProperty';
import { colors } from '../../src/theme';

interface Bed {
  id: string;
  label: string;
  isOccupied: boolean;
  monthlyRent: number;
}

interface Room {
  id: string;
  number: string;
  type: string;
  floor: number;
  beds: Bed[];
}

const TYPE_COLORS: Record<string, string> = {
  SINGLE: '#059669',
  DOUBLE: '#2563eb',
  TRIPLE: '#7c3aed',
  QUAD: '#d97706',
};

function fmt(n: number) {
  return n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

export default function RoomsScreen() {
  const { top } = useSafeAreaInsets();

  // WF-001: property picker — replaces hardcoded properties[0]
  const { properties, propertyId, setPropertyId } = useOperatorProperty();

  const { data: rooms, loading, refetch } = useAsync(async () => {
    if (!propertyId) return [];
    const res = await api.get<{ success: boolean; data: Room[] }>(
      `/properties/${encodeURIComponent(propertyId)}/rooms`,
    );
    return res.data;
  }, [propertyId]);

  const allBeds = (rooms ?? []).flatMap((r: Room) => r.beds);
  const occupiedCount = allBeds.filter((b: Bed) => b.isOccupied).length;
  const totalBeds = allBeds.length;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1e1b4b', '#312e81', '#4f46e5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: top + 20 }]}
      >
        <View style={styles.heroRing} />
        <Text style={styles.heroTitle}>Rooms & Beds</Text>
        <Text style={styles.heroSub}>
          {(rooms ?? []).length} room{(rooms ?? []).length !== 1 ? 's' : ''}
        </Text>

        {/* Property chip strip — only rendered when operator has multiple properties */}
        {properties.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.propStrip}
          >
            {properties.map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => setPropertyId(p.id)}
                style={[styles.propChip, p.id === propertyId && styles.propChipActive]}
                activeOpacity={0.75}
              >
                <Text style={[styles.propChipText, p.id === propertyId && styles.propChipTextActive]}>
                  {p.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={styles.heroStrip}>
          <View style={styles.heroStripItem}>
            <Text style={styles.heroStripValue}>{occupiedCount}</Text>
            <Text style={styles.heroStripLabel}>Occupied</Text>
          </View>
          <View style={styles.heroStripDivider} />
          <View style={styles.heroStripItem}>
            <Text style={styles.heroStripValue}>{totalBeds - occupiedCount}</Text>
            <Text style={styles.heroStripLabel}>Vacant</Text>
          </View>
          <View style={styles.heroStripDivider} />
          <View style={styles.heroStripItem}>
            <Text style={styles.heroStripValue}>{totalBeds}</Text>
            <Text style={styles.heroStripLabel}>Total Beds</Text>
          </View>
        </View>
      </LinearGradient>

      {loading && !rooms ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (rooms ?? []).length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="bed-outline" size={40} color={colors.gray300} style={{ marginBottom: 10 }} />
          <Text style={styles.emptyText}>No rooms found</Text>
        </View>
      ) : (
        <FlatList
          data={rooms ?? []}
          keyExtractor={(r: Room) => r.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={loading && !!rooms} onRefresh={refetch} tintColor={colors.primary} />
          }
          renderItem={({ item: room }) => {
            const typeColor = TYPE_COLORS[room.type] ?? colors.gray500;
            const occupied = room.beds.filter((b: Bed) => b.isOccupied).length;
            return (
              <View style={styles.roomCard}>
                <View style={styles.roomHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.roomNumber}>Room {room.number}</Text>
                    <Text style={styles.roomFloor}>Floor {room.floor}</Text>
                  </View>
                  <View style={[styles.typeBadge, { backgroundColor: `${typeColor}18` }]}>
                    <Text style={[styles.typeText, { color: typeColor }]}>{room.type}</Text>
                  </View>
                  <View style={[
                    styles.occupancyBadge,
                    { backgroundColor: occupied === room.beds.length ? colors.redBg : colors.greenBg },
                  ]}>
                    <Text style={[
                      styles.occupancyText,
                      { color: occupied === room.beds.length ? colors.redText : colors.greenText },
                    ]}>
                      {occupied}/{room.beds.length}
                    </Text>
                  </View>
                </View>

                <View style={styles.bedsRow}>
                  {room.beds.map((bed: Bed) => (
                    <View key={bed.id} style={styles.bedItem}>
                      <View style={[
                        styles.bedDot,
                        { backgroundColor: bed.isOccupied ? colors.red500 : colors.green500 },
                      ]} />
                      <Text style={styles.bedLabel}>{bed.label}</Text>
                      <Text style={styles.bedRent}>{fmt(bed.monthlyRent)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  hero: { paddingHorizontal: 20, paddingBottom: 24, overflow: 'hidden' },
  heroRing: {
    position: 'absolute', right: -60, top: -60,
    width: 200, height: 200, borderRadius: 100,
    borderWidth: 40, borderColor: 'rgba(255,255,255,0.05)',
  },
  heroTitle: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2, marginBottom: 10 },

  propStrip: { flexDirection: 'row', gap: 8, paddingBottom: 12 },
  propChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  propChipActive: { backgroundColor: '#fff' },
  propChipText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  propChipTextActive: { color: colors.primary },

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
  emptyText: { fontSize: 14, color: colors.gray400, fontWeight: '500' },

  listContent: { padding: 16, gap: 10, paddingBottom: 40 },
  roomCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  roomHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  roomNumber: { fontSize: 15, fontWeight: '700', color: colors.gray900 },
  roomFloor: { fontSize: 11, color: colors.gray400, marginTop: 1 },
  typeBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  typeText: { fontSize: 10, fontWeight: '700' },
  occupancyBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  occupancyText: { fontSize: 10, fontWeight: '700' },

  bedsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bedItem: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.gray50, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  bedDot: { width: 8, height: 8, borderRadius: 4 },
  bedLabel: { fontSize: 11, fontWeight: '600', color: colors.gray700 },
  bedRent: { fontSize: 10, color: colors.gray500 },
});
