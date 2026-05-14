'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Search, Building2, ChevronDown, Plus, Loader2 } from 'lucide-react';
import { getProperties } from '@/lib/properties-api';
import {
  getComplaints,
  createComplaint,
  updateComplaint,
  type Complaint,
  type ComplaintCategory,
  type ComplaintStatus,
  type ComplaintPriority,
} from '@/lib/complaints-api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Table, type Column } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { FormField, Input, SelectField, Textarea } from '@/components/ui/FormField';
import { formatDate, cn } from '@/lib/utils';

const STATUS_TABS: { key: string; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'OPEN', label: 'Open' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'RESOLVED', label: 'Resolved' },
  { key: 'CLOSED', label: 'Closed' },
];

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-red-100 text-red-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-600',
};

const CATEGORIES: { value: ComplaintCategory; label: string }[] = [
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'CLEANLINESS', label: 'Cleanliness' },
  { value: 'NOISE', label: 'Noise' },
  { value: 'SECURITY', label: 'Security' },
  { value: 'FOOD', label: 'Food' },
  { value: 'BILLING', label: 'Billing' },
  { value: 'STAFF', label: 'Staff' },
  { value: 'FACILITIES', label: 'Facilities' },
  { value: 'OTHER', label: 'Other' },
];

const PRIORITIES: { value: ComplaintPriority; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

const STATUSES: { value: ComplaintStatus; label: string }[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
];

export default function ComplaintsPage() {
  const qc = useQueryClient();
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [viewingComplaint, setViewingComplaint] = useState<Complaint | null>(null);

  // Create form state
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    category: 'MAINTENANCE' as ComplaintCategory,
    priority: 'MEDIUM' as ComplaintPriority,
  });
  const [createError, setCreateError] = useState('');

  // Update form state
  const [updateStatus, setUpdateStatus] = useState<ComplaintStatus>('OPEN');
  const [updateComment, setUpdateComment] = useState('');

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

  const { data: complaints = [], isLoading } = useQuery({
    queryKey: ['complaints', activePropertyId, statusFilter, categoryFilter],
    queryFn: () =>
      getComplaints({
        propertyId: activePropertyId || undefined,
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
      }),
    enabled: !!activePropertyId,
  });

  const filtered = complaints.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      c.tenant.user.name.toLowerCase().includes(q)
    );
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createComplaint({ ...createForm, propertyId: activePropertyId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['complaints'] });
      setShowCreate(false);
      setCreateForm({ title: '', description: '', category: 'MAINTENANCE', priority: 'MEDIUM' });
      setCreateError('');
    },
    onError: (err: any) => {
      setCreateError(err?.response?.data?.message || 'Failed to create complaint.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      updateComplaint(viewingComplaint!.id, {
        status: updateStatus,
        comment: updateComment || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['complaints'] });
      setViewingComplaint(null);
      setUpdateComment('');
    },
  });

  const openView = (c: Complaint) => {
    setViewingComplaint(c);
    setUpdateStatus(c.status);
    setUpdateComment('');
  };

  const COLUMNS: Column<Complaint>[] = [
    {
      key: 'title',
      header: 'Complaint',
      render: (c) => (
        <div>
          <p className="font-medium text-gray-900 leading-snug">{c.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">{c.category.replace('_', ' ')}</p>
        </div>
      ),
    },
    {
      key: 'tenant',
      header: 'Tenant',
      render: (c) => (
        <div>
          <p className="text-sm text-gray-700">{c.tenant.user.name}</p>
          <p className="text-xs text-gray-400">{c.tenant.tenantCode}</p>
        </div>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (c) => (
        <span className={cn('badge text-xs', PRIORITY_COLORS[c.priority] ?? '')}>
          {c.priority}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) => (
        <span className={cn('badge text-xs', STATUS_COLORS[c.status] ?? '')}>
          {c.status.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'comments',
      header: 'Comments',
      render: (c) => (
        <span className="text-xs text-gray-500">{c._count.comments}</span>
      ),
    },
    {
      key: 'date',
      header: 'Raised',
      render: (c) => <span className="text-xs text-gray-500">{formatDate(c.createdAt)}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Complaints"
        subtitle={`${complaints.length} complaint${complaints.length !== 1 ? 's' : ''}`}
        actions={
          activePropertyId && (
            <button
              onClick={() => setShowCreate(true)}
              className="btn-primary text-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Complaint
            </button>
          )
        }
      />

      {/* Filters */}
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
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        )}

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="input-field text-sm bg-white w-36"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search complaints..."
            className="input-field pl-9 text-sm"
          />
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={cn(
              'text-xs px-3 py-1.5 rounded-full font-medium transition-colors',
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
      {properties.length === 0 && !isLoading ? (
        <div className="card">
          <EmptyState icon={Building2} title="No properties" description="Add a property first." />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <Table
            columns={COLUMNS}
            data={filtered}
            isLoading={isLoading}
            keyExtractor={(c) => c.id}
            onRowClick={openView}
            emptyTitle="No complaints"
            emptyDescription="No complaints match your current filters."
            emptyIcon={MessageSquare}
          />
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Complaint" size="md">
        <div className="p-6 space-y-4">
          <FormField label="Title" required>
            <Input
              value={createForm.title}
              onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Brief description of the issue"
            />
          </FormField>

          <FormField label="Description" required>
            <Textarea
              value={createForm.description}
              onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Detailed description..."
              rows={4}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Category" required>
              <SelectField
                value={createForm.category}
                onChange={(e) => setCreateForm((f) => ({ ...f, category: e.target.value as ComplaintCategory }))}
                options={CATEGORIES}
              />
            </FormField>
            <FormField label="Priority">
              <SelectField
                value={createForm.priority}
                onChange={(e) => setCreateForm((f) => ({ ...f, priority: e.target.value as ComplaintPriority }))}
                options={PRIORITIES}
              />
            </FormField>
          </div>

          {createError && <p className="text-sm text-red-500">{createError}</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowCreate(false)} className="btn-secondary flex-1 text-sm">
              Cancel
            </button>
            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !createForm.title || !createForm.description}
              className="btn-primary flex-1 text-sm flex items-center justify-center gap-2"
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Submit
            </button>
          </div>
        </div>
      </Modal>

      {/* View / Update Modal */}
      <Modal
        isOpen={!!viewingComplaint}
        onClose={() => setViewingComplaint(null)}
        title="Complaint Details"
        size="md"
      >
        {viewingComplaint && (
          <div className="p-6 space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900">{viewingComplaint.title}</h3>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={cn('badge text-xs', PRIORITY_COLORS[viewingComplaint.priority] ?? '')}>
                  {viewingComplaint.priority}
                </span>
                <span className="text-xs text-gray-400">{viewingComplaint.category.replace('_', ' ')}</span>
                <span className="text-xs text-gray-400">·</span>
                <span className="text-xs text-gray-400">{formatDate(viewingComplaint.createdAt)}</span>
              </div>
            </div>

            <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
              {viewingComplaint.description}
            </p>

            <div className="text-sm text-gray-600">
              <span className="font-medium">Tenant:</span> {viewingComplaint.tenant.user.name}{' '}
              <span className="text-gray-400">({viewingComplaint.tenant.tenantCode})</span>
            </div>

            {/* Comments */}
            {viewingComplaint.comments.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Comments</p>
                {viewingComplaint.comments.map((comment) => (
                  <div key={comment.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                    <p className="text-gray-700">{comment.content}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {comment.author.name} · {formatDate(comment.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Update */}
            {viewingComplaint.status !== 'CLOSED' && (
              <div className="border-t border-gray-200 pt-4 space-y-3">
                <FormField label="Update Status">
                  <SelectField
                    value={updateStatus}
                    onChange={(e) => setUpdateStatus(e.target.value as ComplaintStatus)}
                    options={STATUSES}
                  />
                </FormField>
                <FormField label="Add Comment">
                  <Textarea
                    value={updateComment}
                    onChange={(e) => setUpdateComment(e.target.value)}
                    placeholder="Optional comment..."
                    rows={2}
                  />
                </FormField>
                <div className="flex gap-3">
                  <button onClick={() => setViewingComplaint(null)} className="btn-secondary flex-1 text-sm">
                    Close
                  </button>
                  <button
                    onClick={() => updateMutation.mutate()}
                    disabled={updateMutation.isPending}
                    className="btn-primary flex-1 text-sm flex items-center justify-center gap-2"
                  >
                    {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    Update
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
