'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare,
  Search,
  Building2,
  ChevronDown,
  Plus,
  Loader2,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
} from 'lucide-react';
import { getProperties } from '@/lib/properties-api';
import {
  getComplaints,
  getComplaint,
  createComplaint,
  updateComplaint,
  type Complaint,
  type ComplaintUpdate,
  type ComplaintCategory,
  type ComplaintStatus,
  type ComplaintPriority,
} from '@/lib/complaints-api';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { FormField, Input, SelectField, Textarea } from '@/components/ui/FormField';
import { formatDate, cn } from '@/lib/utils';

const STATUS_TABS: { key: string; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'OPEN', label: 'Open' },
  { key: 'ASSIGNED', label: 'Assigned' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'RESOLVED', label: 'Resolved' },
  { key: 'CLOSED', label: 'Closed' },
];

const PRIORITY_CONFIG: Record<string, { label: string; cls: string }> = {
  LOW:    { label: 'Low',    cls: 'bg-gray-100 text-gray-600' },
  MEDIUM: { label: 'Medium', cls: 'bg-blue-100 text-blue-700' },
  HIGH:   { label: 'High',   cls: 'bg-orange-100 text-orange-700' },
  URGENT: { label: 'Urgent', cls: 'bg-red-100 text-red-700' },
};

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  OPEN:        { label: 'Open',        cls: 'bg-red-100 text-red-700',     icon: AlertCircle },
  ASSIGNED:    { label: 'Assigned',    cls: 'bg-yellow-100 text-yellow-700', icon: Clock },
  IN_PROGRESS: { label: 'In Progress', cls: 'bg-blue-100 text-blue-700',   icon: Clock },
  RESOLVED:    { label: 'Resolved',    cls: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  CLOSED:      { label: 'Closed',      cls: 'bg-gray-100 text-gray-500',   icon: CheckCircle2 },
  REJECTED:    { label: 'Rejected',    cls: 'bg-gray-100 text-gray-500',   icon: XCircle },
};

// What transitions are available from each status (frontend mirror of backend)
const NEXT_STATUSES: Partial<Record<ComplaintStatus, ComplaintStatus[]>> = {
  OPEN:        ['ASSIGNED', 'REJECTED'],
  ASSIGNED:    ['IN_PROGRESS', 'OPEN'],
  IN_PROGRESS: ['RESOLVED', 'ASSIGNED'],
  RESOLVED:    ['CLOSED', 'IN_PROGRESS'],
};

const CATEGORIES: { value: ComplaintCategory; label: string }[] = [
  { value: 'MAINTENANCE',  label: 'Maintenance' },
  { value: 'PLUMBING',     label: 'Plumbing' },
  { value: 'ELECTRICAL',   label: 'Electrical' },
  { value: 'HOUSEKEEPING', label: 'Housekeeping' },
  { value: 'SECURITY',     label: 'Security' },
  { value: 'FOOD',         label: 'Food' },
  { value: 'WIFI',         label: 'Wi-Fi' },
  { value: 'NOISE',        label: 'Noise' },
  { value: 'OTHER',        label: 'Other' },
];

