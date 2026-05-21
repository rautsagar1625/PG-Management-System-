import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  Linking,
  RefreshControl,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useAuth } from '../../src/context/AuthContext';
import { useAsync } from '../../src/lib/hooks';
import { api } from '../../src/lib/api';
import { colors } from '../../src/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  source: string;
  status: string;
  budget?: number;
  moveInDate?: string;
  roomType?: string;
  notes?: string;
  assignedTo?: string;
  visitDate?: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; next?: string }> = {
  NEW:            { label: 'New',            color: colors.gray700,   bg: colors.gray100,         next: 'CONTACTED' },
  CONTACTED:      { label: 'Contacted',      color: colors.blueText,  bg: colors.blueBg,          next: 'VISIT_SCHEDULED' },
  VISIT_SCHEDULED:{ label: 'Visit Scheduled',color: '#312e81',        bg: '#e0e7ff',              next: 'VISITED' },
  VISITED:        { label: 'Visited',        color: colors.violet,    bg: colors.violetBg,        next: 'NEGOTIATING' },
  NEGOTIATING:    { label: 'Negotiating',    color: colors.yellowText,bg: colors.yellowBg,        next: 'TOKEN_PAID' },
  TOKEN_PAID:     { label: 'Token Paid',     color: '#92400e',        bg: '#ffedd5',              next: 'CONVERTED' },
  CONVERTED:      { label: 'Converted',      color: colors.greenText, bg: colors.greenBg,         next: undefined },
  LOST:           { label: 'Lost',           color: colors.redText,   bg: colors.redBg,           next: undefined },
};

const FILTERS = ['ALL', 'NEW', 'CONTACTED', 'VISIT_SCHEDULED', 'VISITED', 'NEGOTIATING', 'CONVERTED', 'LOST'];

