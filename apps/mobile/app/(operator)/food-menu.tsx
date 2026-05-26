import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useOperatorProperty } from '../../src/hooks/useOperatorProperty';
import {
  getFoodMenu,
  upsertFoodMenu,
  updateFoodMenuEntry,
  type FoodMenuEntry,
} from '../../src/lib/operator-api';
import { useAsync } from '../../src/lib/hooks';
import { colors, shadow, radius } from '../../src/theme';

// ── Constants ─────────────────────────────────────────────────────────────────

const DAYS = [
  { dayOfWeek: 1, label: 'Mon' },
  { dayOfWeek: 2, label: 'Tue' },
  { dayOfWeek: 3, label: 'Wed' },
  { dayOfWeek: 4, label: 'Thu' },
  { dayOfWeek: 5, label: 'Fri' },
  { dayOfWeek: 6, label: 'Sat' },
  { dayOfWeek: 0, label: 'Sun' },
] as const;

const MEALS = [
  { key: 'BREAKFAST'    , label: 'Breakfast'    , icon: 'sunny-outline'      , color: '#d97706', bg: '#fef3c7' },
  { key: 'LUNCH'        , label: 'Lunch'         , icon: 'restaurant-outline' , color: '#059669', bg: '#d1fae5' },
  { key: 'EVENING_SNACK', label: 'Evening Snack' , icon: 'cafe-outline'       , color: '#7c3aed', bg: '#ede9fe' },
  { key: 'DINNER'       , label: 'Dinner'        , icon: 'moon-outline'       , color: '#2563eb', bg: '#dbeafe' },
] as const;

type MealKey = typeof MEALS[number]['key'];
type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

// ── Edit modal ────────────────────────────────────────────────────────────────

