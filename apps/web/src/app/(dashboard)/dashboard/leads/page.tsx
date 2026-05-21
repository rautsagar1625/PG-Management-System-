'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  ChevronDown,
  Plus,
  Loader2,
  AlertCircle,
  Phone,
  Calendar,
  IndianRupee,
  BedDouble,
  Clock,
  CheckCircle2,
  XCircle,
  CalendarClock,
  X,
} from 'lucide-react';
import { getProperties } from '@/lib/properties-api';
import {
  getLeads,
  createLead,
  updateLeadStatus,
  scheduleVisit,
  type Lead,
  type CreateLeadDto,
} from '@/lib/leads-api';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { FormField, Input, Textarea } from '@/components/ui/FormField';
import { formatDate, cn } from '@/lib/utils';

// ── Pipeline configuration ────────────────────────────────────────────

type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'VISIT_SCHEDULED'
  | 'VISITED'
  | 'NEGOTIATING'
  | 'TOKEN_PAID'
  | 'CONVERTED'
  | 'LOST';

const PIPELINE_COLUMNS: {
  status: LeadStatus;
  label: string;
  headerCls: string;
  badgeCls: string;
}[] = [
  {
    status: 'NEW',
    label: 'New',
    headerCls: 'bg-gray-100 border-gray-200',
    badgeCls: 'bg-gray-200 text-gray-700',
  },
  {
    status: 'CONTACTED',
    label: 'Contacted',
    headerCls: 'bg-blue-50 border-blue-200',
    badgeCls: 'bg-blue-100 text-blue-700',
  },
  {
    status: 'VISIT_SCHEDULED',
    label: 'Visit Scheduled',
    headerCls: 'bg-indigo-50 border-indigo-200',
    badgeCls: 'bg-indigo-100 text-indigo-700',
  },
  {
    status: 'VISITED',
    label: 'Visited',
    headerCls: 'bg-purple-50 border-purple-200',
    badgeCls: 'bg-purple-100 text-purple-700',
  },
  {
    status: 'NEGOTIATING',
    label: 'Negotiating',
    headerCls: 'bg-amber-50 border-amber-200',
    badgeCls: 'bg-amber-100 text-amber-700',
  },
  {
    status: 'TOKEN_PAID',
    label: 'Token Paid',
    headerCls: 'bg-orange-50 border-orange-200',
    badgeCls: 'bg-orange-100 text-orange-700',
  },
  {
    status: 'CONVERTED',
    label: 'Converted',
    headerCls: 'bg-green-50 border-green-200',
    badgeCls: 'bg-green-100 text-green-700',
  },
  {
    status: 'LOST',
    label: 'Lost',
    headerCls: 'bg-red-50 border-red-200',
    badgeCls: 'bg-red-100 text-red-700',
  },
];

const STATUS_CARD_BORDER: Record<LeadStatus, string> = {
  NEW: 'border-l-gray-300',
  CONTACTED: 'border-l-blue-400',
  VISIT_SCHEDULED: 'border-l-indigo-400',
  VISITED: 'border-l-purple-400',
  NEGOTIATING: 'border-l-amber-400',
  TOKEN_PAID: 'border-l-orange-400',
  CONVERTED: 'border-l-green-400',
  LOST: 'border-l-red-400',
};

const SOURCE_OPTIONS = ['WALK_IN', 'REFERRAL', 'SOCIAL_MEDIA', 'WEBSITE', 'BROKER', 'OTHER'];

// ── Helpers ───────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Main component ────────────────────────────────────────────────────

