'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BedDouble,
  Users,
  IndianRupee,
  AlertTriangle,
  TrendingUp,
  MessageSquare,
  Building2,
  ChevronDown,
} from 'lucide-react';
import { getDashboardStats } from '@/lib/dashboard-api';
import { getProperties } from '@/lib/properties-api';
import { formatCurrency, cn } from '@/lib/utils';

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconClass,
  trend,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  iconClass: string;
  trend?: string;
}) {
  return (
    <div className="card p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', iconClass)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {trend && <p className="text-xs text-green-600 font-medium mt-3">{trend}</p>}
    </div>
  );
}

function PropertySelector({
  properties,
  selectedId,
  onChange,
}: {
  properties: { id: string; name: string; city: string }[];
  selectedId: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={selectedId}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-white border border-gray-200 rounded-lg pl-4 pr-10 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
      >
        {properties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} — {p.city}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
}

export default function DashboardPage() {
  const { data: properties = [], isLoading: propertiesLoading } = useQuery({
    queryKey: ['properties'],
    queryFn: getProperties,
  });

  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');

  const activePropertyId = selectedPropertyId || properties[0]?.id || '';

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats', activePropertyId],
    queryFn: () => getDashboardStats(activePropertyId),
    enabled: !!activePropertyId,
  });

  const isLoading = propertiesLoading || (!!activePropertyId && statsLoading);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Property overview and key metrics</p>
        </div>
        {properties.length > 0 && (
          <PropertySelector
            properties={properties}
            selectedId={activePropertyId}
            onChange={setSelectedPropertyId}
          />
        )}
      </div>

      {properties.length === 0 && !propertiesLoading && (
        <div className="card p-12 text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No properties yet</h3>
          <p className="text-sm text-gray-500">Add your first PG property to get started.</p>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-24 mb-3" />
              <div className="h-8 bg-gray-100 rounded w-16" />
            </div>
          ))}
        </div>
      )}

      {stats && !isLoading && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Occupancy Rate"
              value={`${stats.occupancyRate}%`}
              subtitle={`${stats.occupiedBeds} / ${stats.totalBeds} beds occupied`}
              icon={TrendingUp}
              iconClass="bg-green-50 text-green-600"
            />
            <StatCard
              title="Active Tenants"
              value={stats.activeTenants}
              subtitle={`${stats.leads} leads in pipeline`}
              icon={Users}
              iconClass="bg-blue-50 text-blue-600"
            />
            <StatCard
              title="Collected This Month"
              value={formatCurrency(stats.collectedThisMonth)}
              subtitle={`${stats.overdueCount} overdue cycles`}
              icon={IndianRupee}
              iconClass="bg-primary-50 text-primary-600"
            />
            <StatCard
              title="Pending Rent"
              value={formatCurrency(stats.pendingRent)}
              subtitle="Across all active tenants"
              icon={AlertTriangle}
              iconClass="bg-yellow-50 text-yellow-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Total Rooms"
              value={stats.totalRooms}
              icon={BedDouble}
              iconClass="bg-purple-50 text-purple-600"
            />
            <StatCard
              title="Available Beds"
              value={stats.availableBeds}
              icon={BedDouble}
              iconClass="bg-emerald-50 text-emerald-600"
            />
            <StatCard
              title="Open Complaints"
              value={stats.openComplaints}
              icon={MessageSquare}
              iconClass="bg-red-50 text-red-600"
            />
          </div>
        </>
      )}
    </div>
  );
}
