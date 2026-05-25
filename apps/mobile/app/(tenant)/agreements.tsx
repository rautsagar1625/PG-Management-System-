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
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import {
  getTenantAgreements,
  signTenantAgreement,
  type TenantAgreement,
} from '../../src/lib/tenant-api';
import { useAsync } from '../../src/lib/hooks';
import { formatCurrency, formatDate } from '../../src/lib/format';
import { colors } from '../../src/theme';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  DRAFT:     { label: 'Draft',     color: '#374151', bg: '#f3f4f6',  icon: 'document-outline' },
  SENT:      { label: 'Awaiting',  color: '#92400e', bg: '#fef3c7',  icon: 'time-outline' },
  SIGNED:    { label: 'Signed',    color: '#065f46', bg: '#d1fae5',  icon: 'checkmark-circle' },
  EXPIRED:   { label: 'Expired',   color: '#6b7280', bg: '#f3f4f6',  icon: 'close-circle-outline' },
  CANCELLED: { label: 'Cancelled', color: '#991b1b', bg: '#fee2e2',  icon: 'ban-outline' },
};

// ─── Agreement card ───────────────────────────────────────────────────────────

interface AgreementCardProps {
  agreement: TenantAgreement;
  onSign: (id: string) => void;
  signing: boolean;
}

