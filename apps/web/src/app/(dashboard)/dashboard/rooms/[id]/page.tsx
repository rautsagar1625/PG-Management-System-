'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BedDouble,
  Building2,
  Edit2,
  Check,
  X,
  History,
  AlertTriangle,
} from 'lucide-react';
import {
  getRoom,
  getRoomAllocations,
  updateRoom,
  updateBed,
  ROOM_TYPE_LABELS,
  type RoomType,
  type RoomStatus,
  type BedStatus,
} from '@/lib/rooms-api';
import { getProperties } from '@/lib/properties-api';
import { BedGrid, type BedInfo } from '@/components/ui/BedGrid';
import { PageHeader } from '@/components/ui/PageHeader';
import { RoomStatusBadge } from '@/components/ui/StatusBadge';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency, formatDate } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'beds' | 'history';

const ROOM_STATUS_OPTIONS: { value: RoomStatus; label: string }[] = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'PARTIALLY_OCCUPIED', label: 'Partially Occupied' },
  { value: 'FULLY_OCCUPIED', label: 'Fully Occupied' },
  { value: 'UNDER_MAINTENANCE', label: 'Under Maintenance' },
  { value: 'INACTIVE', label: 'Inactive' },
];

const ROOM_TYPE_OPTIONS: { value: RoomType; label: string }[] = [
  { value: 'PRIVATE', label: 'Private' },
  { value: 'DOUBLE_SHARING', label: '2-Sharing' },
  { value: 'TRIPLE_SHARING', label: '3-Sharing' },
  { value: 'FOUR_SHARING', label: '4-Sharing' },
  { value: 'SIX_SHARING', label: '6-Sharing' },
];