function EditMealModal({
  entry,
  dayLabel,
  mealLabel,
  mealColor,
  onSave,
  onClose,
}: {
  entry: FoodMenuEntry | null;
  dayLabel: string;
  mealLabel: string;
  mealColor: string;
  onSave: (items: string[], timing: string) => Promise<void>;
  onClose: () => void;
}) {
  const [items, setItems] = useState<string[]>(entry?.items ?? ['']);
  const [timing, setTiming] = useState(entry?.timing ?? '');
  const [saving, setSaving] = useState(false);

  const addItem = () => setItems((i) => [...i, '']);
  const removeItem = (idx: number) => setItems((i) => i.filter((_, j) => j !== idx));
  const updateItem = (idx: number, val: string) =>
    setItems((i) => i.map((v, j) => (j === idx ? val : v)));

  const handleSave = async () => {
    const cleaned = items.map((s) => s.trim()).filter(Boolean);
    if (cleaned.length === 0) {
      Alert.alert('Add at least one item');
      return;
    }
    setSaving(true);
    try {
      await onSave(cleaned, timing.trim());
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to save menu. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={modal.overlay}>
      <View style={modal.sheet}>
        {/* Header */}
        <View style={modal.header}>
          <View>
            <Text style={[modal.mealLabel, { color: mealColor }]}>{mealLabel}</Text>
            <Text style={modal.dayLabel}>{dayLabel}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={modal.closeBtn}>
            <Ionicons name="close" size={22} color={colors.gray500} />
          </TouchableOpacity>
        </View>

        <ScrollView style={modal.body} keyboardShouldPersistTaps="handled">
          {/* Timing */}
          <Text style={modal.fieldLabel}>Timing (optional)</Text>
          <TextInput
            style={modal.input}
            value={timing}
            onChangeText={setTiming}
            placeholder="e.g. 8:00 AM – 9:30 AM"
            placeholderTextColor={colors.gray400}
          />

          {/* Items */}
          <Text style={[modal.fieldLabel, { marginTop: 16 }]}>Menu Items</Text>
          {items.map((item, idx) => (
            <View key={idx} style={modal.itemRow}>
              <TextInput
                style={[modal.input, { flex: 1, marginBottom: 0 }]}
                value={item}
                onChangeText={(v) => updateItem(idx, v)}
                placeholder={`Item ${idx + 1}`}
                placeholderTextColor={colors.gray400}
              />
              {items.length > 1 && (
                <TouchableOpacity onPress={() => removeItem(idx)} style={modal.removeBtn}>
                  <Ionicons name="close-circle" size={20} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity onPress={addItem} style={modal.addItemBtn}>
            <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
            <Text style={modal.addItemText}>Add item</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Footer */}
        <View style={modal.footer}>
          <TouchableOpacity onPress={onClose} style={modal.cancelBtn}>
            <Text style={modal.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={[modal.saveBtn, saving && { opacity: 0.6 }]}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={modal.saveText}>Save</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function OperatorFoodMenuScreen() {
  const { properties, propertyId } = useOperatorProperty();
  const propertyName = properties.find((p) => p.id === propertyId)?.name ?? '';
  const today = new Date().getDay();
  const [selectedDay, setSelectedDay] = useState(today);
  const [editing, setEditing] = useState<{
    entry: FoodMenuEntry | null;
    mealKey: MealKey;
    dayLabel: string;
    mealLabel: string;
    mealColor: string;
  } | null>(null);

  const fetchMenu = useCallback(
    () => (propertyId ? getFoodMenu(propertyId) : Promise.resolve([])),
    [propertyId],
  );

  const { data: allEntries = [], loading, refetch } = useAsync<FoodMenuEntry[]>(fetchMenu, [propertyId]);

  const dayEntries = allEntries.filter((e) => e.dayOfWeek === selectedDay);
  const getEntry = (mealKey: string) => dayEntries.find((e) => e.mealType === mealKey) ?? null;

  const openEdit = (mealKey: MealKey, mealLabel: string, mealColor: string) => {
    const dayObj = DAYS.find((d) => d.dayOfWeek === selectedDay);
    setEditing({
      entry: getEntry(mealKey),
      mealKey,
      dayLabel: dayObj?.label ?? '',
      mealLabel,
      mealColor,
    });
  };

  const handleSave = async (items: string[], timing: string) => {
    if (!propertyId || !editing) return;
    const existingEntry = editing.entry;
    if (existingEntry) {
      await updateFoodMenuEntry(existingEntry.id, { items, timing });
    } else {
      await upsertFoodMenu({
        propertyId,
        dayOfWeek: selectedDay,
        mealType: editing.mealKey,
        items,
        timing,
      });
    }
    await refetch();
  };

  const toggleActive = async (entry: FoodMenuEntry) => {
    await updateFoodMenuEntry(entry.id, { isActive: !entry.isActive });
    await refetch();
  };

  if (!propertyId) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.gray300} />
        <Text style={styles.emptyText}>No property selected</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Property header */}
      <View style={styles.propertyHeader}>
        <Ionicons name="business-outline" size={14} color={colors.gray400} />
        <Text style={styles.propertyName} numberOfLines={1}>{propertyName}</Text>
      </View>

      {/* Day selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dayRow}
      >
        {DAYS.map(({ dayOfWeek, label }) => {
          const isToday = dayOfWeek === today;
          const isSelected = dayOfWeek === selectedDay;
          return (
            <TouchableOpacity
              key={dayOfWeek}
              onPress={() => setSelectedDay(dayOfWeek)}
              style={[
                styles.dayBtn,
                isSelected && styles.dayBtnActive,
                isToday && !isSelected && styles.dayBtnToday,
              ]}
              activeOpacity={0.75}
            >
              <Text style={[styles.dayLabel, isSelected && styles.dayLabelActive]}>
                {label}
              </Text>
              {isToday && (
                <View style={[styles.todayDot, isSelected && { backgroundColor: '#fff' }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Meal cards */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading && allEntries.length > 0} onRefresh={refetch} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {loading && allEntries.length === 0 ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          MEALS.map((meal) => {
            const entry = getEntry(meal.key);
            return (
              <View key={meal.key} style={styles.mealCard}>
                {/* Card header */}
                <View style={styles.mealHeader}>
                  <View style={[styles.mealIconWrap, { backgroundColor: meal.bg }]}>
                    <Ionicons name={meal.icon as IoniconsName} size={18} color={meal.color} />
                  </View>
                  <Text style={[styles.mealTitle, { color: meal.color }]}>{meal.label}</Text>
                  {entry && (
                    <Switch
                      value={entry.isActive}
                      onValueChange={() => toggleActive(entry)}
                      trackColor={{ false: colors.gray200, true: `${meal.color}40` }}
                      thumbColor={entry.isActive ? meal.color : colors.gray400}
                      style={{ marginLeft: 'auto' }}
                    />
                  )}
                  <TouchableOpacity
                    onPress={() => openEdit(meal.key, meal.label, meal.color)}
                    style={[styles.editBtn, { borderColor: meal.color + '40' }]}
                    activeOpacity={0.75}
                  >
                    <Ionicons name={entry ? 'pencil' : 'add'} size={14} color={meal.color} />
                    <Text style={[styles.editBtnText, { color: meal.color }]}>
                      {entry ? 'Edit' : 'Add'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Content */}
                {entry && entry.isActive ? (
                  <View style={styles.mealBody}>
                    {entry.timing && (
                      <View style={styles.timingRow}>
                        <Ionicons name="time-outline" size={13} color={colors.gray400} />
                        <Text style={styles.timingText}>{entry.timing}</Text>
                      </View>
                    )}
                    <View style={styles.itemsList}>
                      {entry.items.map((item, i) => (
                        <View key={i} style={styles.itemRow}>
                          <View style={[styles.itemDot, { backgroundColor: meal.color }]} />
                          <Text style={styles.itemText}>{item}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : entry && !entry.isActive ? (
                  <Text style={styles.inactiveText}>Disabled for this day</Text>
                ) : (
                  <Text style={styles.emptyMealText}>No menu set — tap Add to configure</Text>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Edit modal */}
      {editing && (
        <EditMealModal
          entry={editing.entry}
          dayLabel={editing.dayLabel}
          mealLabel={editing.mealLabel}
          mealColor={editing.mealColor}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { color: colors.gray400, fontSize: 14 },

  propertyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  propertyName: { fontSize: 12, color: colors.gray400, fontWeight: '500', flex: 1 },

  // Day selector
  dayRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  dayBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.gray200,
    alignItems: 'center',
    minWidth: 48,
  },
  dayBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayBtnToday: { borderColor: colors.primary },
  dayLabel: { fontSize: 13, fontWeight: '600', color: colors.gray600 },
  dayLabelActive: { color: '#fff' },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary, marginTop: 2 },

  // Meal cards
  scroll: { flex: 1 },
  scrollContent: { padding: 12, gap: 12, paddingBottom: 32 },
  mealCard: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    padding: 16,
    ...shadow.card,
  },
  mealHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  mealIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealTitle: { fontSize: 14, fontWeight: '700' },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    marginLeft: 8,
  },
  editBtnText: { fontSize: 12, fontWeight: '600' },

  mealBody: { gap: 6 },
  timingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timingText: { fontSize: 12, color: colors.gray400 },
  itemsList: { gap: 4, marginTop: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemDot: { width: 5, height: 5, borderRadius: 3 },
  itemText: { fontSize: 14, color: colors.gray700 },
  inactiveText: { fontSize: 13, color: colors.gray400, fontStyle: 'italic' },
  emptyMealText: { fontSize: 13, color: colors.gray400 },
});

const modal = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  mealLabel: { fontSize: 16, fontWeight: '700' },
  dayLabel: { fontSize: 13, color: colors.gray500, marginTop: 2 },
  closeBtn: { padding: 4 },
  body: { paddingHorizontal: 20, paddingVertical: 16, maxHeight: 420 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.gray500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.gray900,
    backgroundColor: colors.gray50,
    marginBottom: 8,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  removeBtn: { padding: 4 },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    marginTop: 4,
  },
  addItemText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gray200,
    alignItems: 'center',
  },
  cancelText: { fontSize: 14, fontWeight: '600', color: colors.gray600 },
  saveBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  saveText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