const SOURCES = ['DIRECT', 'WEBSITE', 'REFERRAL', 'SOCIAL_MEDIA', 'BROKER', 'WALK_IN', 'OTHER'];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export default function LeadsScreen() {
  const { user } = useAuth();
  const { top } = useSafeAreaInsets();
  const [filter, setFilter] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', budget: '', source: 'DIRECT' });
  const [saving, setSaving] = useState(false);

  const propertyId = (user as unknown as { properties?: Array<{ id: string }> })?.properties?.[0]?.id ?? '';

  const { data: leads, loading, refetch } = useAsync(async () => {
    if (!propertyId) return [];
    const res = await api.get<{ success: boolean; data: Lead[] }>(
      `/leads?propertyId=${encodeURIComponent(propertyId)}`,
    );
    return res.data;
  }, [propertyId]);

  const filtered = (leads ?? []).filter(
    (l: Lead) => filter === 'ALL' || l.status === filter,
  );

  const handleMoveForward = async (lead: Lead) => {
    const cfg = STATUS_CONFIG[lead.status];
    if (!cfg?.next) return;
    try {
      await api.put(`/leads/${lead.id}/status`, { status: cfg.next });
      await refetch();
    } catch {
      Alert.alert('Error', 'Could not update lead status.');
    }
  };

  const handleAdd = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      Alert.alert('Required', 'Name and phone are required.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/leads', {
        propertyId,
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        budget: form.budget ? parseFloat(form.budget) : undefined,
        source: form.source,
      });
      setShowAddModal(false);
      setForm({ name: '', phone: '', email: '', budget: '', source: 'DIRECT' });
      await refetch();
    } catch {
      Alert.alert('Error', 'Could not add lead.');
    } finally {
      setSaving(false);
    }
  };

  const totalCount = (leads ?? []).length;

  return (
    <View style={styles.container}>
      {/* Hero */}
      <LinearGradient
        colors={['#1e1b4b', '#312e81', '#4f46e5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: top + 20 }]}
      >
        <View style={styles.heroRing} />
        <View style={styles.heroRow}>
          <View>
            <Text style={styles.heroTitle}>Leads</Text>
            <Text style={styles.heroSub}>{totalCount} prospect{totalCount !== 1 ? 's' : ''}</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowAddModal(true)}
            style={styles.addBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={20} color={colors.primary} />
            <Text style={styles.addBtnText}>Add Lead</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterContent}
        style={styles.filterScroll}
      >
        {FILTERS.map((f) => {
          const count = f === 'ALL' ? totalCount : (leads ?? []).filter((l: Lead) => l.status === f).length;
          return (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.filterTab, filter === f && styles.filterTabActive]}
              activeOpacity={0.75}
            >
              <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
                {f === 'ALL' ? 'All' : (STATUS_CONFIG[f]?.label ?? f)}
              </Text>
              {count > 0 && (
                <View style={[styles.filterBadge, filter === f && styles.filterBadgeActive]}>
                  <Text style={[styles.filterBadgeText, filter === f && styles.filterBadgeTextActive]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Lead list */}
      {loading && !leads ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="funnel-outline" size={40} color={colors.gray300} style={{ marginBottom: 10 }} />
          <Text style={styles.emptyText}>No leads here yet</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(l) => l.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={loading && !!leads} onRefresh={refetch} tintColor={colors.primary} />}
          renderItem={({ item: lead }) => {
            const cfg = STATUS_CONFIG[lead.status] ?? { label: lead.status, color: colors.gray700, bg: colors.gray100, next: undefined };
            return (
              <View style={styles.leadCard}>
                <View style={styles.leadTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.leadName}>{lead.name}</Text>
                    <Text style={styles.leadPhone}>{lead.phone}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
                    <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                </View>

                <View style={styles.leadMeta}>
                  {lead.budget ? (
                    <View style={styles.metaChip}>
                      <Ionicons name="cash-outline" size={11} color={colors.gray500} />
                      <Text style={styles.metaText}>₹{lead.budget.toLocaleString('en-IN')}</Text>
                    </View>
                  ) : null}
                  {lead.roomType ? (
                    <View style={styles.metaChip}>
                      <Ionicons name="bed-outline" size={11} color={colors.gray500} />
                      <Text style={styles.metaText}>{lead.roomType.replace('_', ' ')}</Text>
                    </View>
                  ) : null}
                  <View style={styles.metaChip}>
                    <Ionicons name="time-outline" size={11} color={colors.gray500} />
                    <Text style={styles.metaText}>{timeAgo(lead.createdAt)}</Text>
                  </View>
                </View>

                <View style={styles.leadActions}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => Linking.openURL(`tel:${lead.phone}`)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="call-outline" size={16} color={colors.green600} />
                    <Text style={[styles.actionText, { color: colors.green600 }]}>Call</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => Linking.openURL(`whatsapp://send?phone=91${lead.phone}&text=Hi ${lead.name}, I'm reaching out about your room enquiry.`)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                    <Text style={[styles.actionText, { color: '#25D366' }]}>WhatsApp</Text>
                  </TouchableOpacity>

                  {cfg.next && (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.moveBtn]}
                      onPress={() => handleMoveForward(lead)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="arrow-forward-outline" size={16} color={colors.primary} />
                      <Text style={[styles.actionText, { color: colors.primary }]}>Move Forward</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Add Lead Modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Lead</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={colors.gray700} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
              <ModalField
                label="Name *"
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="Prospect's name"
              />
              <ModalField
                label="Phone *"
                value={form.phone}
                onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
                placeholder="10-digit mobile"
                keyboardType="phone-pad"
              />
              <ModalField
                label="Email"
                value={form.email}
                onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
                placeholder="Optional"
                keyboardType="email-address"
              />
              <ModalField
                label="Budget (₹)"
                value={form.budget}
                onChangeText={(v) => setForm((f) => ({ ...f, budget: v }))}
                placeholder="Monthly budget"
                keyboardType="numeric"
              />

              <Text style={styles.modalLabel}>Source</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                {SOURCES.map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setForm((f) => ({ ...f, source: s }))}
                    style={[styles.sourcePill, form.source === s && styles.sourcePillActive]}
                  >
                    <Text style={[styles.sourcePillText, form.source === s && styles.sourcePillTextActive]}>
                      {s.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </ScrollView>

            <TouchableOpacity
              onPress={handleAdd}
              disabled={saving}
              activeOpacity={0.85}
              style={styles.saveBtn}
            >
              <LinearGradient colors={['#4f46e5', '#7c3aed']} style={styles.saveBtnGradient}>
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.saveBtnText}>Add Lead</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function ModalField({
  label, value, onChangeText, placeholder, keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad' | 'email-address' | 'numeric';
}) {
  return (
    <View style={styles.modalField}>
      <Text style={styles.modalLabel}>{label}</Text>
      <TextInput
        style={styles.modalInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.gray400}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  hero: { paddingHorizontal: 20, paddingBottom: 20, overflow: 'hidden' },
  heroRing: {
    position: 'absolute', right: -60, top: -60,
    width: 200, height: 200, borderRadius: 100,
    borderWidth: 40, borderColor: 'rgba(255,255,255,0.05)',
  },
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  heroTitle: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: colors.primary },

  filterScroll: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  filterContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  filterTab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: colors.gray100,
  },
  filterTabActive: { backgroundColor: colors.primary },
  filterTabText: { fontSize: 12, fontWeight: '600', color: colors.gray600 },
  filterTabTextActive: { color: '#fff' },
  filterBadge: { backgroundColor: colors.gray200, borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1 },
  filterBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  filterBadgeText: { fontSize: 10, fontWeight: '700', color: colors.gray600 },
  filterBadgeTextActive: { color: '#fff' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 14, color: colors.gray400, fontWeight: '500' },

  listContent: { padding: 16, gap: 10, paddingBottom: 40 },
  leadCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  leadTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  leadName: { fontSize: 15, fontWeight: '700', color: colors.gray900 },
  leadPhone: { fontSize: 12, color: colors.gray400, marginTop: 1 },
  statusPill: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4, flexShrink: 0 },
  statusText: { fontSize: 10, fontWeight: '700' },

  leadMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.gray100, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
  metaText: { fontSize: 10, color: colors.gray600, fontWeight: '500' },

  leadActions: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: colors.gray100, paddingTop: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: colors.gray50 },
  moveBtn: { marginLeft: 'auto' as unknown as number, backgroundColor: colors.primaryLight },
  actionText: { fontSize: 12, fontWeight: '600' },

  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.gray900 },
  modalBody: { padding: 20, gap: 4 },
  modalField: { marginBottom: 14 },
  modalLabel: { fontSize: 12, fontWeight: '700', color: colors.gray500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  modalInput: {
    backgroundColor: colors.gray50, borderRadius: 12, borderWidth: 1, borderColor: colors.gray200,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: colors.gray900,
  },
  sourcePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.gray100 },
  sourcePillActive: { backgroundColor: colors.primaryLight },
  sourcePillText: { fontSize: 12, fontWeight: '600', color: colors.gray600 },
  sourcePillTextActive: { color: colors.primary },

  saveBtn: { margin: 16 },
  saveBtnGradient: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
