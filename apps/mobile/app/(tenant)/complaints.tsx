import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getTenantComplaints, createTenantComplaint } from '../../src/lib/tenant-api';
import { useAsync } from '../../src/lib/hooks';
import { formatDate } from '../../src/lib/format';
import { colors } from '../../src/theme';

const CATEGORIES: string[] = [
  'MAINTENANCE', 'PLUMBING', 'ELECTRICAL', 'HOUSEKEEPING',
  'SECURITY', 'FOOD', 'WIFI', 'NOISE', 'OTHER',
];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  OPEN:        { label: 'Open',        color: '#991b1b', bg: '#fee2e2' },
  ASSIGNED:    { label: 'Assigned',    color: '#92400e', bg: '#fef3c7' },
  IN_PROGRESS: { label: 'In Progress', color: '#1e40af', bg: '#dbeafe' },
  RESOLVED:    { label: 'Resolved',    color: '#065f46', bg: '#d1fae5' },
  REOPENED:    { label: 'Reopened',    color: '#4c1d95', bg: '#ede9fe' },
  CLOSED:      { label: 'Closed',      color: '#374151', bg: colors.gray100 },
  REJECTED:    { label: 'Rejected',    color: '#374151', bg: colors.gray100 },
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#9ca3af', MEDIUM: '#3b82f6', HIGH: '#f59e0b', URGENT: '#ef4444',
};

export default function ComplaintsScreen() {
  const { data, loading, error, refetch } = useAsync(getTenantComplaints, []);
  const complaints = data ?? [];

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('MAINTENANCE');
  const [priority, setPriority] = useState('MEDIUM');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('MAINTENANCE');
    setPriority('MEDIUM');
  };

  const submitComplaint = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Required', 'Please fill in title and description.');
      return;
    }
    setCreating(true);
    try {
      await createTenantComplaint({
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
      });
      resetForm();
      setShowCreate(false);
      refetch();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to submit complaint');
    } finally {
      setCreating(false);
    }
  };

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
        {complaints.length === 0 && !loading && (
          <View style={styles.emptyBox}>
            <Ionicons name="chatbubble-ellipses-outline" size={44} color="#d1d5db" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>No complaints yet</Text>
            <Text style={styles.emptyText}>Tap the + button below to raise a new complaint.</Text>
          </View>
        )}

        {complaints.map((c) => {
          const sCfg = STATUS_CONFIG[c.status] ?? { label: c.status, color: '#374151', bg: colors.gray100 };
          const expanded = expandedId === c.id;
          return (
            <TouchableOpacity
              key={c.id}
              style={[styles.card, c.priority === 'URGENT' && styles.urgentCard]}
              onPress={() => setExpandedId(expanded ? null : c.id)}
              activeOpacity={0.85}
            >
              <View style={styles.cardTop}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.cardTitle} numberOfLines={expanded ? undefined : 1}>
                    {c.title}
                  </Text>
                  <Text style={styles.cardMeta}>
                    {c.category.replace(/_/g, ' ')} · {formatDate(c.createdAt)}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: sCfg.bg }]}>
                  <Text style={[styles.badgeText, { color: sCfg.color }]}>{sCfg.label}</Text>
                </View>
              </View>

              <View style={styles.priorityRow}>
                <View
                  style={[styles.dot, { backgroundColor: PRIORITY_COLORS[c.priority] ?? '#9ca3af' }]}
                />
                <Text style={styles.priorityText}>
                  {c.priority.charAt(0) + c.priority.slice(1).toLowerCase()} priority
                </Text>
              </View>

              {expanded && (
                <>
                  <View style={styles.divider} />
                  <Text style={styles.description}>{c.description}</Text>
                  {c.updates.length > 0 && (
                    <View style={styles.updatesBox}>
                      <Text style={styles.updatesLabel}>Updates</Text>
                      {c.updates.map((u) => (
                        <View key={u.id} style={styles.updateItem}>
                          {u.statusChange && (
                            <Text style={styles.updateStatus}>{u.statusChange}</Text>
                          )}
                          <Text style={styles.updateComment}>{u.comment}</Text>
                          <Text style={styles.updateDate}>{formatDate(u.createdAt)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
            </TouchableOpacity>
          );
        })}

        {/* Bottom padding for FAB */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowCreate(true)}
        activeOpacity={0.85}
        accessibilityLabel="Raise new complaint"
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Create Complaint Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setShowCreate(false); resetForm(); }}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Complaint</Text>
            <TouchableOpacity
              onPress={submitComplaint}
              disabled={creating}
              style={[styles.modalSubmitBtn, creating && { opacity: 0.5 }]}
            >
              {creating
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.modalSubmitText}>Submit</Text>
              }
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Title <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Brief description of the issue"
              placeholderTextColor="#9ca3af"
              returnKeyType="next"
            />

            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>
              Description <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={description}
              onChangeText={setDescription}
              placeholder="What happened? Where? When?"
              placeholderTextColor="#9ca3af"
              multiline
              textAlignVertical="top"
            />

            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setCategory(cat)}
                  style={[styles.chip, category === cat && styles.chipActive]}
                >
                  <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
                    {cat.replace(/_/g, ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Priority</Text>
            <View style={styles.priorityRow}>
              {PRIORITIES.map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setPriority(p)}
                  style={[
                    styles.chip,
                    priority === p && styles.chipActive,
                    priority === p && p === 'URGENT' && { backgroundColor: '#ef4444', borderColor: '#ef4444' },
                  ]}
                >
                  <Text style={[styles.chipText, priority === p && styles.chipTextActive]}>
                    {p.charAt(0) + p.slice(1).toLowerCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>
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

  list: { padding: 16, gap: 10 },

  emptyBox: { paddingVertical: 60, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginBottom: 4 },
  emptyText: { fontSize: 13, color: '#9ca3af', textAlign: 'center', paddingHorizontal: 24 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  urgentCard: { borderLeftWidth: 3, borderLeftColor: '#ef4444' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#111827', lineHeight: 20 },
  cardMeta: { fontSize: 11, color: '#9ca3af', marginTop: 3 },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 0 },
  badgeText: { fontSize: 10, fontWeight: '700' },

  priorityRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  priorityText: { fontSize: 11, color: '#6b7280' },

  divider: { height: 1, backgroundColor: colors.gray100, marginVertical: 12 },
  description: { fontSize: 13, color: '#4b5563', lineHeight: 20 },
  updatesBox: { marginTop: 12, backgroundColor: '#f9fafb', borderRadius: 10, padding: 12 },
  updatesLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  updateItem: { marginBottom: 10 },
  updateStatus: { fontSize: 11, fontWeight: '700', color: colors.primary, marginBottom: 2 },
  updateComment: { fontSize: 13, color: '#374151', lineHeight: 18 },
  updateDate: { fontSize: 11, color: '#9ca3af', marginTop: 2 },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },

  // Modal
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  modalCancel: { fontSize: 15, color: '#6b7280', fontWeight: '500' },
  modalSubmitBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  modalSubmitText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  modalBody: { padding: 20, paddingBottom: 48 },

  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  required: { color: '#ef4444' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  textarea: { minHeight: 110, paddingTop: 12 },

  chipScroll: { marginBottom: 4 },
  chip: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, color: '#374151', fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
});