const BED_STATUS_OPTIONS: { value: BedStatus; label: string; color: string }[] = [
  { value: 'AVAILABLE', label: 'Available', color: 'text-green-600' },
  { value: 'OCCUPIED', label: 'Occupied', color: 'text-red-600' },
  { value: 'RESERVED', label: 'Reserved', color: 'text-yellow-600' },
  { value: 'UNDER_MAINTENANCE', label: 'Maintenance', color: 'text-gray-500' },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function RoomDetailPage() {
  const params = useParams<{ id: string }>();
  const roomId = params.id;
  const router = useRouter();
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>('beds');
  const [isEditing, setIsEditing] = useState(false);
  const [editBedId, setEditBedId] = useState<string | null>(null);

  // Fetch properties to find which property this room belongs to
  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: getProperties,
  });

  // We need propertyId — fetch room from each property until found
  // The room detail API is scoped to /properties/:propertyId/rooms/:id
  // We'll use a search approach: try each property
  const [propertyId, setPropertyId] = useState<string>('');

  const { data: room, isLoading } = useQuery({
    queryKey: ['room', roomId],
    queryFn: async () => {
      // Try each accessible property to find this room
      for (const prop of properties) {
        try {
          const r = await getRoom(prop.id, roomId);
          setPropertyId(prop.id);
          return r;
        } catch {
          // not in this property, try next
        }
      }
      throw new Error('Room not found');
    },
    enabled: properties.length > 0,
  });

  const { data: allocationHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ['room-allocations', roomId, propertyId],
    queryFn: () => getRoomAllocations(propertyId, roomId),
    enabled: !!propertyId && tab === 'history',
  });

  const updateRoomMutation = useMutation({
    mutationFn: (dto: Parameters<typeof updateRoom>[2]) => updateRoom(propertyId, roomId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['room', roomId] });
      qc.invalidateQueries({ queryKey: ['rooms', propertyId] });
      setIsEditing(false);
    },
  });

  const updateBedMutation = useMutation({
    mutationFn: ({ bedId, dto }: { bedId: string; dto: Parameters<typeof updateBed>[1] }) =>
      updateBed(bedId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['room', roomId] });
      setEditBedId(null);
    },
  });

  if (isLoading || !room) return <PageLoader />;

  const beds: BedInfo[] = room.beds.map((b) => ({
    id: b.id,
    label: b.label,
    status: b.status,
    tenantName: b.currentAllocation?.tenant?.user?.name,
    monthlyRent: b.currentAllocation?.monthlyRent
      ? Number(b.currentAllocation.monthlyRent)
      : Number(room.baseRent),
  }));

  const occupiedCount = beds.filter((b) => b.status === 'OCCUPIED').length;
  const availableCount = beds.filter((b) => b.status === 'AVAILABLE').length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Back nav */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Rooms
      </button>

      {/* Room header card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        {isEditing ? (
          <EditRoomForm
            room={room}
            onSave={(dto) => updateRoomMutation.mutate(dto)}
            onCancel={() => setIsEditing(false)}
            isSaving={updateRoomMutation.isPending}
          />
        ) : (
          <RoomHeader
            room={room}
            occupiedCount={occupiedCount}
            availableCount={availableCount}
            onEdit={() => setIsEditing(true)}
          />
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 px-6">
          <nav className="flex gap-6">
            {([['beds', 'Beds & Occupancy'], ['history', 'Allocation History']] as const).map(
              ([value, label]) => (
                <button
                  key={value}
                  onClick={() => setTab(value)}
                  className={`py-4 text-sm font-medium border-b-2 transition-colors ${
                    tab === value
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {label}
                </button>
              ),
            )}
          </nav>
        </div>

        <div className="p-6">
          {tab === 'beds' && (
            <BedsTab
              room={room}
              beds={beds}
              editBedId={editBedId}
              onEditBed={setEditBedId}
              onUpdateBed={(bedId, dto) => updateBedMutation.mutate({ bedId, dto })}
              isUpdating={updateBedMutation.isPending}
              onViewTenant={(tenantId) => router.push(`/dashboard/tenants/${tenantId}`)}
            />
          )}
          {tab === 'history' && (
            <AllocationHistoryTab
              allocations={allocationHistory}
              isLoading={historyLoading}
              onViewTenant={(tenantId) => router.push(`/dashboard/tenants/${tenantId}`)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Room Header ───────────────────────────────────────────────────────────────

function RoomHeader({
  room,
  occupiedCount,
  availableCount,
  onEdit,
}: {
  room: ReturnType<typeof Object.assign> & {
    number: string;
    floor: number | null;
    type: string;
    baseRent: number | string;
    status: RoomStatus;
    amenities: string[];
    sharingCapacity: number;
  };
  occupiedCount: number;
  availableCount: number;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
          <BedDouble className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-gray-900">Room {room.number}</h1>
            <RoomStatusBadge status={room.status} />
          </div>
          <p className="text-sm text-gray-500 mb-3">
            {ROOM_TYPE_LABELS[room.type as RoomType]} ·{' '}
            {room.floor !== null ? `Floor ${room.floor}` : 'Floor not set'} ·{' '}
            {formatCurrency(room.baseRent)}/bed
          </p>
          {/* Occupancy summary */}
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-gray-600">{occupiedCount} occupied</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-gray-600">{availableCount} available</span>
            </span>
            <span className="text-gray-400">of {room.sharingCapacity} beds</span>
          </div>
          {room.amenities?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {(room.amenities as string[]).map((a) => (
                <span
                  key={a}
                  className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
                >
                  {a}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <button
        onClick={onEdit}
        className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-600 border border-gray-200 hover:border-blue-300 rounded-lg px-3 py-1.5 transition-colors"
      >
        <Edit2 className="w-3.5 h-3.5" />
        Edit
      </button>
    </div>
  );
}

// ── Edit Room Form (inline) ───────────────────────────────────────────────────

function EditRoomForm({
  room,
  onSave,
  onCancel,
  isSaving,
}: {
  room: {
    number: string;
    floor: number | null;
    type: string;
    baseRent: number | string;
    status: RoomStatus;
    amenities: string[];
  };
  onSave: (dto: { number?: string; floor?: number; type?: RoomType; baseRent?: number; status?: RoomStatus; amenities?: string[] }) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState({
    number: room.number,
    floor: room.floor ?? '',
    type: room.type as RoomType,
    baseRent: Number(room.baseRent),
    status: room.status,
    amenitiesStr: (room.amenities || []).join(', '),
  });

  function handleSave() {
    onSave({
      number: form.number,
      floor: form.floor !== '' ? Number(form.floor) : undefined,
      type: form.type,
      baseRent: form.baseRent,
      status: form.status,
      amenities: form.amenitiesStr
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean),
    });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-gray-900">Edit Room Details</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Room Number</label>
          <input
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.number}
            onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Floor</label>
          <input
            type="number"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.floor}
            onChange={(e) => setForm((f) => ({ ...f, floor: e.target.value }))}
            placeholder="e.g. 1"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Room Type</label>
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as RoomType }))}
          >
            {ROOM_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Base Rent / Bed (₹)</label>
          <input
            type="number"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.baseRent}
            onChange={(e) => setForm((f) => ({ ...f, baseRent: Number(e.target.value) }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as RoomStatus }))}
          >
            {ROOM_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Amenities (comma-separated)
          </label>
          <input
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.amenitiesStr}
            onChange={(e) => setForm((f) => ({ ...f, amenitiesStr: e.target.value }))}
            placeholder="e.g. AC, Geyser, Wardrobe"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isSaving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// ── Beds Tab ──────────────────────────────────────────────────────────────────