export default function LeadsPage() {
  const qc = useQueryClient();

  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [viewingLead, setViewingLead] = useState<Lead | null>(null);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [visitDate, setVisitDate] = useState('');
  const [statusNotes, setStatusNotes] = useState('');

  const [createForm, setCreateForm] = useState<Omit<CreateLeadDto, 'propertyId'>>({
    name: '',
    phone: '',
    email: '',
    source: 'WALK_IN',
    budget: undefined,
    moveInDate: '',
    roomType: '',
    notes: '',
  });
  const [createError, setCreateError] = useState('');

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

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads', activePropertyId],
    queryFn: () => getLeads(activePropertyId),
    enabled: !!activePropertyId,
  });

  const createMutation = useMutation({
    mutationFn: (dto: CreateLeadDto) => createLead(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      setShowCreate(false);
      setCreateForm({ name: '', phone: '', email: '', source: 'WALK_IN', budget: undefined, moveInDate: '', roomType: '', notes: '' });
      setCreateError('');
      toast.success('Lead added to pipeline');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setCreateError(msg ?? 'Failed to create lead.');
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes?: string }) =>
      updateLeadStatus(id, status, notes),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      setViewingLead(updated);
      setStatusNotes('');
      toast.success('Lead status updated');
    },
    onError: () => toast.error('Failed to update status'),
  });

  const visitMutation = useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) => scheduleVisit(id, date),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      setViewingLead(updated);
      setShowVisitModal(false);
      setVisitDate('');
      toast.success('Visit scheduled');
    },
    onError: () => toast.error('Failed to schedule visit'),
  });

  const leadsInStatus = (status: LeadStatus) =>
    leads.filter((l) => l.status === status);

  const handleStatusAction = (lead: Lead, status: string) => {
    statusMutation.mutate({ id: lead.id, status, notes: statusNotes || undefined });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Lead Pipeline"
        subtitle={`${leads.length} total leads`}
        actions={
          activePropertyId ? (
            <button
              onClick={() => setShowCreate(true)}
              className="btn-primary text-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Lead
            </button>
          ) : undefined
        }
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

      {/* Kanban board */}
      {properties.length === 0 && !isLoading ? (
        <div className="card">
          <EmptyState icon={Building2} title="No properties" description="Add a property first." />
        </div>
      ) : isLoading ? (
        <div className="card p-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {PIPELINE_COLUMNS.map((col) => {
              const colLeads = leadsInStatus(col.status);
              return (
                <div
                  key={col.status}
                  className="w-64 flex flex-col rounded-xl border border-gray-200 bg-gray-50 overflow-hidden"
                >
                  {/* Column header */}
                  <div
                    className={cn(
                      'px-3 py-2.5 flex items-center justify-between border-b',
                      col.headerCls,
                    )}
                  >
                    <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                      {col.label}
                    </span>
                    <span
                      className={cn(
                        'text-xs font-bold rounded-full px-2 py-0.5 min-w-[22px] text-center',
                        col.badgeCls,
                      )}
                    >
                      {colLeads.length}
                    </span>
                  </div>

                  {/* Lead cards */}
                  <div className="flex-1 p-2 space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
                    {colLeads.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-6">No leads</p>
                    ) : (
                      colLeads.map((lead) => (
                        <LeadCard
                          key={lead.id}
                          lead={lead}
                          borderCls={STATUS_CARD_BORDER[col.status]}
                          onClick={() => { setViewingLead(lead); setStatusNotes(''); }}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create lead modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => { setShowCreate(false); setCreateError(''); }}
        title="Add New Lead"
        size="md"
      >
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Name" required className="col-span-2">
              <Input
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Prospect's full name"
              />
            </FormField>
            <FormField label="Phone" required>
              <Input
                value={createForm.phone}
                onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="10-digit mobile"
                type="tel"
              />
            </FormField>
            <FormField label="Email">
              <Input
                value={createForm.email ?? ''}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="email@example.com"
                type="email"
              />
            </FormField>
            <FormField label="Source">
              <select
                value={createForm.source ?? 'WALK_IN'}
                onChange={(e) => setCreateForm((f) => ({ ...f, source: e.target.value }))}
                className="input-field bg-white text-sm"
              >
                {SOURCE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Budget (₹)">
              <Input
                type="number"
                value={createForm.budget ?? ''}
                onChange={(e) =>
                  setCreateForm((f) => ({
                    ...f,
                    budget: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
                placeholder="Monthly budget"
              />
            </FormField>
            <FormField label="Preferred Move-in">
              <Input
                type="date"
                value={createForm.moveInDate ?? ''}
                onChange={(e) => setCreateForm((f) => ({ ...f, moveInDate: e.target.value }))}
              />
            </FormField>
            <FormField label="Room Type Preference">
              <Input
                value={createForm.roomType ?? ''}
                onChange={(e) => setCreateForm((f) => ({ ...f, roomType: e.target.value }))}
                placeholder="e.g. Single AC"
              />
            </FormField>
            <FormField label="Notes" className="col-span-2">
              <Textarea
                value={createForm.notes ?? ''}
                onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Any additional notes..."
                rows={3}
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
            <button
              onClick={() => { setShowCreate(false); setCreateError(''); }}
              className="btn-secondary flex-1 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={() =>
                createMutation.mutate({ ...createForm, propertyId: activePropertyId })
              }
              disabled={createMutation.isPending || !createForm.name || !createForm.phone}
              className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Add Lead
            </button>
          </div>
        </div>
      </Modal>

      {/* Lead detail panel */}
      {viewingLead && (
        <LeadDetailModal
          lead={viewingLead}
          statusNotes={statusNotes}
          onNotesChange={setStatusNotes}
          onStatusAction={handleStatusAction}
          onScheduleVisit={() => setShowVisitModal(true)}
          isPending={statusMutation.isPending}
          onClose={() => setViewingLead(null)}
        />
      )}

      {/* Schedule visit modal */}
      <Modal
        isOpen={showVisitModal}
        onClose={() => { setShowVisitModal(false); setVisitDate(''); }}
        title="Schedule Visit"
        size="sm"
      >
        <div className="p-6 space-y-4">
          <FormField label="Visit Date & Time" required>
            <Input
              type="datetime-local"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
            />
          </FormField>
          <div className="flex gap-3">
            <button
              onClick={() => { setShowVisitModal(false); setVisitDate(''); }}
              className="btn-secondary flex-1 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={() =>
                viewingLead && visitMutation.mutate({ id: viewingLead.id, date: visitDate })
              }
              disabled={visitMutation.isPending || !visitDate}
              className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {visitMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirm
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Lead card component ───────────────────────────────────────────────

function LeadCard({
  lead,
  borderCls,
  onClick,
}: {
  lead: Lead;
  borderCls: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left bg-white rounded-lg p-3 shadow-sm border border-gray-200 border-l-4',
        'hover:shadow-md hover:-translate-y-0.5 transition-all duration-150',
        borderCls,
      )}
    >
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <p className="text-sm font-semibold text-gray-900 leading-snug truncate">{lead.name}</p>
        <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">{timeAgo(lead.createdAt)}</span>
      </div>

      <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
        <Phone className="w-3 h-3 shrink-0" />
        <span>{lead.phone}</span>
      </div>

      <div className="flex flex-wrap gap-1">
        {lead.budget && (
          <span className="inline-flex items-center gap-0.5 text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
            <IndianRupee className="w-2.5 h-2.5" />
            {lead.budget.toLocaleString('en-IN')}
          </span>
        )}
        {lead.roomType && (
          <span className="inline-flex items-center gap-0.5 text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
            <BedDouble className="w-2.5 h-2.5" />
            {lead.roomType}
          </span>
        )}
        <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">
          {lead.source.replace('_', ' ')}
        </span>
      </div>
    </button>
  );
}

// ── Lead detail modal ─────────────────────────────────────────────────

function LeadDetailModal({
  lead,
  statusNotes,
  onNotesChange,
  onStatusAction,
  onScheduleVisit,
  isPending,
  onClose,
}: {
  lead: Lead;
  statusNotes: string;
  onNotesChange: (v: string) => void;
  onStatusAction: (lead: Lead, status: string) => void;
  onScheduleVisit: () => void;
  isPending: boolean;
  onClose: () => void;
}) {
  const col = PIPELINE_COLUMNS.find((c) => c.status === lead.status);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full sm:w-[400px] bg-white sm:rounded-xl shadow-2xl max-h-screen sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">{lead.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={cn(
                  'text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full',
                  col?.badgeCls ?? 'bg-gray-100 text-gray-600',
                )}
              >
                {col?.label ?? lead.status}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info grid */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <InfoItem icon={Phone} label="Phone" value={lead.phone} />
            {lead.email && <InfoItem icon={AlertCircle} label="Email" value={lead.email} />}
            {lead.budget && (
              <InfoItem
                icon={IndianRupee}
                label="Budget"
                value={`₹${lead.budget.toLocaleString('en-IN')}/mo`}
              />
            )}
            {lead.roomType && <InfoItem icon={BedDouble} label="Room Pref" value={lead.roomType} />}
            {lead.moveInDate && (
              <InfoItem icon={Calendar} label="Move-in" value={formatDate(lead.moveInDate)} />
            )}
            {lead.visitDate && (
              <InfoItem icon={CalendarClock} label="Visit" value={formatDate(lead.visitDate)} />
            )}
            <InfoItem icon={Clock} label="Added" value={timeAgo(lead.createdAt)} />
            <InfoItem icon={AlertCircle} label="Source" value={lead.source.replace('_', ' ')} />
          </div>

          {lead.notes && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
              <p className="text-sm text-gray-700 leading-relaxed">{lead.notes}</p>
            </div>
          )}

          {lead.tokenAmount && (
            <div className="bg-orange-50 rounded-lg p-3">
              <p className="text-xs font-medium text-orange-600 mb-1">Token Amount Paid</p>
              <p className="text-lg font-bold text-orange-700">
                ₹{lead.tokenAmount.toLocaleString('en-IN')}
              </p>
            </div>
          )}

          {/* Notes input for status updates */}
          {lead.status !== 'CONVERTED' && lead.status !== 'LOST' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Add note (optional)
              </label>
              <textarea
                value={statusNotes}
                onChange={(e) => onNotesChange(e.target.value)}
                rows={2}
                className="input-field resize-none text-sm w-full"
                placeholder="Context for this status change..."
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-2 pt-1">
            {lead.status === 'NEW' && (
              <ActionButton
                label="Mark Contacted"
                icon={Phone}
                cls="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => onStatusAction(lead, 'CONTACTED')}
                isPending={isPending}
              />
            )}
            {(lead.status === 'CONTACTED' || lead.status === 'VISITED') && (
              <ActionButton
                label="Schedule Visit"
                icon={CalendarClock}
                cls="bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={onScheduleVisit}
                isPending={false}
              />
            )}
            {lead.status === 'VISIT_SCHEDULED' && (
              <ActionButton
                label="Mark Visited"
                icon={CheckCircle2}
                cls="bg-purple-600 hover:bg-purple-700 text-white"
                onClick={() => onStatusAction(lead, 'VISITED')}
                isPending={isPending}
              />
            )}
            {lead.status === 'VISITED' && (
              <ActionButton
                label="Start Negotiation"
                icon={IndianRupee}
                cls="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => onStatusAction(lead, 'NEGOTIATING')}
                isPending={isPending}
              />
            )}
            {lead.status === 'NEGOTIATING' && (
              <ActionButton
                label="Token Paid"
                icon={CheckCircle2}
                cls="bg-orange-600 hover:bg-orange-700 text-white"
                onClick={() => onStatusAction(lead, 'TOKEN_PAID')}
                isPending={isPending}
              />
            )}
            {(lead.status === 'TOKEN_PAID' || lead.status === 'NEGOTIATING') && (
              <ActionButton
                label="Convert to Tenant"
                icon={CheckCircle2}
                cls="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => onStatusAction(lead, 'CONVERTED')}
                isPending={isPending}
              />
            )}
            {lead.status !== 'CONVERTED' && lead.status !== 'LOST' && (
              <ActionButton
                label="Mark as Lost"
                icon={XCircle}
                cls="bg-white border border-red-300 text-red-600 hover:bg-red-50"
                onClick={() => onStatusAction(lead, 'LOST')}
                isPending={isPending}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[10px] text-gray-400 uppercase font-medium flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {label}
      </p>
      <p className="text-sm text-gray-800 mt-0.5 font-medium">{value}</p>
    </div>
  );
}

function ActionButton({
  label,
  icon: Icon,
  cls,
  onClick,
  isPending,
}: {
  label: string;
  icon: React.ElementType;
  cls: string;
  onClick: () => void;
  isPending: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={isPending}
      className={cn(
        'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50',
        cls,
      )}
    >
      {isPending ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Icon className="w-4 h-4" />
      )}
      {label}
    </button>
  );
}
