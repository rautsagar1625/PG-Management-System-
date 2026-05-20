import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getOperatorComplaints,
  getOperatorProperties,
  updateOperatorComplaint,
  type OperatorComplaint,
  type ComplaintStatus,
} from '../../src/lib/operator-api';
import { useAsync } from '../../src/lib/hooks';
import { formatDate } from '../../src/lib/format';
import { colors } from '../../src/theme';

const STATUS_FILTERS = ['ALL', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REOPENED', 'CLOSED'];

const STATUS_CONFIG: Record<ComplaintStatus, { label: string; color: string; bg: string }> = {
  OPEN:        { label: 'Open',        color: colors.redText,    bg: colors.redBg },
  ASSIGNED:    { label: 'Assigned',    color: colors.yellowText, bg: colors.yellowBg },
  IN_PROGRESS: { label: 'In Progress', color: colors.blueText,   bg: colors.blueBg },
  RESOLVED:    { label: 'Resolved',    color: colors.greenText,  bg: colors.greenBg },
  REOPENED:    { label: 'Reopened',    color: colors.violetText, bg: colors.violetBg },
  CLOSED:      { label: 'Closed',      color: colors.gray500,    bg: colors.gray100 },
  REJECTED:    { label: 'Rejected',    color: colors.gray500,    bg: colors.gray100 },
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: colors.gray400, MEDIUM: colors.primary, HIGH: colors.yellow400, URGENT: colors.red500,
};

const NEXT_STATUSES: Record<ComplaintStatus, ComplaintStatus[]> = {
  OPEN:        ['ASSIGNED', 'IN_PROGRESS', 'REJECTED'],
  ASSIGNED:    ['IN_PROGRESS', 'RESOLVED', 'REJECTED'],
  IN_PROGRESS: ['RESOLVED', 'CLOSED', 'REJECTED'],
  RESOLVED:    ['REOPENED', 'CLOSED'],
  REOPENED:    ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  CLOSED:      [],
  REJECTED:    [],
};

function ComplaintCard({
  complaint,
  onPress,
}: {
  complaint: OperatorComplaint;
  onPress: () => void;
}) {
  const sCfg = STATUS_CONFIG[complaint.status];
  const priColor = PRIORITY_COLORS[complaint.priority] ?? colors.gray400;

  return (
    <TouchableOpacity
      style={[styles.card, complaint.priority === 'URGENT' && styles.urgentCard]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.cardTop}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>{complaint.title}</Text>
          <Text style={styles.cardMeta}>
            {complaint.category.replace(/_/g, ' ')} · {formatDate(complaint.createdAt)}
          </Text>
          {complaint.tenant && (
            <Text style={styles.cardTenant} numberOfLines={1}>
              <Ionicons name="person-outline" size={10} /> {complaint.tenant.user.name}
            </Text>
          )}
        </View>
        <View style={[styles.badge, { backgroundColor: sCfg.bg }]}>
          <Text style={[styles.badgeText, { color: sCfg.color }]}>{sCfg.label}</Text>
        </View>
      </View>

      <View style={styles.cardBottom}>
        <View style={styles.priorityRow}>
          <View style={[styles.dot, { backgroundColor: priColor }]} />
          <Text style={styles.priorityText}>
            {complaint.priority.charAt(0) + complaint.priority.slice(1).toLowerCase()} priority
          </Text>
        </View>
        {complaint.updates.length > 0 && (
          <Text style={styles.updatesCount}>{complaint.updates.length} update{complaint.updates.length !== 1 ? 's' : ''}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function UpdateModal({
  complaint,
  visible,
  onClose,
  onSuccess,
}: {
  complaint: OperatorComplaint | null;
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [newStatus, setNewStatus] = useState<ComplaintStatus | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setNewStatus(null);
    setComment('');
  };

  const submit = async () => {
    if (!complaint) return;
    if (!newStatus && !comment.trim()) {
      Alert.alert('Required', 'Select a new status or enter a comment.');
      return;
    }
    setSubmitting(true);
    try {
      await updateOperatorComplaint(complaint.id, {
        ...(newStatus ? { status: newStatus } : {}),
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      });
      reset();
      onSuccess();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!complaint) return null;
  const nextOptions = NEXT_STATUSES[complaint.status];
  const sCfg = STATUS_CONFIG[complaint.status];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={upModal.container}>
          <View style={upModal.header}>
            <TouchableOpacity onPress={() => { onClose(); reset(); }}>
              <Text style={upModal.cancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={upModal.title}>Update Complaint</Text>
            <TouchableOpacity
              onPress={submit}
              disabled={submitting}
              style={[upModal.submitBtn, submitting && { opacity: 0.5 }]}
            >
              {submitting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={upModal.submitText}>Update</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={upModal.body} keyboardShouldPersistTaps="handled">
            {/* Context */}
            <View style={upModal.context}>
              <Text style={upModal.contextTitle} numberOfLines={2}>{complaint.title}</Text>
              <Text style={upModal.contextSub}>
                {complaint.category.replace(/_/g, ' ')} ·{' '}
                {complaint.tenant?.user.name ?? 'Staff raised'}
              </Text>
              <View style={[upModal.currentPill, { backgroundColor: sCfg.bg }]}>
                <Text style={[upModal.currentPillText, { color: sCfg.color }]}>
                  Current: {sCfg.label}
                </Text>
              </View>
            </View>

            {nextOptions.length > 0 && (
              <>
                <Text style={upModal.label}>Move to Status</Text>
                <View style={upModal.statusGrid}>
                  {nextOptions.map((s) => {
                    const cfg = STATUS_CONFIG[s];
                    return (
                      <TouchableOpacity
                        key={s}
                        onPress={() => setNewStatus(newStatus === s ? null : s)}
                        style={[
                          upModal.statusBtn,
                          newStatus === s && { backgroundColor: cfg.bg, borderColor: cfg.color },
                        ]}
                      >
                        <Text
                          style={[
                            upModal.statusBtnText,
                            newStatus === s && { color: cfg.color, fontWeight: '700' },
                          ]}
                        >
                          {cfg.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <Text style={[upModal.label, { marginTop: nextOptions.length > 0 ? 16 : 0 }]}>
              Comment (optional)
            </Text>
            <TextInput
              style={upModal.textarea}
              value={comment}
              onChangeText={setComment}
              placeholder="Add a note or update…"
              placeholderTextColor={colors.gray400}
              multiline
              textAlignVertical="top"
            />

            {/* Previous updates */}
            {complaint.updates.length > 0 && (
              <View style={upModal.updatesBox}>
                <Text style={upModal.updatesLabel}>History</Text>
                {complaint.updates.slice().reverse().map((u) => (
                  <View key={u.id} style={upModal.updateItem}>
                    {u.statusChange && (
                      <Text style={upModal.updateStatus}>{u.statusChange}</Text>
                    )}
                    <Text style={upModal.updateComment}>{u.comment}</Text>
                    <Text style={upModal.updateDate}>{formatDate(u.createdAt)}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function OperatorComplaintsScreen() {
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [propertyId, setPropertyId] = useState('');
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [active, setActive] = useState<OperatorComplaint | null>(null);

  useAsync(
    useCallback(async () => {
      const props = await getOperatorProperties();
      setProperties(props);
      const [first] = props;
      if (first && !propertyId) setPropertyId(first.id);
      return props;
    }, []),
    [],
  );

  const { data, loading, error, refetch } = useAsync(
    useCallback(
      () =>
        propertyId
          ? getOperatorComplaints({ propertyId, status: statusFilter })
          : Promise.resolve([]),
      [propertyId, statusFilter],
    ),
    [propertyId, statusFilter],
  );

  const complaints = data ?? [];
  const openCount = complaints.filter((c) => c.status === 'OPEN').length;

  return (
    <View style={styles.container}>
      {/* Property picker */}
      {properties.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.propScroll}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 8 }}
        >
          {properties.map((p) => (
            <TouchableOpacity
              key={p.id}
              onPress={() => setPropertyId(p.id)}
              style={[styles.propChip, p.id === propertyId && styles.propChipActive]}
            >
              <Text style={[styles.propChipText, p.id === propertyId && styles.propChipTextActive]}>
                {p.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Summary pill */}
      {openCount > 0 && (
        <View style={styles.openBanner}>
          <Ionicons name="alert-circle" size={14} color={colors.red600} style={{ marginRight: 6 }} />
          <Text style={styles.openBannerText}>{openCount} open complaint{openCount !== 1 ? 's' : ''} need attention</Text>
        </View>
      )}

      {/* Status filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
      >
        {STATUS_FILTERS.map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => setStatusFilter(s)}
            style={[styles.filterChip, s === statusFilter && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, s === statusFilter && styles.filterChipTextActive]}>
              {s.replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading && !data && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
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

      <FlatList
        data={complaints}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <ComplaintCard complaint={item} onPress={() => setActive(item)} />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={loading && !!data}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyBox}>
              <Ionicons name="checkmark-circle-outline" size={44} color={colors.gray300} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>No complaints</Text>
              <Text style={styles.emptyText}>
                {statusFilter === 'OPEN' ? 'All caught up!' : 'No complaints for this filter.'}
              </Text>
            </View>
          ) : null
        }
      />

      <UpdateModal
        complaint={active}
        visible={!!active}
        onClose={() => setActive(null)}
        onSuccess={() => {
          setActive(null);
          refetch();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { paddingVertical: 48, alignItems: 'center' },

  propScroll: {},
  propChip: {
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  propChipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  propChipText: { fontSize: 12, color: colors.gray700, fontWeight: '500' },
  propChipTextActive: { color: colors.primary, fontWeight: '700' },

  openBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 4,
    marginBottom: 8,
    backgroundColor: colors.redBg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  openBannerText: { fontSize: 13, color: colors.red600, fontWeight: '600' },

  filterScroll: { marginBottom: 8 },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: 12, color: colors.gray600, fontWeight: '500' },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },

  list: { paddingHorizontal: 12, paddingBottom: 32, gap: 10 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  urgentCard: { borderLeftWidth: 3, borderLeftColor: colors.red500 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.gray900, lineHeight: 20 },
  cardMeta: { fontSize: 11, color: colors.gray400, marginTop: 2 },
  cardTenant: { fontSize: 11, color: colors.gray500, marginTop: 2 },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 0 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priorityRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  priorityText: { fontSize: 11, color: colors.gray500 },
  updatesCount: { fontSize: 11, color: colors.gray400 },

  errorBox: { margin: 16, backgroundColor: '#fef2f2', borderRadius: 12, padding: 16, alignItems: 'center' },
  errorText: { color: colors.red600, fontSize: 14, textAlign: 'center' },
  retryBtn: { marginTop: 10, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: colors.red500, borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  emptyBox: { paddingVertical: 60, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.gray700, marginBottom: 4 },
  emptyText: { fontSize: 13, color: colors.gray400, textAlign: 'center' },
});

const upModal = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  cancel: { fontSize: 15, color: colors.gray500, fontWeight: '500' },
  title: { fontSize: 17, fontWeight: '700', color: colors.gray900 },
  submitBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  body: { padding: 20, paddingBottom: 48 },

  context: {
    backgroundColor: colors.gray50,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  contextTitle: { fontSize: 15, fontWeight: '700', color: colors.gray900, lineHeight: 22 },
  contextSub: { fontSize: 12, color: colors.gray500, marginTop: 4 },
  currentPill: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginTop: 10 },
  currentPillText: { fontSize: 11, fontWeight: '700' },

  label: { fontSize: 13, fontWeight: '600', color: colors.gray700, marginBottom: 10 },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusBtn: {
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: '#fff',
  },
  statusBtnText: { fontSize: 13, color: colors.gray600, fontWeight: '500' },

  textarea: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.gray900,
    backgroundColor: colors.gray50,
    minHeight: 100,
  },

  updatesBox: { marginTop: 20, backgroundColor: colors.gray50, borderRadius: 12, padding: 14 },
  updatesLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  updateItem: { marginBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.gray100, paddingBottom: 12 },
  updateStatus: { fontSize: 11, fontWeight: '700', color: colors.primary, marginBottom: 3 },
  updateComment: { fontSize: 13, color: colors.gray700, lineHeight: 18 },
  updateDate: { fontSize: 11, color: colors.gray400, marginTop: 3 },
});
