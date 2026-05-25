'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Building2,
  BedDouble,
  Users,
  IndianRupee,
  AlertCircle,
  TrendingUp,
  Plus,
  Wrench,
  Loader2,
  UserPlus,
  Trash2,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getProperty,
  getOperatorDashboard,
  getPropertyRoles,
  addPropertyRole,
  removePropertyRole,
  lookupUserByEmail,
  type PropertyRole,
  type PropertyRoleType,
} from '@/lib/properties-api';
import { getPropertyPerformance } from '@/lib/dashboard-api';
import { getRooms, createRoom, type CreateRoomDto, ROOM_TYPE_LABELS } from '@/lib/rooms-api';
import { getTenants } from '@/lib/tenants-api';
import { PropertyStatusBadge, PropertyTypeBadge, RoomStatusBadge, TenantStatusBadge } from '@/components/ui/StatusBadge';
import { OccupancyBar } from '@/components/ui/OccupancyBar';
import { BedGrid, type BedInfo } from '@/components/ui/BedGrid';
import { Modal } from '@/components/ui/Modal';
import { FormField, Input, SelectField } from '@/components/ui/FormField';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { Table, type Column } from '@/components/ui/Table';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Tenant } from '@/lib/tenants-api';
import type { Room } from '@/lib/rooms-api';

type Tab = 'overview' | 'rooms' | 'tenants' | 'financials' | 'performance' | 'team';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'tenants', label: 'Tenants' },
  { id: 'financials', label: 'Financials' },
  { id: 'performance', label: 'Performance' },
  { id: 'team', label: 'Team' },
];

const ROOM_TYPES = [
  { value: 'PRIVATE', label: 'Private (1 bed)' },
  { value: 'DOUBLE_SHARING', label: 'Double Sharing (2 beds)' },
  { value: 'TRIPLE_SHARING', label: 'Triple Sharing (3 beds)' },
  { value: 'FOUR_SHARING', label: '4-Sharing' },
  { value: 'SIX_SHARING', label: '6-Sharing' },
];

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const { data: property, isLoading } = useQuery({
    queryKey: ['property', id],
    queryFn: () => getProperty(id),
  });

  const { data: dashData } = useQuery({
    queryKey: ['operator-dashboard'],
    queryFn: getOperatorDashboard,
  });

  const stats = dashData?.properties.find((p) => p.propertyId === id);

  if (isLoading) return <PageLoader />;
  if (!property) return null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => router.push('/dashboard/properties')}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors mt-0.5"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <h1 className="text-2xl font-bold text-gray-900">{property.name}</h1>
                <PropertyTypeBadge type={property.type} />
                <PropertyStatusBadge status={property.status} />
              </div>
              <p className="text-sm text-gray-500">
                {property.address}, {property.city}, {property.state} — {property.pincode}
              </p>
            </div>
            <button
              onClick={() => router.push(`/dashboard/tenants/new?propertyId=${id}`)}
              className="btn-primary text-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Tenant
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats Strip */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon={TrendingUp}
            label="Occupancy"
            value={`${stats.occupancyRate}%`}
            iconClass="bg-green-50 text-green-600"
            sub={`${stats.occupiedBeds}/${stats.totalBeds} beds`}
          />
          <StatCard
            icon={IndianRupee}
            label="Collected"
            value={formatCurrency(stats.totalCollectedRent)}
            iconClass="bg-blue-50 text-blue-600"
            sub="This month"
          />
          <StatCard
            icon={BedDouble}
            label="Available"
            value={`${stats.availableBeds} beds`}
            iconClass="bg-emerald-50 text-emerald-600"
          />
          <StatCard
            icon={AlertCircle}
            label="Complaints"
            value={stats.openComplaints}
            iconClass="bg-red-50 text-red-600"
            sub="Open"
          />
        </div>
      )}

      {/* Tabs */}
      <div className="card overflow-hidden">
        <div className="border-b border-gray-200 bg-white">
          <nav className="flex px-4" aria-label="Tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-5">
          {activeTab === 'overview' && <OverviewTab propertyId={id} stats={stats} />}
          {activeTab === 'rooms' && <RoomsTab propertyId={id} />}
          {activeTab === 'tenants' && (
            <TenantsTab propertyId={id} onViewTenant={(tid) => router.push(`/dashboard/tenants/${tid}`)} />
          )}
          {activeTab === 'financials' && <FinancialsTab propertyId={id} stats={stats} />}
          {activeTab === 'performance' && <PerformanceTab propertyId={id} />}
          {activeTab === 'team' && <TeamTab propertyId={id} />}
        </div>
      </div>
    </div>
  );
}