function AgreementCard({ agreement, onSign, signing }: AgreementCardProps) {
  const cfg = STATUS_CONFIG[agreement.status] ?? STATUS_CONFIG.DRAFT;
  const canSign = agreement.status === 'SENT' && !agreement.signedByTenantAt;
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={cardStyles.container}>
      {/* Header */}
      <TouchableOpacity
        style={cardStyles.header}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.8}
      >
        <View style={{ flex: 1 }}>
          <View style={cardStyles.titleRow}>
            <Text style={cardStyles.title}>
              Rental Agreement
            </Text>
            <View style={[cardStyles.badge, { backgroundColor: cfg.bg }]}>
              <Ionicons
                name={cfg.icon as React.ComponentProps<typeof Ionicons>['name']}
                size={11}
                color={cfg.color}
                style={{ marginRight: 3 }}
              />
              <Text style={[cardStyles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>
          <Text style={cardStyles.period}>
            From {formatDate(agreement.startDate)}
            {agreement.endDate ? ` to ${formatDate(agreement.endDate)}` : ' (ongoing)'}
          </Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color="#9ca3af"
          style={{ marginLeft: 8 }}
        />
      </TouchableOpacity>

      {/* Expanded details */}
      {expanded && (
        <View style={cardStyles.details}>
          {/* Financial summary */}
          <View style={cardStyles.financialRow}>
            <View style={cardStyles.financialItem}>
              <Text style={cardStyles.financialLabel}>Monthly Rent</Text>
              <Text style={cardStyles.financialValue}>{formatCurrency(agreement.rentAmount)}</Text>
            </View>
            <View style={cardStyles.financialDivider} />
            <View style={cardStyles.financialItem}>
              <Text style={cardStyles.financialLabel}>Deposit</Text>
              <Text style={cardStyles.financialValue}>{formatCurrency(agreement.depositAmount)}</Text>
            </View>
          </View>

          {/* Signature status */}
          <View style={cardStyles.signaturesRow}>
            <View style={cardStyles.sigBadge}>
              <Ionicons
                name={agreement.signedByTenantAt ? 'checkmark-circle' : 'time-outline'}
                size={14}
                color={agreement.signedByTenantAt ? '#065f46' : '#9ca3af'}
              />
              <Text style={[cardStyles.sigText, { color: agreement.signedByTenantAt ? '#065f46' : '#9ca3af' }]}>
                {agreement.signedByTenantAt
                  ? `You signed ${formatDate(agreement.signedByTenantAt)}`
                  : 'Awaiting your signature'}
              </Text>
            </View>
            <View style={cardStyles.sigBadge}>
              <Ionicons
                name={agreement.signedByOwnerAt ? 'checkmark-circle' : 'time-outline'}
                size={14}
                color={agreement.signedByOwnerAt ? '#065f46' : '#9ca3af'}
              />
              <Text style={[cardStyles.sigText, { color: agreement.signedByOwnerAt ? '#065f46' : '#9ca3af' }]}>
                {agreement.signedByOwnerAt
                  ? `Owner signed ${formatDate(agreement.signedByOwnerAt)}`
                  : 'Awaiting owner signature'}
              </Text>
            </View>
          </View>

          {/* Terms preview */}
          {agreement.terms && (
            <View style={cardStyles.termsBox}>
              <Text style={cardStyles.termsLabel}>Terms</Text>
              <Text style={cardStyles.termsText} numberOfLines={4}>
                {agreement.terms}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Sign CTA */}
      {canSign && (
        <TouchableOpacity
          style={[cardStyles.signBtn, signing && cardStyles.signBtnDisabled]}
          onPress={() => onSign(agreement.id)}
          disabled={signing}
          activeOpacity={0.85}
        >
          {signing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="pencil" size={16} color="#fff" />
          )}
          <Text style={cardStyles.signBtnText}>
            {signing ? 'Signing…' : 'Sign Agreement'}
          </Text>
        </TouchableOpacity>
      )}

      {agreement.signedByTenantAt && agreement.signedByOwnerAt && agreement.status === 'SIGNED' && (
        <View style={cardStyles.fullySignedBanner}>
          <Ionicons name="checkmark-circle" size={16} color="#065f46" />
          <Text style={cardStyles.fullySignedText}>
            Fully executed — agreement is active
          </Text>
        </View>
      )}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  title:    { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1, marginRight: 8 },
  period:   { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  badge:    { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '700' },

  details: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },

  financialRow: { flexDirection: 'row', backgroundColor: '#f9fafb', borderRadius: 10, padding: 12 },
  financialItem: { flex: 1, alignItems: 'center' },
  financialDivider: { width: 1, backgroundColor: '#e5e7eb', marginHorizontal: 8 },
  financialLabel: { fontSize: 10, color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  financialValue: { fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 3 },

  signaturesRow: { gap: 6 },
  sigBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sigText:  { fontSize: 12, fontWeight: '500' },

  termsBox: { backgroundColor: '#f9fafb', borderRadius: 8, padding: 10 },
  termsLabel: { fontSize: 10, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', marginBottom: 4 },
  termsText: { fontSize: 12, color: '#374151', lineHeight: 18 },

  signBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    padding: 14,
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
  },
  signBtnDisabled: { backgroundColor: '#a5b4fc' },
  signBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  fullySignedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#d1fae5',
    padding: 12,
    margin: 16,
    marginTop: 0,
    borderRadius: 10,
  },
  fullySignedText: { fontSize: 13, color: '#065f46', fontWeight: '600', flex: 1 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function AgreementsScreen() {
  const [signingId, setSigningId] = useState<string | null>(null);

  const { data: agreements, loading, error, refetch } = useAsync(getTenantAgreements, []);

  const handleSign = useCallback(async (agreementId: string) => {
    Alert.alert(
      'Sign Agreement',
      'By signing, you confirm that you have read and agree to all terms in this rental agreement. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Now',
          onPress: async () => {
            setSigningId(agreementId);
            try {
              await signTenantAgreement(agreementId);
              Alert.alert('✅ Signed!', 'Your signature has been recorded. The agreement will be fully active once the owner also signs.');
              refetch();
            } catch (err: unknown) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Could not sign the agreement.');
            } finally {
              setSigningId(null);
            }
          },
        },
      ],
    );
  }, [refetch]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={loading && !!agreements} onRefresh={refetch} />}
    >
      {/* Info banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle-outline" size={18} color="#1e40af" style={{ marginRight: 8 }} />
        <Text style={styles.infoBannerText}>
          Agreements sent by your PG will appear here. Sign them digitally to make them legally binding.
        </Text>
      </View>

      {/* Loading */}
      {loading && !agreements && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      )}

      {/* Error */}
      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={22} color="#dc2626" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={refetch} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Empty state */}
      {agreements && agreements.length === 0 && (
        <View style={styles.emptyBox}>
          <Ionicons name="document-text-outline" size={48} color="#d1d5db" />
          <Text style={styles.emptyTitle}>No agreements yet</Text>
          <Text style={styles.emptyText}>
            Your operator hasn't sent any agreements yet. Check back later.
          </Text>
        </View>
      )}

      {/* Agreement list */}
      {agreements?.map((agreement) => (
        <AgreementCard
          key={agreement.id}
          agreement={agreement}
          onSign={handleSign}
          signing={signingId === agreement.id}
        />
      ))}

      {/* Help note */}
      <View style={styles.helpBox}>
        <Text style={styles.helpText}>
          💡 Questions about your agreement? Contact your PG operator directly.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray100 },
  list:      { padding: 16, gap: 12, paddingBottom: 40 },

  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#dbeafe',
    borderRadius: 12,
    padding: 12,
  },
  infoBannerText: { flex: 1, fontSize: 13, color: '#1e40af', lineHeight: 18 },

  center:     { paddingVertical: 48, alignItems: 'center' },
  errorBox:   { backgroundColor: '#fef2f2', borderRadius: 12, padding: 16, alignItems: 'center', gap: 8 },
  errorText:  { color: '#dc2626', fontSize: 14, textAlign: 'center' },
  retryBtn:   { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#dc2626', borderRadius: 8 },
  retryText:  { color: '#fff', fontWeight: '600', fontSize: 13 },

  emptyBox:   { paddingVertical: 60, alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151' },
  emptyText:  { fontSize: 13, color: '#9ca3af', textAlign: 'center', lineHeight: 19 },

  helpBox:  { backgroundColor: '#f9fafb', borderRadius: 10, padding: 12 },
  helpText: { fontSize: 12, color: '#6b7280', textAlign: 'center', lineHeight: 17 },
});
