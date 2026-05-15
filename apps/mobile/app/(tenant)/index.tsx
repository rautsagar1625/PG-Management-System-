import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { getTenantDashboard } from '../../src/lib/tenant-api';
import { useAsync } from '../../src/lib/hooks';
import { formatCurrency, formatMonth, formatDate } from '../../src/lib/format';

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  PAID: '#10b981',
  PARTIAL: '#3b82f6',
  OVERDUE: '#ef4444',
};

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function HomeScreen() {
  const { user } = useAuth();
  const { data, loading, error, refetch } = useAsync(getTenantDashboard, []);

  const dashboard = data;
  const cycle = dashboard?.currentCycle;
  const allocation = dashboard?.allocation;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={refetch} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0]} 👋</Text>
          {dashboard?.tenant.tenantCode && (
            <Text style={styles.subtext}>{dashboard.tenant.tenantCode}</Text>
          )}
        </View>
        {allocation && (
          <View style={styles.propertyBadge}>
            <Text style={styles.propertyName} numberOfLines={1}>
              {allocation.property.name}
            </Text>
          </View>
        )}
      </View>

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

      {dashboard && (
        <>
          {/* Room Card */}
          {allocation ? (
            <View style={styles.roomCard}>
              <Text style={styles.cardLabel}>Your Room</Text>
              <Text style={styles.roomNumber}>Room {allocation.room.roomNumber} — Bed {allocation.bed.label}</Text>
              {allocation.room.floor !== null && (
                <Text style={styles.roomSub}>Floor {allocation.room.floor}</Text>
              )}
              <Text style={styles.roomSub}>{allocation.property.address}, {allocation.property.city}</Text>
              <Text style={styles.roomSub}>Stay started {formatDate(allocation.startDate)}</Text>
            </View>
          ) : (
            <View style={styles.noRoom}>
              <Text style={styles.noRoomText}>No active room allocation</Text>
            </View>
          )}

          {/* Current Rent Status */}
          {cycle ? (
            <View style={styles.rentCard}>
              <View style={styles.rentHeader}>
                <Text style={styles.cardLabel}>{MONTH_NAMES[cycle.month - 1]} {cycle.year} Rent</Text>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[cycle.status] ?? '#6b7280' }]}>
                  <Text style={styles.statusText}>{cycle.status}</Text>
                </View>
              </View>

              <View style={styles.rentRow}>
                <View style={styles.rentStat}>
                  <Text style={styles.rentStatLabel}>Due</Text>
                  <Text style={styles.rentStatValue}>{formatCurrency(cycle.remainingAmount)}</Text>
                </View>
                <View style={styles.rentDivider} />
                <View style={styles.rentStat}>
                  <Text style={styles.rentStatLabel}>Paid</Text>
                  <Text style={[styles.rentStatValue, { color: '#10b981' }]}>{formatCurrency(cycle.paidAmount)}</Text>
                </View>
                <View style={styles.rentDivider} />
                <View style={styles.rentStat}>
                  <Text style={styles.rentStatLabel}>Total</Text>
                  <Text style={styles.rentStatValue}>{formatCurrency(cycle.expectedRent)}</Text>
                </View>
              </View>

              {/* Progress bar */}
              <View style={styles.progressBg}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(100, (cycle.paidAmount / cycle.expectedRent) * 100)}%` as `${number}%`,
                      backgroundColor: cycle.status === 'OVERDUE' ? '#ef4444' : '#4f46e5',
                    },
                  ]}
                />
              </View>
              <Text style={styles.dueDateText}>Due by {formatDate(cycle.dueDate)}</Text>
            </View>
          ) : (
            <View style={styles.noRentCard}>
              <Text style={styles.noRoomText}>No rent cycle for this month yet</Text>
            </View>
          )}

          {/* Deposit */}
          <View style={styles.depositCard}>
            <Text style={styles.cardLabel}>Security Deposit</Text>
            <Text style={styles.depositAmount}>{formatCurrency(dashboard.tenant.depositBalance)}</Text>
            <Text style={styles.depositSub}>Held on your behalf</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { paddingBottom: 24 },
  header: {
    backgroundColor: '#4f46e5',
    paddingTop: 56,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  greeting: { fontSize: 22, fontWeight: '700', color: '#fff' },
  subtext: { fontSize: 12, color: '#c7d2fe', marginTop: 2 },
  propertyBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: 140,
  },
  propertyName: { fontSize: 12, color: '#e0e7ff', fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  errorBox: { margin: 16, backgroundColor: '#fef2f2', borderRadius: 12, padding: 16, alignItems: 'center' },
  errorText: { color: '#dc2626', fontSize: 14, textAlign: 'center' },
  retryBtn: { marginTop: 10, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#dc2626', borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  roomCard: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  noRoom: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  noRoomText: { color: '#9ca3af', fontSize: 14 },
  cardLabel: { fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  roomNumber: { fontSize: 20, fontWeight: '700', color: '#111827' },
  roomSub: { fontSize: 13, color: '#6b7280', marginTop: 3 },
  rentCard: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  noRentCard: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  rentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  rentRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  rentStat: { flex: 1, alignItems: 'center' },
  rentDivider: { width: 1, height: 32, backgroundColor: '#e5e7eb' },
  rentStatLabel: { fontSize: 11, color: '#6b7280', marginBottom: 2 },
  rentStatValue: { fontSize: 16, fontWeight: '700', color: '#111827' },
  progressBg: { height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  dueDateText: { fontSize: 11, color: '#9ca3af', marginTop: 6 },
  depositCard: {
    margin: 16,
    backgroundColor: '#eef2ff',
    borderRadius: 16,
    padding: 16,
  },
  depositAmount: { fontSize: 24, fontWeight: '700', color: '#4f46e5', marginTop: 4 },
  depositSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
});
