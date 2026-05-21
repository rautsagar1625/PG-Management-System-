'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  ChevronDown,
  Loader2,
  Check,
  X,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { getProperties } from '@/lib/properties-api';
import {
  getFoodMenu,
  upsertFoodMenu,
  updateFoodMenu,
  type FoodMenuEntry,
} from '@/lib/food-menu-api';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';

// ── Constants ─────────────────────────────────────────────────────────

const DAYS: { dayOfWeek: number; label: string; short: string }[] = [
  { dayOfWeek: 1, label: 'Monday', short: 'Mon' },
  { dayOfWeek: 2, label: 'Tuesday', short: 'Tue' },
  { dayOfWeek: 3, label: 'Wednesday', short: 'Wed' },
  { dayOfWeek: 4, label: 'Thursday', short: 'Thu' },
  { dayOfWeek: 5, label: 'Friday', short: 'Fri' },
  { dayOfWeek: 6, label: 'Saturday', short: 'Sat' },
  { dayOfWeek: 0, label: 'Sunday', short: 'Sun' },
];

const MEAL_TYPES: {
  key: FoodMenuEntry['mealType'];
  label: string;
  color: string;
  headerColor: string;
}[] = [
  {
    key: 'BREAKFAST',
    label: 'Breakfast',
    color: 'bg-yellow-50 border-yellow-200',
    headerColor: 'bg-yellow-100 text-yellow-800',
  },
  {
    key: 'LUNCH',
    label: 'Lunch',
    color: 'bg-green-50 border-green-200',
    headerColor: 'bg-green-100 text-green-800',
  },
  {
    key: 'EVENING_SNACK',
    label: 'Snack',
    color: 'bg-orange-50 border-orange-200',
    headerColor: 'bg-orange-100 text-orange-800',
  },
  {
    key: 'DINNER',
    label: 'Dinner',
    color: 'bg-indigo-50 border-indigo-200',
    headerColor: 'bg-indigo-100 text-indigo-800',
  },
];

// ── Cell editor state ─────────────────────────────────────────────────

interface EditState {
  dayOfWeek: number;
  mealType: FoodMenuEntry['mealType'];
  itemsText: string;
  timing: string;
  existingId?: string;
}

// ── Main page ─────────────────────────────────────────────────────────

