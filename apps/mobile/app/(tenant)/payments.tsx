import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import {
  getTenantRentHistory,
  createPaymentOrder,
  verifyPayment,
  type RentCycleSummary,
} from '../../src/lib/tenant-api';
import { useAsync } from '../../src/lib/hooks';
import { formatCurrency, formatDate } from '../../src/lib/format';
import { API_BASE_URL } from '../../src/lib/api';
import { colors } from '../../src/theme';

// ─── Constants ───────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; payable: boolean }> = {
  PENDING: { label: 'Pending',  color: '#92400e', bg: '#fef3c7', payable: true  },
  PAID:    { label: 'Paid',     color: '#065f46', bg: '#d1fae5', payable: false },
  PARTIAL: { label: 'Partial',  color: '#1e40af', bg: '#dbeafe', payable: true  },
  OVERDUE: { label: 'Overdue',  color: '#991b1b', bg: '#fee2e2', payable: true  },
  WAIVED:  { label: 'Waived',   color: '#374151', bg: colors.gray100, payable: false },
};

// ─── Payment hook ─────────────────────────────────────────────────────────────

function parseCallbackUrl(url: string): Record<string, string> {
  const query = url.includes('?') ? url.split('?')[1]! : '';
  const result: Record<string, string> = {};
  for (const part of query.split('&')) {
    const [k, v] = part.split('=');
    if (k) result[k] = decodeURIComponent(v ?? '');
  }
  return result;
}