function BedsTab({
  room,
  beds,
  editBedId,
  onEditBed,
  onUpdateBed,
  isUpdating,
  onViewTenant,
}: {
  room: { beds: Array<{ id: string; label: string; status: BedStatus; allocations?: Array<{ tenant?: { id: string; tenantCode?: string; user: { name: string } } }> }> };
  beds: BedInfo[];
  editBedId: string | null;
  onEditBed: (id: string | null) => void;
  onUpdateBed: (bedId: string, dto: { label?: string; status?: BedStatus }) => void;
  isUpdating: boolean;
  onViewTenant: (tenantId: string) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Visual bed grid */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Occupancy Overview</h3>
        <BedGrid beds={beds} />
      </div>

      {/* Detailed bed list */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Bed Details</h3>
        <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
          {room.beds.map((bed) => {
            const activeTenant = bed.allocations?.[0]?.tenant;
            if (editBedId === bed.id) {
              return (
                <EditBedRow
                  key={bed.id}
                  bed={bed}
                  onSave={(dto) => onUpdateBed(bed.id, dto)}
                  onCancel={() => onEditBed(null)}
                  isSaving={isUpdating}
                />
              );
            }
            return (
              <div key={bed.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                    {bed.label}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Bed {bed.label}</p>
                    {activeTenant ? (
                      <button
                        onClick={() => onViewTenant(activeTenant.id)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {activeTenant.user.name}
                      </button>
                    ) : (
                      <p className="text-xs text-gray-400">Vacant</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <BedStatusChip status={bed.status} />
                  <button
                    onClick={() => onEditBed(bed.id)}
                    className="text-xs text-gray-400 hover:text-blue-600 transition-colors p-1"
                    title="Edit bed"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BedStatusChip({ status }: { status: BedStatus }) {
  const styles: Record<BedStatus, string> = {
    AVAILABLE: 'bg-green-50 text-green-700',
    OCCUPIED: 'bg-red-50 text-red-700',
    RESERVED: 'bg-yellow-50 text-yellow-700',
    UNDER_MAINTENANCE: 'bg-gray-100 text-gray-500',
  };
  const labels: Record<BedStatus, string> = {
    AVAILABLE: 'Vacant',
    OCCUPIED: 'Occupied',
    RESERVED: 'Reserved',
    UNDER_MAINTENANCE: 'Maintenance',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function EditBedRow({
  bed,
  onSave,
  onCancel,
  isSaving,
}: {
  bed: { id: string; label: string; status: BedStatus };
  onSave: (dto: { label?: string; status?: BedStatus }) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [label, setLabel] = useState(bed.label);
  const [status, setStatus] = useState<BedStatus>(bed.status);

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-blue-50">
      <input
        className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Label"
      />
      <select
        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={status}
        onChange={(e) => setStatus(e.target.value as BedStatus)}
      >
        {BED_STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <div className="flex items-center gap-1.5 ml-auto">
        <button
          onClick={() => onSave({ label, status })}
          disabled={isSaving}
          className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={onCancel}
          className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Allocation History Tab ────────────────────────────────────────────────────

function AllocationHistoryTab({
  allocations,
  isLoading,
  onViewTenant,
}: {
  allocations: Array<{
    id: string;
    startDate: string;
    endDate: string | null;
    isActive: boolean;
    monthlyRent: number;
    bed: { label: string };
    tenant: { id: string; tenantCode: string; user: { name: string; phone: string } };
  }>;
  isLoading: boolean;
  onViewTenant: (id: string) => void;
}) {
  if (isLoading) return <PageLoader />;

  if (allocations.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No allocation history"
        description="No tenants have been allocated to this room yet."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b border-gray-100">
            <th className="pb-3 font-medium text-gray-500">Tenant</th>
            <th className="pb-3 font-medium text-gray-500">Bed</th>
            <th className="pb-3 font-medium text-gray-500">Move-In</th>
            <th className="pb-3 font-medium text-gray-500">Move-Out</th>
            <th className="pb-3 font-medium text-gray-500 text-right">Monthly Rent</th>
            <th className="pb-3 font-medium text-gray-500">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {allocations.map((a) => (
            <tr key={a.id} className="hover:bg-gray-50 transition-colors">
              <td className="py-3">
                <button
                  onClick={() => onViewTenant(a.tenant.id)}
                  className="text-blue-600 hover:underline font-medium"
                >
                  {a.tenant.user.name}
                </button>
                <p className="text-xs text-gray-400">{a.tenant.tenantCode}</p>
              </td>
              <td className="py-3">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-gray-100 text-xs font-bold text-gray-600">
                  {a.bed.label}
                </span>
              </td>
              <td className="py-3 text-gray-600">{formatDate(a.startDate)}</td>
              <td className="py-3 text-gray-600">
                {a.endDate ? formatDate(a.endDate) : <span className="text-gray-300">—</span>}
              </td>
              <td className="py-3 text-right text-gray-700 font-medium">
                {formatCurrency(a.monthlyRent)}
              </td>
              <td className="py-3">
                {a.isActive ? (
                  <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    Active
                  </span>
                ) : (
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                    Past
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
