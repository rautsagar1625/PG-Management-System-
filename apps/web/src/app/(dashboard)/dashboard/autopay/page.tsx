'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, ChevronDown, Plus, CreditCard, X, Loader2, ExternalLink } from 'lucide-react';
import { getProperties, type Property } from '@/lib/properties-api';
import { getTenants, type Tenant } from '@/lib/tenants-api';
import {
  getMandates,
  createMandate,
  cancelMandate,
  type AutopayMandate,
  type CreateMandateDto,
} from '@/lib/autopay-api';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { toast } from 'sonner';

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  ACTIVE:    { bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500' },
  PENDING:   { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  CREATED:   { bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-500' },
  PAUSED:    { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  CANCELLED: { bg: 'bg-red-50',    text: 'text-red-600',    dot: 'bg-red-500' },
  EXPIRED:   { bg: 'bg-gray-50',   text: 'text-gray-600',   dot: 'bg-gray-400' },
  FAILED:    { bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-600' },
};

export default function AutopayPage() {
  const qc = useQueryClient();
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [propOpen, setPropOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [mandateLink, setMandateLink] = useState<string | undefined>();
  const [form, setForm] = useState<CreateMandateDto & { tenantName?: string }>({
    tenantId: '', propertyId: '', amount: 0, bankAccount: '', ifscCode: '', accountName: '', debitDay: 1,
  });

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ['properties'],
    queryFn: () => getProperties(),
  });

  const { data: tenantsResult } = useQuery({
    queryKey: ['tenants', selectedPropertyId],
    queryFn: () => getTenants({ propertyId: selectedPropertyId, page: 1, limit: 500, status: 'ACTIVE' }),
    enabled: !!selectedPropertyId,
  });
  const tenants = tenantsResult?.tenants ?? [];

  const { data: mandates = [], isLoading } = useQuery({
    queryKey: ['mandates', selectedPropertyId],
    queryFn: () => getMandates(selectedPropertyId),
    enabled: !!selectedPropertyId,
  });

  const createMutation = useMutation({
    mutationFn: (dto: CreateMandateDto) => createMandate(dto),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['mandates', selectedPropertyId] });
      if (result.mandateLink) setMandateLink(result.mandateLink);
      else { setShowModal(false); toast.success('Mandate created'); }
    },
    onError: () => toast.error('Failed to create mandate'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelMandate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mandates', selectedPropertyId] }); toast.success('Mandate cancelled'); },
    onError: () => toast.error('Failed to cancel mandate'),
  });

  const selectedProp = properties.find((p: Property) => p.id === selectedPropertyId);

  const handleCreate = () => {
    createMutation.mutate({ ...form, propertyId: selectedPropertyId });
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900">Autopay Mandates</h1>
              <p className="text-sm text-gray-500">e-NACH mandate management via Razorpay</p>
            </div>
          </div>
          {selectedPropertyId && (
            <button
              onClick={() => { setForm((f) => ({ ...f, propertyId: selectedPropertyId })); setShowModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> Initiate Mandate
            </button>
          )}
        </div>

        {/* Property selector */}
        <div className="relative w-64">
          <button
            onClick={() => setPropOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-indigo-400 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="truncate">{selectedProp?.name ?? 'Select property'}</span>
            </div>
            <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', propOpen && 'rotate-180')} />
          </button>
          {propOpen && (
            <div className="absolute z-10 mt-1 w-full bg-white rounded-xl shadow-lg border border-gray-100 py-1 max-h-48 overflow-auto">
              {properties.map((p: Property) => (
                <button key={p.id} onClick={() => { setSelectedPropertyId(p.id); setPropOpen(false); }}
                  className={cn('w-full px-4 py-2 text-sm text-left hover:bg-indigo-50 transition-colors', p.id === selectedPropertyId && 'font-semibold text-indigo-600')}>
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {!selectedPropertyId ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
            <CreditCard className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Select a property to view mandates</p>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
        ) : mandates.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
            <CreditCard className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-700 font-semibold mb-1">No mandates yet</p>
            <p className="text-sm text-gray-400">Initiate an e-NACH mandate for a tenant to enable autopay.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Tenant</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Amount</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Debit Day</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Bank</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Created</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {mandates.map((m: AutopayMandate) => {
                  const ss = STATUS_STYLES[m.status] ?? STATUS_STYLES.CREATED!;
                  return (
                    <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-semibold text-gray-900">{m.tenant.user.name}</p>
                        <p className="text-xs text-gray-400">{m.tenant.user.phone}</p>
                      </td>
                      <td className="px-5 py-3 font-bold text-gray-900">{formatCurrency(m.amount)}</td>
                      <td className="px-5 py-3 text-gray-600">{m.debitDay}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{m.bankAccount ?? '—'}</td>
                      <td className="px-5 py-3">
                        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', ss.bg, ss.text)}>
                          <span className={cn('w-1.5 h-1.5 rounded-full', ss.dot)} />
                          {m.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-400 text-xs">{formatDate(m.createdAt)}</td>
                      <td className="px-5 py-3">
                        {(m.status === 'ACTIVE' || m.status === 'PENDING' || m.status === 'CREATED') && (
                          <button
                            onClick={() => cancelMutation.mutate(m.id)}
                            disabled={cancelMutation.isPending}
                            className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Mandate Modal */}
      {showModal && !mandateLink && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Initiate Autopay Mandate</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Tenant</label>
                <select
                  value={form.tenantId}
                  onChange={(e) => setForm((f) => ({ ...f, tenantId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="">Select tenant…</option>
                  {tenants.map((t: Tenant) => (
                    <option key={t.id} value={t.id}>{t.user.name}</option>
                  ))}
                </select>
              </div>
              {[
                { label: 'Monthly Amount (₹)', field: 'amount', type: 'number' },
                { label: 'Bank Account (masked)', field: 'bankAccount', type: 'text' },
                { label: 'IFSC Code', field: 'ifscCode', type: 'text' },
                { label: 'Account Name', field: 'accountName', type: 'text' },
              ].map(({ label, field, type }) => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</label>
                  <input
                    type={type}
                    value={String(form[field as keyof CreateMandateDto] ?? '')}
                    onChange={(e) => setForm((f) => ({ ...f, [field]: type === 'number' ? Number(e.target.value) : e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Debit Day (1–28)</label>
                <input
                  type="number" min={1} max={28}
                  value={form.debitDay ?? 1}
                  onChange={(e) => setForm((f) => ({ ...f, debitDay: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleCreate}
                disabled={!form.tenantId || !form.amount || createMutation.isPending}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Initiate Mandate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mandate link modal */}
      {mandateLink && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Mandate Created</h2>
            <p className="text-sm text-gray-500 mb-4">Share this link with the tenant to complete the e-NACH registration.</p>
            <a href={mandateLink} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 mb-3">
              <ExternalLink className="w-4 h-4" /> Open Mandate Link
            </a>
            <button onClick={() => { setMandateLink(undefined); setShowModal(false); }}
              className="w-full px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