const PRIORITIES: { value: ComplaintPriority; label: string }[] = [
  { value: 'LOW',    label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH',   label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

export default function ComplaintsPage() {
  const qc = useQueryClient();

  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    category: 'MAINTENANCE' as ComplaintCategory,
    priority: 'MEDIUM' as ComplaintPriority,
  });
  const [createError, setCreateError] = useState('');

  const [updateStatus, setUpdateStatus] = useState<ComplaintStatus>('OPEN');
  const [updateComment, setUpdateComment] = useState('');
  const [updateError, setUpdateError] = useState('');

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

  const { data: viewingComplaint, isLoading: detailLoading } = useQuery<Complaint>({
    queryKey: ['complaint', viewingId],
    queryFn: () => getComplaint(viewingId!),
    enabled: !!viewingId,
  });

  const filtered = complaints.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      (c.tenant?.user.name.toLowerCase().includes(q) ?? false)
    );
  });

  const urgentCount = complaints.filter((c) => c.priority === 'URGENT' && c.status !== 'CLOSED' && c.status !== 'REJECTED').length;
  const openCount = complaints.filter((c) => c.status === 'OPEN').length;

  const createMutation = useMutation({
    mutationFn: () => createComplaint({ ...createForm, propertyId: activePropertyId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['complaints'] });
      setShowCreate(false);
      setCreateForm({ title: '', description: '', category: 'MAINTENANCE', priority: 'MEDIUM' });
      setCreateError('');
      toast.success('Complaint submitted');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setCreateError(msg ?? 'Failed to create complaint.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      updateComplaint(viewingId!, {
        status: updateStatus !== viewingComplaint?.status ? updateStatus : undefined,
        comment: updateComment || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['complaints'] });
      qc.invalidateQueries({ queryKey: ['complaint', viewingId] });
      setUpdateComment('');
      setUpdateError('');
      toast.success('Complaint updated');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setUpdateError(msg ?? 'Update failed.');
    },
  });

  const openDetail = (c: Complaint) => {
    setViewingId(c.id);
    setUpdateStatus(c.status);
    setUpdateComment('');
    setUpdateError('');
  };

  const closeDetail = () => {
    setViewingId(null);
    setUpdateComment('');
    setUpdateError('');
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Complaints"
        subtitle={`${complaints.length} total`}
        actions={
          activePropertyId ? (
            <button
              onClick={() => setShowCreate(true)}
              className="btn-primary text-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Complaint
            </button>
          ) : undefined
        }
      />

      {/* Alert banner for urgent/open */}
      {(urgentCount > 0 || openCount > 3) && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <div className="text-sm text-red-700">
            {urgentCount > 0 && (
              <span className="font-semibold">{urgentCount} urgent complaint{urgentCount !== 1 ? 's' : ''} need immediate attention. </span>
            )}
            {openCount > 0 && (
              <span>{openCount} open complaint{openCount !== 1 ? 's' : ''} awaiting assignment.</span>
            )}
          </div>
        </div>
      )}

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
          className="input-field text-sm bg-white w-40"
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
            placeholder="Search by title or tenant..."
            className="input-field pl-9 text-sm w-full"
          />
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map((tab) => {
          const count = tab.key
            ? complaints.filter((c) => c.status === tab.key).length
            : complaints.length;
          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                'text-xs px-3 py-1.5 rounded-full font-medium transition-colors flex items-center gap-1.5',
                statusFilter === tab.key
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              )}
            >
              {tab.label}
              {count > 0 && (
                <span className={cn(
                  'text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center',
                  statusFilter === tab.key ? 'bg-white/20' : 'bg-gray-200 text-gray-500',
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Table */}
      {properties.length === 0 && !isLoading ? (
        <div className="card">
          <EmptyState icon={Building2} title="No properties" description="Add a property first." />
        </div>
      ) : isLoading ? (
        <div className="card p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={MessageSquare}
            title="No complaints"
            description={search || statusFilter || categoryFilter ? 'No complaints match your filters.' : 'No complaints have been raised yet.'}
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Complaint</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Tenant</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Priority</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Assigned To</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Raised</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((c) => {
                const pCfg = PRIORITY_CONFIG[c.priority];
                const sCfg = STATUS_CONFIG[c.status];
                const StatusIcon = sCfg?.icon ?? MessageSquare;
                return (
                  <tr
                    key={c.id}
                    onClick={() => openDetail(c)}
                    className={cn(
                      'cursor-pointer hover:bg-gray-50 transition-colors',
                      c.priority === 'URGENT' && c.status !== 'CLOSED' && c.status !== 'REJECTED'
                        ? 'border-l-2 border-red-400'
                        : '',
                    )}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 leading-snug">{c.title}</p>
                      {c._count.updates > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5">{c._count.updates} update{c._count.updates !== 1 ? 's' : ''}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {c.tenant?.user.name ?? <span className="text-gray-400 italic">Staff</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500">{c.category.replace('_', ' ')}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', pCfg?.cls)}>
                        {pCfg?.label ?? c.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', sCfg?.cls)}>
                        <StatusIcon className="w-3 h-3" />
                        {sCfg?.label ?? c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {c.assignedToUser?.name ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatDate(c.createdAt)}</td>
                    <td className="px-4 py-3">
                      <ArrowRight className="w-4 h-4 text-gray-300" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); setCreateError(''); }} title="New Complaint" size="md">
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
              placeholder="Detailed description of the problem..."
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

          {createError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {createError}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={() => { setShowCreate(false); setCreateError(''); }} className="btn-secondary flex-1 text-sm">
              Cancel
            </button>
            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !createForm.title || !createForm.description}
              className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Submit Complaint
            </button>
          </div>
        </div>
      </Modal>

      {/* Detail / Update Modal */}
      <Modal
        isOpen={!!viewingId}
        onClose={closeDetail}
        title="Complaint Details"
        size="lg"
      >
        {detailLoading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : viewingComplaint ? (
          <div className="divide-y divide-gray-100">
            {/* Header info */}
            <div className="p-6 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-gray-900 text-base">{viewingComplaint.title}</h3>
                <div className="flex items-center gap-2 shrink-0">
                  {(() => {
                    const pCfg = PRIORITY_CONFIG[viewingComplaint.priority];
                    return (
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', pCfg?.cls)}>
                        {pCfg?.label}
                      </span>
                    );
                  })()}
                  {(() => {
                    const sCfg = STATUS_CONFIG[viewingComplaint.status];
                    const StatusIcon = sCfg?.icon ?? MessageSquare;
                    return (
                      <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', sCfg?.cls)}>
                        <StatusIcon className="w-3 h-3" />
                        {sCfg?.label}
                      </span>
                    );
                  })()}
                </div>
              </div>

              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 leading-relaxed">
                {viewingComplaint.description}
              </p>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-400 uppercase font-medium">Category</p>
                  <p className="text-gray-700 mt-0.5">{viewingComplaint.category.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase font-medium">Raised By</p>
                  <p className="text-gray-700 mt-0.5">
                    {viewingComplaint.tenant?.user.name ?? viewingComplaint.raisedByUser.name}
                  </p>
                </div>
                {viewingComplaint.assignedToUser && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-medium">Assigned To</p>
                    <p className="text-gray-700 mt-0.5">{viewingComplaint.assignedToUser.name}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-400 uppercase font-medium">Raised On</p>
                  <p className="text-gray-700 mt-0.5">{formatDate(viewingComplaint.createdAt)}</p>
                </div>
                {viewingComplaint.resolvedAt && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-medium">Resolved On</p>
                    <p className="text-gray-700 mt-0.5">{formatDate(viewingComplaint.resolvedAt)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Update history */}
            {viewingComplaint.updates.length > 0 && (
              <div className="p-6 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Update History</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {viewingComplaint.updates.map((u: ComplaintUpdate) => (
                    <div key={u.id} className="flex gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-2 shrink-0" />
                      <div className="flex-1">
                        {u.statusChange && (
                          <p className="text-xs font-medium text-gray-500">{u.statusChange}</p>
                        )}
                        {u.comment && (
                          <p className="text-sm text-gray-700">{u.comment}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          {u.user.name} · {formatDate(u.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action panel — only if not terminal state */}
            {viewingComplaint.status !== 'CLOSED' && viewingComplaint.status !== 'REJECTED' && (
              <div className="p-6 space-y-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Update Complaint</p>

                {/* Next status buttons */}
                {NEXT_STATUSES[viewingComplaint.status as ComplaintStatus] && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Move to</p>
                    <div className="flex flex-wrap gap-2">
                      {NEXT_STATUSES[viewingComplaint.status as ComplaintStatus]!.map((s: ComplaintStatus) => {
                        const cfg = STATUS_CONFIG[s];
                        return (
                          <button
                            key={s}
                            onClick={() => setUpdateStatus(s)}
                            className={cn(
                              'text-xs px-3 py-1.5 rounded-full font-medium border-2 transition-all',
                              updateStatus === s
                                ? 'border-primary-500 bg-primary-50 text-primary-700'
                                : 'border-gray-200 text-gray-600 hover:border-gray-300',
                            )}
                          >
                            {cfg?.label ?? s}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => setUpdateStatus(viewingComplaint.status)}
                        className={cn(
                          'text-xs px-3 py-1.5 rounded-full font-medium border-2 transition-all',
                          updateStatus === viewingComplaint.status
                            ? 'border-gray-400 bg-gray-100 text-gray-700'
                            : 'border-gray-200 text-gray-400 hover:border-gray-300',
                        )}
                      >
                        Keep current
                      </button>
                    </div>
                  </div>
                )}

                <FormField label="Comment">
                  <Textarea
                    value={updateComment}
                    onChange={(e) => setUpdateComment(e.target.value)}
                    placeholder="Add a note about this update..."
                    rows={2}
                  />
                </FormField>

                {updateError && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {updateError}
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={closeDetail} className="btn-secondary flex-1 text-sm">
                    Close
                  </button>
                  <button
                    onClick={() => updateMutation.mutate()}
                    disabled={updateMutation.isPending || (updateStatus === viewingComplaint.status && !updateComment)}
                    className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save Update
                  </button>
                </div>
              </div>
            )}

            {(viewingComplaint.status === 'CLOSED' || viewingComplaint.status === 'REJECTED') && (
              <div className="p-6">
                <button onClick={closeDetail} className="btn-secondary text-sm w-full">Close</button>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