// ── Stat Card ────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  iconClass,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  iconClass: string;
}) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconClass}`}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 truncate">{label}</p>
        <p className="text-lg font-bold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

// ── Overview Tab ─────────────────────────────────────────────────────

function OverviewTab({
  propertyId,
  stats,
}: {
  propertyId: string;
  stats?: {
    totalBeds: number;
    occupiedBeds: number;
    availableBeds: number;
    occupancyRate: number;
    totalCollectedRent: number;
    pendingRent: number;
    rentCollectionRate: number;
    totalExpectedRent: number;
    openComplaints: number;
  };
}) {
  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms', propertyId],
    queryFn: () => getRooms(propertyId),
  });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-gray-50 rounded-xl">
          <p className="text-xs text-gray-500 mb-1">Total Rooms</p>
          <p className="text-2xl font-bold text-gray-900">{rooms.length}</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-xl">
          <p className="text-xs text-gray-500 mb-1">Total Beds</p>
          <p className="text-2xl font-bold text-gray-900">{stats?.totalBeds ?? '—'}</p>
        </div>
        <div className="p-4 bg-green-50 rounded-xl">
          <p className="text-xs text-gray-500 mb-1">Available Beds</p>
          <p className="text-2xl font-bold text-green-700">{stats?.availableBeds ?? '—'}</p>
        </div>
      </div>

      {stats && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">Occupancy</span>
            <span className="font-bold text-gray-900">{stats.occupancyRate}%</span>
          </div>
          <OccupancyBar occupied={stats.occupiedBeds} total={stats.totalBeds} showLabel={false} />

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-gray-500">Monthly Expected</p>
              <p className="text-base font-bold text-gray-900">
                {formatCurrency(stats.totalExpectedRent)}
              </p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-gray-500">Collected</p>
              <p className="text-base font-bold text-primary-700">
                {formatCurrency(stats.totalCollectedRent)}
              </p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg">
              <p className="text-xs text-gray-500">Pending Dues</p>
              <p className="text-base font-bold text-yellow-700">
                {formatCurrency(stats.pendingRent)}
              </p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <p className="text-xs text-gray-500">Open Complaints</p>
              <p className="text-base font-bold text-red-700">{stats.openComplaints}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Rooms Tab ────────────────────────────────────────────────────────

function RoomsTab({ propertyId }: { propertyId: string }) {
  const qc = useQueryClient();
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [form, setForm] = useState({ number: '', floor: '', type: 'DOUBLE_SHARING', monthlyRent: '' });
  const [formError, setFormError] = useState('');

  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ['rooms', propertyId],
    queryFn: () => getRooms(propertyId),
  });

  const addRoomMutation = useMutation({
    mutationFn: (dto: CreateRoomDto) => createRoom(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms', propertyId] });
      qc.invalidateQueries({ queryKey: ['operator-dashboard'] });
      setShowAddRoom(false);
      setForm({ number: '', floor: '', type: 'DOUBLE_SHARING', monthlyRent: '' });
    },
    onError: () => setFormError('Failed to create room. Check if room number already exists.'),
  });

  const handleAddRoom = () => {
    setFormError('');
    if (!form.number || !form.monthlyRent) {
      setFormError('Room number and rent are required.');
      return;
    }
    addRoomMutation.mutate({
      propertyId,
      number: form.number,
      floor: form.floor ? parseInt(form.floor) : undefined,
      type: form.type as Room['type'],
      sharingCapacity: parseInt(form.type.split('_')[0] === 'PRIVATE' ? '1' : form.type.split('_')[0] === 'DOUBLE' ? '2' : form.type.split('_')[0] === 'TRIPLE' ? '3' : form.type.split('_')[0] === 'FOUR' ? '4' : '6'),
      baseRent: parseFloat(form.monthlyRent),
    });
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{rooms.length} room{rooms.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setShowAddRoom(true)}
          className="btn-primary text-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Room
        </button>
      </div>

      {rooms.length === 0 ? (
        <EmptyState
          icon={BedDouble}
          title="No rooms yet"
          description="Add rooms to start assigning tenants."
          action={
            <button
              onClick={() => setShowAddRoom(true)}
              className="btn-primary text-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Room
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {rooms.map((room) => (
            <RoomRow key={room.id} room={room} />
          ))}
        </div>
      )}

      {/* Add Room Modal */}
      <Modal isOpen={showAddRoom} onClose={() => setShowAddRoom(false)} title="Add Room" size="sm">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Room Number" required>
              <Input
                value={form.number}
                onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
                placeholder="101"
              />
            </FormField>
            <FormField label="Floor">
              <Input
                value={form.floor}
                onChange={(e) => setForm((f) => ({ ...f, floor: e.target.value }))}
                type="number"
                placeholder="1"
              />
            </FormField>
          </div>

          <FormField label="Room Type" required>
            <SelectField
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              options={ROOM_TYPES}
            />
          </FormField>

          <FormField label="Monthly Rent per Bed (₹)" required>
            <Input
              value={form.monthlyRent}
              onChange={(e) => setForm((f) => ({ ...f, monthlyRent: e.target.value }))}
              type="number"
              placeholder="8000"
            />
          </FormField>

          {formError && <p className="text-xs text-red-500">{formError}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button onClick={() => setShowAddRoom(false)} className="btn-secondary text-sm">
              Cancel
            </button>
            <button
              onClick={handleAddRoom}
              disabled={addRoomMutation.isPending}
              className="btn-primary text-sm flex items-center gap-2"
            >
              {addRoomMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Add Room
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function RoomRow({ room }: { room: Room }) {
  const beds: BedInfo[] = room.beds.map((b) => ({
    id: b.id,
    label: b.label,
    status: b.status,
    tenantName: b.currentAllocation?.tenant.user.name,
    monthlyRent: b.monthlyRent ?? room.baseRent,
  }));

  const occupied = beds.filter((b) => b.status === 'OCCUPIED').length;

  return (
    <div className="border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-700">
            {room.number}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">Room {room.number}</span>
              {room.floor !== null && (
                <span className="text-xs text-gray-400">Floor {room.floor}</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-gray-500">
                {ROOM_TYPE_LABELS[room.type]} · {formatCurrency(room.baseRent)}/bed
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{occupied}/{room.beds.length}</span>
          <RoomStatusBadge status={room.status} />
        </div>
      </div>

      <BedGrid beds={beds} compact />
    </div>
  );
}

// ── Tenants Tab ──────────────────────────────────────────────────────

const TENANT_COLUMNS: Column<Tenant>[] = [
  {
    key: 'name',
    header: 'Tenant',
    render: (t) => (
      <div>
        <p className="font-medium text-gray-900">{t.user.name}</p>
        <p className="text-xs text-gray-400">{t.tenantCode}</p>
      </div>
    ),
  },
  {
    key: 'room',
    header: 'Room / Bed',
    render: (t) => {
      const a = t.allocations.find((x) => x.isActive);
      return a ? (
        <span className="text-sm">
          {a.bed.room.number} — Bed {a.bed.label}
        </span>
      ) : (
        <span className="text-xs text-gray-400">Not assigned</span>
      );
    },
  },
  {
    key: 'status',
    header: 'Status',
    render: (t) => <TenantStatusBadge status={t.status} />,
  },
  {
    key: 'moveIn',
    header: 'Move-in',
    render: (t) =>
      t.moveInDate ? (
        <span className="text-sm text-gray-600">{formatDate(t.moveInDate)}</span>
      ) : (
        <span className="text-xs text-gray-400">—</span>
      ),
  },
];

function TenantsTab({
  propertyId,
  onViewTenant,
}: {
  propertyId: string;
  onViewTenant: (id: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['tenants', propertyId, statusFilter],
    queryFn: () => getTenants({ propertyId, status: statusFilter || undefined, limit: 50 }),
  });

  const tenants = data?.tenants ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {['', 'ACTIVE', 'LEAD', 'NOTICE_PERIOD'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s === '' ? 'All' : s === 'NOTICE_PERIOD' ? 'Notice' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      <Table
        columns={TENANT_COLUMNS}
        data={tenants}
        isLoading={isLoading}
        keyExtractor={(t) => t.id}
        onRowClick={(t) => onViewTenant(t.id)}
        emptyTitle="No tenants"
        emptyDescription="Tenants will appear here once added."
      />
    </div>
  );
}

// ── Financials Tab ───────────────────────────────────────────────────

function FinancialsTab({
  propertyId,
  stats,
}: {
  propertyId: string;
  stats?: {
    totalExpectedRent: number;
    totalCollectedRent: number;
    pendingRent: number;
    rentCollectionRate: number;
  };
}) {
  if (!stats) {
    return (
      <EmptyState
        icon={IndianRupee}
        title="No financial data"
        description="Financial data will appear once rent cycles are generated."
      />
    );
  }

  const collectionPct = Math.round(stats.rentCollectionRate);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-gray-50 rounded-xl">
          <p className="text-xs text-gray-500 mb-1">Expected This Month</p>
          <p className="text-xl font-bold text-gray-900">
            {formatCurrency(stats.totalExpectedRent)}
          </p>
        </div>
        <div className="p-4 bg-green-50 rounded-xl">
          <p className="text-xs text-gray-500 mb-1">Collected</p>
          <p className="text-xl font-bold text-green-700">
            {formatCurrency(stats.totalCollectedRent)}
          </p>
        </div>
        <div className="p-4 bg-yellow-50 rounded-xl">
          <p className="text-xs text-gray-500 mb-1">Pending Dues</p>
          <p className="text-xl font-bold text-yellow-700">
            {formatCurrency(stats.pendingRent)}
          </p>
        </div>
      </div>

      <div className="p-4 bg-gray-50 rounded-xl space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Collection Rate</span>
          <span className="font-bold text-gray-900">{collectionPct}%</span>
        </div>
        <OccupancyBar
          occupied={stats.totalCollectedRent}
          total={stats.totalExpectedRent}
          showLabel={false}
        />
      </div>

      <p className="text-xs text-gray-400 text-center">
        Detailed payment history available in the Payments section.
      </p>
    </div>
  );
}

// ── Performance Tab ──────────────────────────────────────────────────

function PerformanceTab({ propertyId }: { propertyId: string }) {
  const { data: perf, isLoading } = useQuery({
    queryKey: ['property-performance', propertyId],
    queryFn: () => getPropertyPerformance(propertyId),
  });

  if (isLoading) return <PageLoader />;
  if (!perf) return null;

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className="space-y-5">
      <p className="text-xs text-gray-500">
        {MONTHS[perf.month - 1]} {perf.year} — Current month operational snapshot
      </p>

      {/* Occupancy */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Occupancy</p>
          <div className="flex items-end gap-2 mb-3">
            <p className="text-3xl font-bold text-gray-900">{perf.occupancy.rate}%</p>
            <p className="text-sm text-gray-400 mb-1">{perf.occupancy.occupied}/{perf.occupancy.total} beds</p>
          </div>
          <OccupancyBar occupied={perf.occupancy.occupied} total={perf.occupancy.total} showLabel showCounts />
          <div className="flex gap-4 mt-3 text-xs text-gray-500">
            <span>Occupied: <strong className="text-gray-800">{perf.occupancy.occupied}</strong></span>
            <span>Vacant: <strong className="text-green-700">{perf.occupancy.vacant}</strong></span>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Collection</p>
          <div className="flex items-end gap-2 mb-3">
            <p className="text-3xl font-bold text-gray-900">{perf.collection.rate}%</p>
            <p className="text-sm text-gray-400 mb-1">collected</p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
            <div
              className={`h-2 rounded-full ${perf.collection.rate >= 90 ? 'bg-green-500' : perf.collection.rate >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${perf.collection.rate}%` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
            <span>Expected: <strong className="text-gray-800">{formatCurrency(perf.collection.expected)}</strong></span>
            <span>Collected: <strong className="text-green-700">{formatCurrency(perf.collection.collected)}</strong></span>
            <span>Remaining: <strong className="text-yellow-700">{formatCurrency(perf.collection.remaining)}</strong></span>
          </div>
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{perf.tenants.active}</p>
          <p className="text-xs text-gray-500 mt-1">Active Tenants</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className={`text-2xl font-bold ${perf.collection.overdueCycles > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {perf.collection.overdueRate}%
          </p>
          <p className="text-xs text-gray-500 mt-1">Overdue Rate</p>
          <p className="text-xs text-gray-400">{perf.collection.overdueCycles} of {perf.collection.totalCycles}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className={`text-2xl font-bold ${perf.complaints.open > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {perf.complaints.open}
          </p>
          <p className="text-xs text-gray-500 mt-1">Open Complaints</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{perf.occupancy.vacant}</p>
          <p className="text-xs text-gray-500 mt-1">Vacant Beds</p>
        </div>
      </div>

      {/* Complaint breakdown */}
      {Object.keys(perf.complaints.byStatus).length > 0 && (
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Complaints by Status</p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(perf.complaints.byStatus).map(([status, count]) => (
              <div key={status} className="text-sm">
                <span className="text-gray-500">{status.replace('_', ' ')}: </span>
                <span className="font-semibold text-gray-800">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Team Tab ──────────────────────────────────────────────────────────────────

const ROLE_OPTIONS: { value: PropertyRoleType; label: string; description: string }[] = [
  { value: 'OWNER', label: 'Owner', description: 'Full access, receives settlements' },
  { value: 'OPERATOR', label: 'Operator', description: 'Manages day-to-day operations' },
  { value: 'CO_OPERATOR', label: 'Co-Operator', description: 'Partner in operations' },
  { value: 'STAFF', label: 'Staff', description: 'Support / maintenance' },
];

const ROLE_STYLES: Record<PropertyRoleType, string> = {
  OWNER: 'bg-purple-50 text-purple-700',
  OPERATOR: 'bg-blue-50 text-blue-700',
  CO_OPERATOR: 'bg-indigo-50 text-indigo-700',
  STAFF: 'bg-gray-100 text-gray-600',
};

function TeamTab({ propertyId }: { propertyId: string }) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [emailSearch, setEmailSearch] = useState('');
  const [foundUser, setFoundUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [isLooking, setIsLooking] = useState(false);
  const [selectedRole, setSelectedRole] = useState<PropertyRoleType>('OPERATOR');
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['property-roles', propertyId],
    queryFn: () => getPropertyRoles(propertyId),
  });

  const addMut = useMutation({
    mutationFn: () => addPropertyRole(propertyId, { userId: foundUser!.id, role: selectedRole }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['property-roles', propertyId] });
      qc.invalidateQueries({ queryKey: ['property', propertyId] });
      setShowAdd(false);
      setEmailSearch('');
      setFoundUser(null);
      toast.success('Team member added');
    },
    onError: () => toast.error('Failed to add team member'),
  });

  const removeMut = useMutation({
    mutationFn: (roleId: string) => removePropertyRole(propertyId, roleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['property-roles', propertyId] });
      qc.invalidateQueries({ queryKey: ['property', propertyId] });
      setRemoveConfirmId(null);
      toast.success('Team member removed');
    },
    onError: () => toast.error('Failed to remove team member'),
  });

  const handleLookup = async () => {
    if (!emailSearch.trim()) { setLookupError('Enter an email address'); return; }
    setIsLooking(true);
    setLookupError('');
    setFoundUser(null);
    try {
      const user = await lookupUserByEmail(propertyId, emailSearch.trim());
      setFoundUser(user);
    } catch {
      setLookupError('No user found with that email. They must register first.');
    } finally {
      setIsLooking(false);
    }
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Property Team</h3>
          <p className="text-xs text-gray-400 mt-0.5">{roles.length} member{roles.length !== 1 ? 's' : ''}</p>
        </div>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Add Member
          </button>
        )}
      </div>

      {/* Add Member Panel */}
      {showAdd && (
        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Add Team Member</p>

          {/* Email lookup */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Find by Email</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={emailSearch}
                onChange={(e) => { setEmailSearch(e.target.value); setLookupError(''); setFoundUser(null); }}
                onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                placeholder="user@email.com"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleLookup}
                disabled={isLooking}
                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors disabled:opacity-50"
              >
                {isLooking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>
            </div>
            {lookupError && <p className="text-xs text-red-500 mt-1">{lookupError}</p>}
          </div>

          {/* Found user */}
          {foundUser && (
            <div className="bg-white rounded-lg border border-green-200 p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-sm">
                {foundUser.name[0]?.toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">{foundUser.name}</p>
                <p className="text-xs text-gray-400">{foundUser.email}</p>
              </div>
              <ShieldCheck className="w-4 h-4 text-green-500" />
            </div>
          )}

          {/* Role selector */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Assign Role</label>
            <div className="grid grid-cols-2 gap-2">
              {ROLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedRole(opt.value)}
                  className={`text-left p-2.5 rounded-lg border text-xs transition-colors ${
                    selectedRole === opt.value
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <p className="font-semibold text-gray-800">{opt.label}</p>
                  <p className="text-gray-400 mt-0.5">{opt.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => { setShowAdd(false); setEmailSearch(''); setFoundUser(null); setLookupError(''); }}
              className="flex-1 text-sm py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => addMut.mutate()}
              disabled={!foundUser || addMut.isPending}
              className="flex-1 text-sm py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {addMut.isPending ? 'Adding…' : 'Add to Team'}
            </button>
          </div>
        </div>
      )}

      {/* Team List */}
      {roles.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No team members"
          description="Add operators, staff, or owners to manage this property."
        />
      ) : (
        <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
          {roles.map((role: PropertyRole) => (
            <div key={role.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600">
                  {role.user.name[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{role.user.name}</p>
                  <p className="text-xs text-gray-400">{role.user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${ROLE_STYLES[role.role]}`}>
                  {role.role.replace('_', ' ')}
                </span>
                {removeConfirmId === role.id ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500">Remove?</span>
                    <button
                      onClick={() => removeMut.mutate(role.id)}
                      disabled={removeMut.isPending}
                      className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setRemoveConfirmId(null)}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setRemoveConfirmId(role.id)}
                    className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                    title="Remove from property"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
