'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  BedDouble,
  Search,
  Building2,
  ChevronDown,
} from 'lucide-react';
import { getProperties } from '@/lib/properties-api';
import { getRooms, ROOM_TYPE_LABELS, type Room } from '@/lib/rooms-api';
import { PageHeader } from '@/components/ui/PageHeader';
import { OccupancyBar } from '@/components/ui/OccupancyBar';
import { RoomStatusBadge } from '@/components/ui/StatusBadge';
import { BedGrid, type BedInfo } from '@/components/ui/BedGrid';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { formatCurrency } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';

export default function RoomsPage() {
  const router = useRouter();
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const debouncedSearch = useDebounce(search);

  const { data: properties = [], isLoading: propsLoading } = useQuery({
    queryKey: ['properties'],
    queryFn: getProperties,
  });

  useEffect(() => {
    if (properties.length > 0 && !selectedPropertyId) {
      setSelectedPropertyId(properties[0]!.id);
    }
  }, [properties, selectedPropertyId]);

  const activePropertyId = selectedPropertyId || properties[0]?.id || '';

  const { data: rooms = [], isLoading: roomsLoading } = useQuery({
    queryKey: ['rooms', activePropertyId],
    queryFn: () => getRooms(activePropertyId),
    enabled: !!activePropertyId,
  });

  const filtered = rooms.filter((r) => {
    const matchSearch =
      !debouncedSearch ||
      r.number.toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchStatus = !statusFilter || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalBeds = rooms.reduce((s, r) => s + r.beds.length, 0);
  const occupiedBeds = rooms.reduce(
    (s, r) => s + r.beds.filter((b) => b.status === 'OCCUPIED').length,
    0,
  );
  const availableBeds = rooms.reduce(
    (s, r) => s + r.beds.filter((b) => b.status === 'AVAILABLE').length,
    0,
  );

  const isLoading = propsLoading || roomsLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rooms & Beds"
        subtitle="Occupancy visualization and bed management"
        actions={
          activePropertyId && (
            <button
              onClick={() => router.push(`/dashboard/properties/${activePropertyId}?tab=rooms`)}
              className="btn-secondary text-sm"
            >
              Manage in Property
            </button>
          )
        }
      />

      {/* Property Selector + Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {properties.length > 1 && (
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={activePropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="input-field pl-9 pr-8 text-sm bg-white appearance-none max-w-[220px]"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search room..."
            className="input-field pl-9 text-sm w-40"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-field text-sm bg-white w-40"
        >
          <option value="">All rooms</option>
          <option value="AVAILABLE">Available</option>
          <option value="PARTIALLY_OCCUPIED">Partial</option>
          <option value="FULLY_OCCUPIED">Full</option>
          <option value="UNDER_MAINTENANCE">Maintenance</option>
        </select>
      </div>

      {/* Summary Strip */}
      {!isLoading && rooms.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-3 text-center">
            <p className="text-xs text-gray-500">Total Beds</p>
            <p className="text-xl font-bold text-gray-900">{totalBeds}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xs text-gray-500">Occupied</p>
            <p className="text-xl font-bold text-red-600">{occupiedBeds}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xs text-gray-500">Available</p>
            <p className="text-xl font-bold text-green-600">{availableBeds}</p>
          </div>
        </div>
      )}

      {isLoading && <PageLoader />}

      {!isLoading && properties.length === 0 && (
        <div className="card">
          <EmptyState
            icon={Building2}
            title="No properties"
            description="Add a property first, then configure rooms."
            action={
              <button
                onClick={() => router.push('/dashboard/properties/new')}
                className="btn-primary text-sm"
              >
                Add Property
              </button>
            }
          />
        </div>
      )}

      {!isLoading && rooms.length === 0 && activePropertyId && (
        <div className="card">
          <EmptyState
            icon={BedDouble}
            title="No rooms configured"
            description="Go to the property to add rooms and beds."
            action={
              <button
                onClick={() => router.push(`/dashboard/properties/${activePropertyId}`)}
                className="btn-primary text-sm"
              >
                Configure Rooms
              </button>
            }
          />
        </div>
      )}

      {/* Room Cards Grid */}
      {!isLoading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      )}

      {!isLoading && filtered.length === 0 && rooms.length > 0 && (
        <div className="card">
          <EmptyState
            icon={Search}
            title="No rooms match"
            description="Adjust your search or filters."
          />
        </div>
      )}
    </div>
  );
}

function RoomCard({ room }: { room: Room }) {
  const beds: BedInfo[] = room.beds.map((b) => ({
    id: b.id,
    label: b.label,
    status: b.status,
    tenantName: b.currentAllocation?.tenant.user.name,
    monthlyRent: b.monthlyRent ?? room.baseRent,
  }));

  const occupied = beds.filter((b) => b.status === 'OCCUPIED').length;
  const available = beds.filter((b) => b.status === 'AVAILABLE').length;
  const reserved = beds.filter((b) => b.status === 'RESERVED').length;

  return (
    <div className="card p-5">
      {/* Room Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-sm font-bold text-gray-700 shrink-0">
            {room.number}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="font-semibold text-gray-900">Room {room.number}</h3>
              {room.floor !== null && (
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                  Floor {room.floor}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {ROOM_TYPE_LABELS[room.type]} · {formatCurrency(room.baseRent)}/bed
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <RoomStatusBadge status={room.status} />
        </div>
      </div>

      {/* Occupancy bar */}
      <OccupancyBar
        occupied={occupied}
        total={beds.length}
        showLabel
        showCounts
        className="mb-4"
      />

      {/* Bed Grid — full size cards */}
      <BedGrid beds={beds} compact={false} />

      {/* Quick Stats footer */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          {available} vacant
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          {occupied} occupied
        </span>
        {reserved > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            {reserved} reserved
          </span>
        )}
      </div>
    </div>
  );
}