export default function FoodMenuPage() {
  const qc = useQueryClient();

  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [editing, setEditing] = useState<EditState | null>(null);
  const [editError, setEditError] = useState('');

  const todayDow = new Date().getDay(); // 0=Sun..6=Sat

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: getProperties,
  });

  useEffect(() => {
    if (properties.length > 0 && !selectedPropertyId) {
      setSelectedPropertyId(properties[0]!.id);
    }
  }, [properties, selectedPropertyId]);

  const activePropertyId = selectedPropertyId || properties[0]?.id || '';

  const { data: menuEntries = [], isLoading } = useQuery({
    queryKey: ['food-menu', activePropertyId],
    queryFn: () => getFoodMenu(activePropertyId),
    enabled: !!activePropertyId,
  });

  // Build lookup: `${dayOfWeek}_${mealType}` → entry
  const menuMap = new Map<string, FoodMenuEntry>(
    menuEntries.map((e) => [`${e.dayOfWeek}_${e.mealType}`, e]),
  );

  const upsertMutation = useMutation({
    mutationFn: (dto: Omit<FoodMenuEntry, 'id' | 'isActive'>) => upsertFoodMenu(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['food-menu'] });
      setEditing(null);
      setEditError('');
      toast.success('Menu saved');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setEditError(msg ?? 'Failed to save menu entry.');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateFoodMenu(id, { isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['food-menu'] });
      toast.success('Toggled');
    },
    onError: () => toast.error('Failed to toggle entry'),
  });

  const openCell = (dayOfWeek: number, mealType: FoodMenuEntry['mealType']) => {
    const existing = menuMap.get(`${dayOfWeek}_${mealType}`);
    setEditing({
      dayOfWeek,
      mealType,
      itemsText: existing?.items.join(', ') ?? '',
      timing: existing?.timing ?? '',
      existingId: existing?.id,
    });
    setEditError('');
  };

  const handleSave = () => {
    if (!editing) return;
    const items = editing.itemsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    upsertMutation.mutate({
      propertyId: activePropertyId,
      dayOfWeek: editing.dayOfWeek,
      mealType: editing.mealType,
      items,
      timing: editing.timing || undefined,
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Food Menu"
        subtitle="Weekly meal planner for your PG"
      />

      {/* Property filter */}
      {properties.length > 1 && (
        <div className="relative w-fit">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={activePropertyId}
            onChange={(e) => setSelectedPropertyId(e.target.value)}
            className="input-field pl-9 pr-8 text-sm bg-white appearance-none max-w-[220px]"
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      )}

      {/* Grid */}
      {properties.length === 0 && !isLoading ? (
        <div className="card">
          <EmptyState
            icon={Building2}
            title="No properties"
            description="Add a property first."
          />
        </div>
      ) : isLoading ? (
        <div className="card p-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">
                    Day
                  </th>
                  {MEAL_TYPES.map((mt) => (
                    <th
                      key={mt.key}
                      className="px-3 py-3 text-xs font-semibold uppercase tracking-wide min-w-[180px]"
                    >
                      <span className={cn('inline-block px-2.5 py-1 rounded-full', mt.headerColor)}>
                        {mt.label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {DAYS.map((day) => {
                  const isToday = day.dayOfWeek === todayDow;
                  return (
                    <tr
                      key={day.dayOfWeek}
                      className={cn(
                        'hover:bg-gray-50/50 transition-colors',
                        isToday && 'bg-indigo-50/40',
                      )}
                    >
                      {/* Day label */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={cn('font-semibold text-sm', isToday ? 'text-indigo-700' : 'text-gray-700')}>
                            {day.short}
                          </span>
                          {isToday && (
                            <span className="text-[9px] font-bold bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                              Today
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Meal cells */}
                      {MEAL_TYPES.map((mt) => {
                        const entry = menuMap.get(`${day.dayOfWeek}_${mt.key}`);
                        return (
                          <td key={mt.key} className="px-3 py-2">
                            {entry ? (
                              <MenuCell
                                entry={entry}
                                colorCls={mt.color}
                                onEdit={() => openCell(day.dayOfWeek, mt.key)}
                                onToggle={() =>
                                  toggleMutation.mutate({
                                    id: entry.id,
                                    isActive: !entry.isActive,
                                  })
                                }
                              />
                            ) : (
                              <button
                                onClick={() => openCell(day.dayOfWeek, mt.key)}
                                className="w-full min-h-[56px] rounded-lg border border-dashed border-gray-200 text-xs text-gray-400 hover:border-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
                              >
                                <span className="text-lg leading-none">+</span>
                                Add
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cell editor modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => { setEditing(null); setEditError(''); }}
            aria-hidden
          />
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  {MEAL_TYPES.find((m) => m.key === editing.mealType)?.label}
                  {' — '}
                  {DAYS.find((d) => d.dayOfWeek === editing.dayOfWeek)?.label}
                </h2>
              </div>
              <button
                onClick={() => { setEditing(null); setEditError(''); }}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Menu items <span className="text-gray-400 font-normal">(comma-separated)</span>
                </label>
                <textarea
                  rows={3}
                  value={editing.itemsText}
                  onChange={(e) => setEditing((s) => s && { ...s, itemsText: e.target.value })}
                  className="input-field resize-none w-full text-sm"
                  placeholder="Dal, Rice, Roti, Sabzi, Curd..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Timing</label>
                <input
                  type="text"
                  value={editing.timing}
                  onChange={(e) => setEditing((s) => s && { ...s, timing: e.target.value })}
                  className="input-field text-sm w-full"
                  placeholder="e.g. 8:00 AM – 9:00 AM"
                />
              </div>

              {editError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {editError}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setEditing(null); setEditError(''); }}
                  className="btn-secondary flex-1 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={upsertMutation.isPending || !editing.itemsText.trim()}
                  className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {upsertMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Menu cell display component ───────────────────────────────────────

function MenuCell({
  entry,
  colorCls,
  onEdit,
  onToggle,
}: {
  entry: FoodMenuEntry;
  colorCls: string;
  onEdit: () => void;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-2.5 min-h-[56px] transition-opacity',
        colorCls,
        !entry.isActive && 'opacity-50',
      )}
    >
      <div className="flex items-start justify-between gap-1 mb-1">
        <div className="flex-1">
          <p className="text-xs text-gray-700 leading-snug line-clamp-2">
            {entry.items.join(', ')}
          </p>
          {entry.timing && (
            <p className="text-[10px] text-gray-400 mt-1">{entry.timing}</p>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className="p-0.5 rounded text-gray-400 hover:text-gray-600 transition-colors"
            title={entry.isActive ? 'Deactivate' : 'Activate'}
          >
            {entry.isActive ? (
              <ToggleRight className="w-4 h-4 text-green-500" />
            ) : (
              <ToggleLeft className="w-4 h-4 text-gray-400" />
            )}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-0.5 rounded text-gray-400 hover:text-gray-600 transition-colors text-[10px] font-medium"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}
