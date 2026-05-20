import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getTenantRentHistory } from '../../src/lib/tenant-api';
import { useAsync } from '../../src/lib/hooks';
import { formatCurrency, formatDate } from '../../src/lib/format';
import { colors } from '../../src/theme';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Pending',  color: '#92400e', bg: '#fef3c7' },
  PAID:    { label: 'Paid',     color: '#065f46', bg: '#d1fae5' },
  PARTIAL: { label: 'Partial',  color: '#1e40af', bg: '#dbeafe' },
  OVERDUE: { label: 'Overdue',  color: '#991b1b', bg: '#fee2e2' },
  WAIVED:  { label: 'Waived',   color: '#374151', bg: colors.gray100 },
};

export default function PaymentsScreen() {
  const { data, loading, error, refetch } = useAsync(getTenantRentHistory, []);
  const cycles = data ?? [];

  const totalPending = cycles
    .filter((c) => c.status === 'PENDING' || c.status === 'OVERDUE' || c.status === 'PARTIAL')
    .reduce((sum, c) => sum + c.remainingAmount, 0);

  return (
    <View style={styles.container}>
      {loading && !data && (
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

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={refetch} />}
      >
        {totalPending > 0 && (
          <View style={styles.dueBanner}>
            <Text style={styles.dueBannerLabel}>Total Outstanding</Text>
            <Text style={styles.dueBannerAmount}>{formatCurrency(totalPending)}</Text>
            <Text style={styles.dueBannerSub}>Pay at the front desk or via UPI</Text>
          </View>
        )}

        {cycles.length === 0 && !loading && (
          <View style={styles.emptyBox}>
            <Ionicons name="wallet-outline" size={44} color="#d1d5db" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>No rent cycles yet</Text>
            <Text style={styles.emptyText}>Your rent history will appear here.</Text>
          </View>
        )}

        {cycles.map((cycle) => {
          const cfg = STATUS_CONFIG[cycle.status] ?? { label: cycle.status, color: '#374151', bg: colors.gray100 };
          const pct = cycle.expectedRent > 0
            ? Math.min(100, (cycle.paidAmount / cycle.expectedRent) * 100)
            : 0;

          return (
            <View key={cycle.id} style={styles.cycleCard}>
              <View style={styles.cycleTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cyclePeriod}>
                    {MONTH_NAMES[cycle.month - 1]} {cycle.year}
                  </Text>
                  <Text style={styles.cycleDue}>Due by {formatDate(cycle.dueDate)}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
                  <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
              </View>

              {/* Progress bar */}
              <View style={styles.progressBg}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${pct}%` as `${number}%`,
                      backgroundColor: cycle.status === 'OVERDUE' ? colors.red500 : colors.primary,
                    },
                  ]}
                />
              </View>

              {/* Amounts */}
              <View style={styles.amountsRow}>
                <View style={styles.amountItem}>
                  <Text style={styles.amountLabel}>Expected</Text>
                  <Text style={styles.amountValue}>{formatCurrency(cycle.expectedRent)}</Text>
                </View>
                <View style={styles.amountDivider} />
                <View style={styles.amountItem}>
                  <Text style={styles.amountLabel}>Paid</Text>
                  <Text style={[styles.amountValue, { color: '#10b981' }]}>
                    {formatCurrency(cycle.paidAmount)}
                  </Text>
                </View>
                {cycle.remainingAmount > 0 && (
                  <>
                    <View style={styles.amountDivider} />
                    <View style={styles.amountItem}>
                      <Text style={styles.amountLabel}>Due</Text>
                      <Text style={[styles.amountValue, { color: colors.red500 }]}>
                        {formatCurrency(cycle.remainingAmount)}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray100 },
  center: { paddingVertical: 60, alignItems: 'center' },
  errorBox: {
    margin: 16,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  errorText: { color: '#dc2626', fontSize: 14, textAlign: 'center' },
  retryBtn: {
    marginTop: 10,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#dc2626',
    borderRadius: 8,
  },
  retryText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  list: { padding: 16, gap: 12, paddingBottom: 32 },

  dueBanner: {
    backgroundColor: '#fef2f2',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginBottom: 4,
  },
  dueBannerLabel: {
    fontSize: 10,
    color: '#991b1b',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dueBannerAmount: { fontSize: 28, fontWeight: '700', color: '#dc2626', marginTop: 4 },
  dueBannerSub: { fontSize: 12, color: '#9ca3af', marginTop: 4 },

  emptyBox: { paddingVertical: 60, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginBottom: 4 },
  emptyText: { fontSize: 13, color: '#9ca3af' },

  cycleCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cycleTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cyclePeriod: { fontSize: 16, fontWeight: '700', color: '#111827' },
  cycleDue: { fontSize: 12, color: '#9ca3af', marginTop: 3 },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  progressBg: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressFill: { height: 4, borderRadius: 2 },

  amountsRow: { flexDirection: 'row', alignItems: 'center' },
  amountDivider: { width: 1, height: 28, backgroundColor: '#e5e7eb', marginHorizontal: 12 },
  amountItem: { flex: 1 },
  amountLabel: { fontSize: 10, color: '#9ca3af', fontWeight: '500', textTransform: 'uppercase' },
  amountValue: { fontSize: 14, fontWeight: '700', color: '#111827', marginTop: 2 },
});