function useRazorpayPayment(onSuccess: () => void) {
  const [payingId, setPayingId]   = useState<string | null>(null);
  const [payMessage, setPayMsg]   = useState<string | null>(null);

  const pay = useCallback(async (cycle: RentCycleSummary) => {
    if (payingId) return;
    setPayingId(cycle.id);
    setPayMsg(null);

    try {
      // 1. Create Razorpay order (authenticated)
      const order = await createPaymentOrder({
        rentCycleId: cycle.id,
        amount: cycle.remainingAmount,
      });

      // 2. Build checkout URL for the backend-hosted HTML page
      const params = new URLSearchParams({
        orderId:        order.orderId,
        keyId:          order.keyId,
        amount:         String(order.amount),   // paise (from Razorpay)
        currency:       order.currency,
        name:           order.tenant.name,
        email:          order.tenant.email,
        phone:          order.tenant.phone ?? '',
        rentCycleId:    cycle.id,
        callbackScheme: 'pgmanager',
      });
      const checkoutUrl = `${API_BASE_URL}/tenant/pay/checkout?${params.toString()}`;

      // 3. Open Razorpay checkout in an in-app browser session.
      //    openAuthSessionAsync intercepts navigation to `pgmanager://` and returns the URL.
      const result = await WebBrowser.openAuthSessionAsync(checkoutUrl, 'pgmanager://');

      if (result.type === 'success') {
        const parsed = parseCallbackUrl(result.url);

        if (result.url.includes('pay-success')) {
          // 4. Verify the signature server-side and record the payment
          await verifyPayment({
            rentCycleId:        parsed.rentCycleId ?? cycle.id,
            razorpayOrderId:    parsed.orderId     ?? '',
            razorpayPaymentId:  parsed.paymentId   ?? '',
            razorpaySignature:  parsed.signature   ?? '',
          });
          setPayMsg('✅ Payment successful! Your rent is recorded.');
          onSuccess();
        } else {
          // pay-cancel — user dismissed
          setPayMsg(null);
        }
      } else {
        // Browser dismissed without completing
        setPayMsg(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Payment failed. Please try again.';
      Alert.alert('Payment Error', msg);
    } finally {
      setPayingId(null);
    }
  }, [payingId, onSuccess]);

  return { pay, payingId, payMessage, clearMessage: () => setPayMsg(null) };
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PaymentsScreen() {
  const { data, loading, error, refetch } = useAsync(getTenantRentHistory, []);
  const cycles = data ?? [];

  const { pay, payingId, payMessage, clearMessage } = useRazorpayPayment(refetch);

  const totalPending = cycles
    .filter((c) => c.status === 'PENDING' || c.status === 'OVERDUE' || c.status === 'PARTIAL')
    .reduce((sum, c) => sum + c.remainingAmount, 0);

  return (
    <View style={styles.container}>
      {loading && !data && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={24} color="#dc2626" />
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
        {/* Success toast */}
        {payMessage && (
          <TouchableOpacity style={styles.successBanner} onPress={clearMessage} activeOpacity={0.85}>
            <Text style={styles.successBannerText}>{payMessage}</Text>
            <Ionicons name="close" size={16} color="#065f46" />
          </TouchableOpacity>
        )}

        {/* Outstanding dues summary */}
        {totalPending > 0 && (
          <View style={styles.dueBanner}>
            <View style={styles.dueBannerTop}>
              <View>
                <Text style={styles.dueBannerLabel}>Total Outstanding</Text>
                <Text style={styles.dueBannerAmount}>{formatCurrency(totalPending)}</Text>
              </View>
              <Ionicons name="alert-circle" size={28} color="#ef4444" />
            </View>
            <Text style={styles.dueBannerSub}>
              Tap <Text style={{ fontWeight: '700' }}>Pay Now</Text> on any pending cycle below
            </Text>
          </View>
        )}

        {/* Empty state */}
        {cycles.length === 0 && !loading && (
          <View style={styles.emptyBox}>
            <Ionicons name="wallet-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No rent cycles yet</Text>
            <Text style={styles.emptyText}>Your rent history will appear here.</Text>
          </View>
        )}

        {/* Rent cycle cards */}
        {cycles.map((cycle) => {
          const cfg = STATUS_CONFIG[cycle.status] ?? {
            label: cycle.status, color: '#374151', bg: colors.gray100, payable: false,
          };
          const pct = cycle.expectedRent > 0
            ? Math.min(100, (cycle.paidAmount / cycle.expectedRent) * 100)
            : 0;
          const isPaying = payingId === cycle.id;

          return (
            <View key={cycle.id} style={styles.cycleCard}>
              {/* Header row */}
              <View style={styles.cycleTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cyclePeriod}>
                    {MONTH_NAMES[(cycle.month - 1) % 12]} {cycle.year}
                  </Text>
                  <Text style={styles.cycleDue}>Due by {formatDate(cycle.dueDate)}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
                  <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
              </View>

              {/* Payment progress bar */}
              <View style={styles.progressBg}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${pct}%` as `${number}%`,
                      backgroundColor:
                        cycle.status === 'OVERDUE' ? colors.red500 :
                        cycle.status === 'PAID'    ? '#10b981' :
                        colors.primary,
                    },
                  ]}
                />
              </View>

              {/* Amount breakdown */}
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

              {/* Pay Now button — only for payable statuses */}
              {cfg.payable && cycle.remainingAmount > 0 && (
                <TouchableOpacity
                  style={[styles.payBtn, isPaying && styles.payBtnDisabled]}
                  onPress={() => pay(cycle)}
                  disabled={!!payingId}
                  activeOpacity={0.82}
                >
                  {isPaying ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Ionicons name="card-outline" size={16} color="#fff" />
                  )}
                  <Text style={styles.payBtnText}>
                    {isPaying ? 'Processing…' : `Pay ${formatCurrency(cycle.remainingAmount)}`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray100 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },

  errorBox: {
    margin: 16,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  errorText:  { color: '#dc2626', fontSize: 14, textAlign: 'center' },
  retryBtn:   { marginTop: 4, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#dc2626', borderRadius: 8 },
  retryText:  { color: '#fff', fontWeight: '600', fontSize: 13 },

  list: { padding: 16, gap: 12, paddingBottom: 40 },

  successBanner: {
    backgroundColor: '#d1fae5',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  successBannerText: { flex: 1, color: '#065f46', fontSize: 13, fontWeight: '600', marginRight: 8 },

  dueBanner: {
    backgroundColor: '#fef2f2',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
    gap: 8,
  },
  dueBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dueBannerLabel:  { fontSize: 10, color: '#991b1b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  dueBannerAmount: { fontSize: 28, fontWeight: '800', color: '#dc2626', marginTop: 2 },
  dueBannerSub:    { fontSize: 12, color: '#6b7280' },

  emptyBox:   { paddingVertical: 72, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151' },
  emptyText:  { fontSize: 13, color: '#9ca3af' },

  cycleCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    gap: 0,
  },
  cycleTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cyclePeriod: { fontSize: 16, fontWeight: '700', color: '#111827' },
  cycleDue:    { fontSize: 12, color: '#9ca3af', marginTop: 3 },
  badge:        { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText:    { fontSize: 11, fontWeight: '700' },

  progressBg: {
    height: 5,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressFill: { height: 5, borderRadius: 3 },

  amountsRow: { flexDirection: 'row', alignItems: 'center' },
  amountDivider: { width: 1, height: 30, backgroundColor: '#e5e7eb', marginHorizontal: 12 },
  amountItem:    { flex: 1 },
  amountLabel:   { fontSize: 10, color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  amountValue:   { fontSize: 14, fontWeight: '700', color: '#111827', marginTop: 3 },

  payBtn: {
    marginTop: 16,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  payBtnDisabled: { backgroundColor: '#a5b4fc' },
  payBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
