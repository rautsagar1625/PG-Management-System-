'use client';

import { useState } from 'react';
import { CheckCircle2, IndianRupee } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { FormField, Input } from '@/components/ui/FormField';
import { recordPayment, type PaymentType, type PaymentMethod } from '@/lib/payments-api';
import { formatCurrency } from '@/lib/utils';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'CARD', label: 'Card' },
  { value: 'ONLINE', label: 'Online' },
];

const PAYMENT_TYPES: { value: PaymentType; label: string }[] = [
  { value: 'RENT', label: 'Rent' },
  { value: 'DEPOSIT', label: 'Deposit' },
  { value: 'FINE', label: 'Fine' },
  { value: 'MISCELLANEOUS', label: 'Miscellaneous' },
];

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (receiptNo: string) => void;
  // Tenant context
  tenantId: string;
  tenantName: string;
  tenantCode: string;
  propertyName?: string;
  roomInfo?: string;
  // Rent cycle context (optional — omit for non-rent payments)
  rentCycleId?: string;
  rentPeriod?: { month: number; year: number };
  rentAmount?: number;
  remainingAmount?: number;
  // Defaults
  defaultType?: PaymentType;
}

export function PaymentModal({
  isOpen,
  onClose,
  onSuccess,
  tenantId,
  tenantName,
  tenantCode,
  propertyName,
  roomInfo,
  rentCycleId,
  rentPeriod,
  rentAmount,
  remainingAmount,
  defaultType = 'RENT',
}: PaymentModalProps) {
  const [amount, setAmount] = useState(remainingAmount?.toString() ?? '');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [type, setType] = useState<PaymentType>(defaultType);
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [paidAt, setPaidAt] = useState(new Date().toISOString().split('T')[0]!);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successReceipt, setSuccessReceipt] = useState<string | null>(null);

  const numAmount = Number(amount);
  const isOverpayment = remainingAmount !== undefined && numAmount > remainingAmount;

  const reset = () => {
    setAmount(remainingAmount?.toString() ?? '');
    setMethod('CASH');
    setType(defaultType);
    setReferenceNo('');
    setNotes('');
    setPaidAt(new Date().toISOString().split('T')[0]!);
    setError('');
    setSuccessReceipt(null);
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (!amount || numAmount <= 0) {
      setError('Amount must be greater than zero');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await recordPayment({
        tenantId,
        rentCycleId: type === 'RENT' ? rentCycleId : undefined,
        amount: numAmount,
        type,
        method,
        referenceNo: referenceNo.trim() || undefined,
        notes: notes.trim() || undefined,
        paidAt,
      });
      setSuccessReceipt(result.receiptNo);
      onSuccess(result.receiptNo);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Payment failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (successReceipt) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} size="sm">
        <div className="p-6 text-center space-y-4">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7 text-green-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Payment Recorded</h3>
            <p className="text-sm text-gray-500 mt-1">
              {formatCurrency(numAmount)} collected from {tenantName}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Receipt Number</p>
            <p className="text-sm font-mono font-semibold text-gray-900 mt-0.5">{successReceipt}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleClose} className="btn-secondary text-sm flex-1">
              Done
            </button>
            <a
              href={`/dashboard/receipts/${successReceipt}`}
              target="_blank"
              rel="noreferrer"
              className="btn-primary text-sm flex-1 text-center"
              onClick={handleClose}
            >
              View Receipt
            </a>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Collect Payment" size="sm">
      <div className="p-5 space-y-4">
        {/* Tenant + cycle context */}
        <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">{tenantName}</span>
            <span className="text-xs font-mono text-gray-500">{tenantCode}</span>
          </div>
          {(propertyName || roomInfo) && (
            <p className="text-xs text-gray-500">
              {propertyName}{roomInfo ? ` · ${roomInfo}` : ''}
            </p>
          )}
          {rentPeriod && (
            <p className="text-xs text-gray-500">
              {MONTHS[rentPeriod.month - 1]} {rentPeriod.year}
              {rentAmount !== undefined && ` · Rent: ${formatCurrency(rentAmount)}`}
            </p>
          )}
        </div>

        {/* Balance due */}
        {remainingAmount !== undefined && remainingAmount > 0 && (
          <div className="flex items-center justify-between bg-red-50 rounded-lg px-3 py-2.5">
            <span className="text-sm text-red-700 font-medium">Balance Due</span>
            <span className="text-base font-bold text-red-700">{formatCurrency(remainingAmount)}</span>
          </div>
        )}
        {remainingAmount === 0 && (
          <div className="bg-green-50 rounded-lg px-3 py-2 text-sm text-green-700 font-medium text-center">
            Rent fully paid for this cycle
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
        )}

        {/* Payment type — only show selector for non-rent-specific modals */}
        {!rentCycleId && (
          <FormField label="Payment Type">
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_TYPES.map((pt) => (
                <button
                  key={pt.value}
                  onClick={() => setType(pt.value)}
                  className={`px-3 py-2 text-sm rounded-lg border font-medium transition-colors ${
                    type === pt.value
                      ? 'bg-primary-50 border-primary-400 text-primary-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {pt.label}
                </button>
              ))}
            </div>
          </FormField>
        )}

        {/* Amount */}
        <FormField label="Amount">
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`input-field pl-9 ${isOverpayment ? 'border-orange-400 focus:ring-orange-400' : ''}`}
              placeholder="0"
              min={0}
              step={1}
            />
          </div>
          {isOverpayment && (
            <p className="text-xs text-orange-600 mt-1">
              Amount exceeds remaining dues — this will be an overpayment.
            </p>
          )}
          {remainingAmount !== undefined && remainingAmount > 0 && (
            <div className="flex gap-2 mt-1.5">
              <button
                onClick={() => setAmount(remainingAmount.toString())}
                className="text-xs text-primary-600 hover:underline"
              >
                Full amount ({formatCurrency(remainingAmount)})
              </button>
              {remainingAmount > 500 && (
                <button
                  onClick={() => setAmount(Math.round(remainingAmount / 2).toString())}
                  className="text-xs text-gray-500 hover:underline"
                >
                  Half ({formatCurrency(Math.round(remainingAmount / 2))})
                </button>
              )}
            </div>
          )}
        </FormField>

        {/* Payment Method */}
        <FormField label="Payment Method">
          <div className="grid grid-cols-3 gap-1.5">
            {PAYMENT_METHODS.map((pm) => (
              <button
                key={pm.value}
                onClick={() => setMethod(pm.value)}
                className={`px-2 py-2 text-xs rounded-lg border font-medium transition-colors ${
                  method === pm.value
                    ? 'bg-primary-50 border-primary-400 text-primary-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {pm.label}
              </button>
            ))}
          </div>
        </FormField>

        {/* Reference — required for non-cash */}
        {method !== 'CASH' && (
          <FormField
            label="Transaction Reference"
            hint={method === 'UPI' ? 'UPI transaction ID' : method === 'CHEQUE' ? 'Cheque number' : 'UTR / reference number'}
          >
            <Input
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder="Enter reference number"
            />
          </FormField>
        )}

        {/* Payment date */}
        <FormField label="Payment Date">
          <Input
            type="date"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
          />
        </FormField>

        {/* Notes */}
        <FormField label="Notes (optional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input-field text-sm resize-none"
            rows={2}
            placeholder="Any remarks..."
          />
        </FormField>

        <div className="flex gap-2 pt-1">
          <button onClick={handleClose} className="btn-secondary text-sm flex-1">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading || !amount || numAmount <= 0}
            className="btn-primary text-sm flex-1 disabled:opacity-50"
          >
            {loading ? 'Processing...' : `Collect ${amount ? formatCurrency(numAmount) : ''}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
