'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Plus,
  Search,
  BedDouble,
  Users,
  IndianRupee,
  AlertCircle,
} from 'lucide-react';
import { getOperatorDashboard, getProperties } from '@/lib/properties-api';
import { PageHeader } from '@/components/ui/PageHeader';
import { OccupancyBar } from '@/components/ui/OccupancyBar';
import { PropertyStatusBadge, PropertyTypeBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { formatCurrency } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';

export default function PropertiesPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const debouncedSearch = useDebounce(search);

  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ['operator-dashboard'],
    queryFn: getOperatorDashboard,
  });

  const { data: properties = [], isLoading: propsLoading } = useQuery({
    queryKey: ['properties'],
    queryFn: getProperties,
  });

  const isLoading = dashLoading || propsLoading;

  // Merge basic property info with stats from dashboard
  const enriched = properties
    .filter((p) => {
      const matchSearch =
        !debouncedSearch ||
        p.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        p.city.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchStatus = !statusFilter || p.status === statusFilter;
      return matchSearch && matchStatus;
    })
    .map((p) => {
      const stats = dashData?.properties.find((d) => d.propertyId === p.id);
      return { ...p, stats };
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Properties"
        subtitle={`${properties.length} propert${properties.length === 1 ? 'y' : 'ies'}`}
        actions={
          <button
            onClick={() => router.push('/dashboard/properties/new')}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Property
          </button>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search properties..."
            className="input-field pl-9 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-field w-36 text-sm bg-white"
        >
          <option value="">All status</option>
          <option value="ACTIVE">Active</option>
          <option value="SETUP">Setup</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      {isLoading && <PageLoader />}

      {!isLoading && properties.length === 0 && (
        <div className="card">
          <EmptyState
            icon={Building2}
            title="No properties yet"
            description="Add your first PG property to start managing tenants and rooms."
            action={
              <button
                onClick={() => router.push('/dashboard/properties/new')}
                className="btn-primary text-sm flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Property
              </button>
            }
          />
        </div>
      )}

      {!isLoading && enriched.length === 0 && properties.length > 0 && (
        <div className="card">
          <EmptyState
            icon={Search}
            title="No results"
            description="Try adjusting your search or filters."
          />
        </div>
      )}

      {!isLoading && enriched.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {enriched.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              onView={() => router.push(`/dashboard/properties/${property.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface EnrichedProperty {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  type: string;
  status: string;
  stats?: {
    totalBeds: number;
    occupiedBeds: number;
    availableBeds: number;
    occupancyRate: number;
    totalCollectedRent: number;
    pendingRent: number;
    openComplaints: number;
  };
}

function PropertyCard({
  property,
  onView,
}: {
  property: EnrichedProperty;
  onView: () => void;
}) {
  const s = property.stats;

  return (
    <div
      onClick={onView}
      className="card p-5 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 group-hover:text-primary-700 transition-colors leading-tight">
              {property.name}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {property.city}, {property.state}
            </p>
          </div>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <PropertyTypeBadge type={property.type} />
          <PropertyStatusBadge status={property.status} />
        </div>
      </div>

      {/* Occupancy */}
      {s ? (
        <>
          <OccupancyBar
            occupied={s.occupiedBeds}
            total={s.totalBeds}
            showLabel
            showCounts
            className="mb-3"
          />

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-gray-400 mb-0.5">
                <BedDouble className="w-3.5 h-3.5" />
                <span className="text-xs">Vacant</span>
              </div>
              <p className="text-sm font-bold text-green-600">{s.availableBeds}</p>
            </div>
            <div className="text-center border-x border-gray-100">
              <div className="flex items-center justify-center gap-1 text-gray-400 mb-0.5">
                <IndianRupee className="w-3.5 h-3.5" />
                <span className="text-xs">Collected</span>
              </div>
              <p className="text-sm font-bold text-gray-800">
                {formatCurrency(s.totalCollectedRent)}
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-gray-400 mb-0.5">
                <AlertCircle className="w-3.5 h-3.5" />
                <span className="text-xs">Complaints</span>
              </div>
              <p className={`text-sm font-bold ${s.openComplaints > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                {s.openComplaints}
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2 text-xs text-gray-400 mt-2">
          <Users className="w-3.5 h-3.5" />
          <span>No data yet — add rooms to get started</span>
        </div>
      )}
    </div>
  );
}
