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
import { getTenantComplaints, createTenantComplaint } from '../../src/lib/tenant-api';
import { useAsync } from '../../src/lib/hooks';
import { formatDate } from '../../src/lib/format';

const CATEGORIES = ['MAINTENANCE','PLUMBING','ELECTRICAL','HOUSEKEEPING','SECURITY','FOOD','WIFI','NOISE','OTHER'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  OPEN:        { label: 'Open',        color: '#991b1b', bg: '#fee2e2' },
  ASSIGNED:    { label: 'Assigned',    color: '#92400e', bg: '#fef3c7' },
  IN_PROGRESS: { label: 'In Progress', color: '#1e40af', bg: '#dbeafe' },
  RESOLVED:    { label: 'Resolved',    color: '#065f46', bg: '#d1fae5' },
  CLOSED:      { label: 'Closed',      color: '#374151', bg: '#f3f4f6' },
  REJECTED:    { label: 'Rejected',    color: '#374151', bg: '#f3f4f6' },
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#6b7280', MEDIUM: '#3b82f6', HIGH: '#f59e0b', URGENT: '#ef4444',
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

  const submitComplaint = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Required', 'Title and description are required.');
      return;
    }
    setCreating(true);
    try {
      await createTenantComplaint({ title: title.trim(), description: description.trim(), category, priority });
      setShowCreate(false);
      setTitle('');
      setDescription('');
      setCategory('MAINTENANCE');
      setPriority('MEDIUM');
      refetch();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to submit complaint');
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Complaints</Text>
          <Text style={styles.subtitle}>{complaints.length} raised</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
          <Text style={styles.addBtnText}>+ New</Text>
        </TouchableOpacity>
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

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={refetch} />}
      >
        {complaints.length === 0 && !loading && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No complaints raised yet.</Text>
          </View>
        )}
        {complaints.map((c) => {
          const sCfg = STATUS_CONFIG[c.status] ?? { label: c.status, color: '#374151', bg: '#f3f4f6' };
          const expanded = expandedId === c.id;
          return (
            <TouchableOpacity
              key={c.id}
              style={[styles.card, c.priority === 'URGENT' && styles.urgentCard]}
              onPress={() => setExpandedId(expanded ? null : c.id)}
              activeOpacity={0.8}
            >
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={expanded ? undefined : 1}>
                    {c.title}
                  </Text>
                  <Text style={styles.cardMeta}>
                    {c.category.replace('_', ' ')} · {formatDate(c.createdAt)}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: sCfg.bg }]}>
                  <Text style={[styles.badgeText, { color: sCfg.color }]}>{sCfg.label}</Text>
                </View>
              </View>

              {/* Priority dot */}
              <View style={styles.priorityRow}>
                <View style={[styles.dot, { backgroundColor: PRIORITY_COLORS[c.priority] ?? '#6b7280' }]} />
                <Text style={styles.priorityText}>{c.priority}</Text>
              </View>

              {expanded && (
                <>
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
      </ScrollView>

      {/* Create Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Complaint</Text>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Text style={styles.modalClose}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <Text style={styles.fieldLabel}>Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Brief description of the issue"
              placeholderTextColor="#9ca3af"
            />

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Description *</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={description}
              onChangeText={setDescription}
              placeholder="What happened? Where? When?"
              placeholderTextColor="#9ca3af"
              multiline
              textAlignVertical="top"
            />

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setCategory(cat)}
                  style={[styles.chip, category === cat && styles.chipActive]}
                >
                  <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
                    {cat.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Priority</Text>
            <View style={styles.priorityRow}>
              {PRIORITIES.map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setPriority(p)}
                  style={[styles.chip, priority === p && styles.chipActive]}
                >
                  <Text style={[styles.chipText, priority === p && styles.chipTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, creating && styles.submitBtnDisabled]}
              onPress={submitComplaint}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Submit Complaint</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: {
    backgroundColor: '#4f46e5',
    paddingTop: 56,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  title: { fontSize: 24, fontWeight: '700', color: '#fff' },
  subtitle: { fontSize: 13, color: '#c7d2fe', marginTop: 2 },
  addBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  center: { paddingVertical: 40, alignItems: 'center' },
  errorBox: { margin: 16, backgroundColor: '#fef2f2', borderRadius: 12, padding: 16, alignItems: 'center' },
  errorText: { color: '#dc2626', fontSize: 14, textAlign: 'center' },
  retryBtn: { marginTop: 10, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#dc2626', borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  list: { padding: 16, gap: 10 },
  emptyBox: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#9ca3af', fontSize: 14 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  urgentCard: { borderLeftWidth: 3, borderLeftColor: '#ef4444' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  cardMeta: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '600' },
  priorityRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  priorityText: { fontSize: 11, color: '#6b7280' },
  description: { fontSize: 13, color: '#4b5563', marginTop: 10, lineHeight: 18 },
  updatesBox: { marginTop: 10, backgroundColor: '#f9fafb', borderRadius: 10, padding: 10 },
  updatesLabel: { fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 },
  updateItem: { marginBottom: 8 },
  updateStatus: { fontSize: 11, fontWeight: '600', color: '#4f46e5', marginBottom: 2 },
  updateComment: { fontSize: 13, color: '#374151' },
  updateDate: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalClose: { fontSize: 15, color: '#4f46e5', fontWeight: '600' },
  modalBody: { padding: 20, paddingBottom: 40 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#111827', backgroundColor: '#f9fafb' },
  textarea: { minHeight: 100, paddingTop: 12 },
  chipScroll: { marginBottom: 4 },
  chip: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  chipText: { fontSize: 12, color: '#374151', fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  submitBtn: { marginTop: 24, backgroundColor: '#4f46e5', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
