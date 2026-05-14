'use client';

import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Users,
  Search,
  Plus,
  ChevronDown,
  Building2,
} from 'lucide-react';
import { getTenants, type Tenant, type PaginatedTenants } from '@/lib/tenants-api';
import { getProperties } from '@/lib/properties-api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Table, Pagination, type Column } from '@/components/ui/Table';
import { TenantStatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn, formatDate } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'LEAD', label: 'Leads' },
  { key: 'VISIT_SCHEDULED', label: 'Visit' },
  { key: 'ROOM_FINALIZED', label: 'Finalizing' },
  { key: 'DEPOSIT_PENDING', label: 'Dep. Pending' },
  { key: 'KYC_PENDING', label: 'KYC Pending' },
  { key: 'NOTICE_PERIOD', label: 'Notice' },
  { key: 'MOVED_OUT', label: 'Moved Out' },
];

const TENANT_COLUMNS: Column<Tenant>[] = [
  {
    key: 'tenant',
    header: 'Tenant',
    render: (t) => (
      <div>
        <p className="font-medium text-gray-900">{t.user.name}</p>
        <p className="text-xs text-gray-400">{t.user.phone ?? t.user.email}</p>
      </div>
    ),
  },
  {
    key: 'code',
    header: 'Code',
    render: (t) => (
      <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
        {t.tenantCode}
      </span>
    ),
  },
  {
    key: 'room',
    header: 'Room / Bed',
    render: (t) => {
      const a = t.allocations.find((x) => x.isActive);
      if (!a) return <span className="text-xs text-gray-400">—</span>;
      return (
        <span className="text-sm text-gray-700">
          {a.bed.room.number} — Bed {a.bed.label}
        </span>
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
  {
    key: 'deposit',
    header: 'Deposit',
    render: (t) => (
      <div className="text-sm">
        <span className={t.depositStatus === 'PAID' ? 'text-green-600 font-medium' : 'text-yellow-600'}>
          {t.depositStatus === 'PAID' ? 'Paid' : t.depositStatus === 'PARTIALLY_PAID' ? 'Partial' : 'Pending'}
        </span>
      </div>
    ),
  },
];

export default function TenantsPage() {
  const router = useRouter();
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search);
  const LIMIT = 20;

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: getProperties,
    select: (data) => {
      if (data.length > 0 && !selectedPropertyId) {
        setTimeout(() => setSelectedPropertyId((prev) => prev || data[0]!.id), 0);
      }
      return data;
    },
  });

  const activePropertyId = selectedPropertyId || properties[0]?.id || '';

  const { data, isLoading } = useQuery<PaginatedTenants>({
    queryKey: ['tenants', activePropertyId, statusFilter, debouncedSearch, page],
    queryFn: () =>
      getTenants({
        propertyId: activePropertyId || undefined,
        status: statusFilter || undefined,
        search: debouncedSearch || undefined,
        page,
        limit: LIMIT,
      }),
    enabled: !!activePropertyId || !properties.length,
    placeholderData: keepPreviousData,
  });

  const tenants = data?.tenants ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tenants"
        subtitle={meta ? `${meta.total} tenant${meta.total !== 1 ? 's' : ''}` : ''}
        actions={
          <button
            onClick={() =>
              router.push(
                `/dashboard/tenants/new${activePropertyId ? `?propertyId=${activePropertyId}` : ''}`,
              )
            }
            className="btn-primary text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Tenant
          </button>
        }
      />

      {/* Property + Search */}
      <div className="flex flex-wrap items-center gap-3">
        {properties.length > 1 && (
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={activePropertyId}
              onChange={(e) => {
                setSelectedPropertyId(e.target.value);
                setPage(1);
              }}
              className="input-field pl-9 pr-8 text-sm bg-white appearance-none max-w-[200px]"
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

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name or phone..."
            className="input-field pl-9 text-sm"
          />
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setStatusFilter(tab.key);
              setPage(1);
            }}
            className={cn(
              'text-xs px-3 py-1.5 rounded-full font-medium transition-colors whitespace-nowrap',
              statusFilter === tab.key
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {properties.length === 0 && !isLoading ? (
          <EmptyState
            icon={Building2}
            title="No properties"
            description="Add a property first to manage tenants."
            action={
              <button
                onClick={() => router.push('/dashboard/properties/new')}
                className="btn-primary text-sm"
              >
                Add Property
              </button>
            }
          />
        ) : (
          <>
            <Table
              columns={TENANT_COLUMNS}
              data={tenants}
              isLoading={isLoading}
              keyExtractor={(t) => t.id}
              onRowClick={(t) => router.push(`/dashboard/tenants/${t.id}`)}
              emptyTitle="No tenants found"
              emptyDescription={
                statusFilter
                  ? `No tenants with status "${statusFilter.replace('_', ' ')}".`
                  : 'Add your first tenant to get started.'
              }
              emptyIcon={Users}
            />
            {meta && meta.totalPages > 1 && (
              <Pagination
                page={page}
                totalPages={meta.totalPages}
                total={meta.total}
                limit={LIMIT}
                onChange={setPage}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
