'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Printer, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { getReceipt } from '@/lib/payments-api';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useRouter } from 'next/navigation';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  BANK_TRANSFER: 'Bank Transfer',
  CHEQUE: 'Cheque',
  CARD: 'Card',
  ONLINE: 'Online',
};

const TYPE_LABELS: Record<string, string> = {
  RENT: 'Rent Payment',
  DEPOSIT: 'Security Deposit',
  DEPOSIT_REFUND: 'Deposit Refund',
  DEPOSIT_ADJUSTMENT: 'Deposit Adjustment',
  FINE: 'Fine',
  MISCELLANEOUS: 'Miscellaneous',
};

export default function ReceiptPage() {
  const { receiptNo } = useParams<{ receiptNo: string }>();
  const router = useRouter();

  const { data: receipt, isLoading, error } = useQuery({
    queryKey: ['receipt', receiptNo],
    queryFn: () => getReceipt(receiptNo),
  });

  if (isLoading) return <PageLoader />;

  if (error || !receipt) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-700">Receipt not found</p>
          <p className="text-sm text-gray-500 mt-1">{receiptNo}</p>
          <button onClick={() => router.back()} className="btn-secondary text-sm mt-4">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Action bar — hidden on print */}
      <div className="flex items-center gap-3 print:hidden">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex-1" />
        <button
          onClick={() => window.print()}
          className="btn-primary text-sm flex items-center gap-2"
        >
          <Printer className="w-4 h-4" />
          Print Receipt
        </button>
      </div>

      {/* Receipt — the printable document */}
      <div
        id="receipt"
        className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden print:shadow-none print:border-none print:rounded-none"
      >
        {/* Header */}
        <div className="bg-primary-600 px-8 py-6 text-white">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{receipt.propertyName}</h1>
              <p className="text-primary-200 text-sm mt-0.5">{receipt.propertyAddress}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-primary-200 uppercase tracking-wide">Receipt</p>
              <p className="text-lg font-mono font-bold mt-0.5">{receipt.receiptNo}</p>
            </div>
          </div>
        </div>

        {/* Status band */}
        <div className="bg-green-50 border-b border-green-100 px-8 py-3 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <span className="text-sm font-semibold text-green-800">Payment Received</span>
          <span className="text-sm text-green-600 ml-auto">{formatDate(receipt.paidAt)}</span>
        </div>

        {/* Body */}
        <div className="px-8 py-6 space-y-6">
          {/* Amount */}
          <div className="text-center py-4 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Amount Collected</p>
            <p className="text-4xl font-bold text-gray-900 mt-1">{formatCurrency(receipt.amount)}</p>
            <p className="text-sm text-gray-500 mt-1">{TYPE_LABELS[receipt.type] ?? receipt.type}</p>
          </div>

          {/* Tenant details */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            <ReceiptField label="Tenant Name" value={receipt.tenantName} />
            <ReceiptField label="Tenant Code" value={receipt.tenantCode} mono />
            {receipt.tenantPhone && (
              <ReceiptField label="Phone" value={receipt.tenantPhone} />
            )}
            {receipt.roomNumber && (
              <ReceiptField
                label="Room / Bed"
                value={`Room ${receipt.roomNumber}${receipt.bedLabel ? ` — Bed ${receipt.bedLabel}` : ''}`}
              />
            )}
            {receipt.rentPeriod && (
              <ReceiptField
                label="Rent Period"
                value={`${MONTHS[receipt.rentPeriod.month - 1]} ${receipt.rentPeriod.year}`}
              />
            )}
          </div>

          <div className="border-t border-gray-100 pt-4 grid grid-cols-2 gap-x-8 gap-y-4">
            <ReceiptField label="Payment Method" value={METHOD_LABELS[receipt.method] ?? receipt.method} />
            {receipt.referenceNo && (
              <ReceiptField label="Reference No." value={receipt.referenceNo} mono />
            )}
            <ReceiptField label="Recorded By" value={receipt.recordedBy} />
            <ReceiptField label="Issued At" value={formatDate(receipt.issuedAt)} />
          </div>

          {receipt.notes && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Notes</p>
              <p className="text-sm text-gray-700">{receipt.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-100 px-8 py-4 text-center">
          <p className="text-xs text-gray-400">
            This is a computer-generated receipt. No signature required.
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            For disputes, contact your property manager.
          </p>
        </div>
      </div>
    </div>
  );
}

function ReceiptField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-sm text-gray-900 mt-0.5 font-medium ${mono ? 'font-mono' : ''}`}>
        {value}
      </p>
    </div>
  );
}
