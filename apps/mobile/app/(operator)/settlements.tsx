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

interface Settlement {
  id: string;
  month: number;
  year: number;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  totalCollected: number;
  ownerPayout: number;
  operatorProfit: number;
  settledAt?: string | null;
  createdAt: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmt(n: number) {
  return n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  PAID:      { bg: colors.greenBg,  color: colors.greenText },
  PENDING:   { bg: colors.yellowBg, color: colors.yellowText },
  CANCELLED: { bg: colors.redBg,    color: colors.redText },
};

export default function SettlementsScreen() {
  const { top } = useSafeAreaInsets();

  // WF-001: property picker — replaces hardcoded properties[0]
  const { properties, propertyId, setPropertyId } = useOperatorProperty();

  const { data: settlements, loading, refetch } = useAsync(async () => {
    if (!propertyId) return [];
    const res = await api.get<{ success: boolean; data: Settlement[] }>(
      `/settlements/property/${encodeURIComponent(propertyId)}`,
    );
    return res.data;
  }, [propertyId]);

  const totalPaid = (settlements ?? [])
    .filter((s: Settlement) => s.status === 'PAID')
    .reduce((acc: number, s: Settlement) => acc + Number(s.ownerPayout), 0);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1e1b4b', '#312e81', '#4f46e5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: top + 20 }]}
      >
        <View style={styles.heroRing} />
        <Text style={styles.heroTitle}>Settlements</Text>
        <Text style={styles.heroSub}>
          {(settlements ?? []).length} record{(settlements ?? []).length !== 1 ? 's' : ''}
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
            <Text style={styles.heroStripValue}>{fmt(totalPaid)}</Text>
            <Text style={styles.heroStripLabel}>Total Paid Out</Text>
          </View>
          <View style={styles.heroStripDivider} />
          <View style={styles.heroStripItem}>
            <Text style={styles.heroStripValue}>
              {(settlements ?? []).filter((s: Settlement) => s.status === 'PENDING').length}
            </Text>
            <Text style={styles.heroStripLabel}>Pending</Text>
          </View>
        </View>
      </LinearGradient>

      {loading && !settlements ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (settlements ?? []).length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="wallet-outline" size={40} color={colors.gray300} style={{ marginBottom: 10 }} />
          <Text style={styles.emptyText}>No settlements yet</Text>
        </View>
      ) : (
        <FlatList
          data={settlements ?? []}
          keyExtractor={(s: Settlement) => s.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={loading && !!settlements} onRefresh={refetch} tintColor={colors.primary} />
          }
          renderItem={({ item: s }) => {
            const st = STATUS_STYLE[s.status] ?? { bg: colors.gray100, color: colors.gray700 };
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>
                    {MONTHS[(s.month - 1) % 12]} {s.year}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.statusText, { color: st.color }]}>{s.status}</Text>
                  </View>
                </View>
                <View style={styles.rows}>
                  <Row label="Total Collected" value={fmt(Number(s.totalCollected))} />
                  <Row label="Owner Payout" value={fmt(Number(s.ownerPayout))} highlight />
                  <Row label="Operator Profit" value={fmt(Number(s.operatorProfit))} />
                </View>
                {s.settledAt && (
                  <Text style={styles.settledDate}>
                    Settled on {new Date(s.settledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={[rowStyles.value, highlight && rowStyles.highlight]}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  label: { fontSize: 12, color: colors.gray500 },
  value: { fontSize: 13, fontWeight: '700', color: colors.gray900 },
  highlight: { color: colors.primary },
});

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
  heroStripValue: { fontSize: 16, fontWeight: '800', color: '#fff' },
  heroStripLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 14, color: colors.gray400, fontWeight: '500' },

  listContent: { padding: 16, gap: 10, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.gray900 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 10, fontWeight: '700' },
  rows: { gap: 0, borderTopWidth: 1, borderTopColor: colors.gray100, paddingTop: 10 },
  settledDate: { fontSize: 10, color: colors.gray400, marginTop: 8, fontStyle: 'italic' },
});
