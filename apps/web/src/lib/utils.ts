import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getRentStatusColor(status: string): string {
  const map: Record<string, string> = {
    PAID: 'bg-green-100 text-green-700',
    PARTIAL: 'bg-yellow-100 text-yellow-700',
    PENDING: 'bg-blue-100 text-blue-700',
    OVERDUE: 'bg-red-100 text-red-700',
    WAIVED: 'bg-gray-100 text-gray-700',
  };
  return map[status] ?? 'bg-gray-100 text-gray-700';
}

export function getTenantStatusColor(status: string): string {
  const map: Record<string, string> = {
    LEAD: 'bg-purple-100 text-purple-700',
    VISIT_SCHEDULED: 'bg-blue-100 text-blue-700',
    VISITED: 'bg-indigo-100 text-indigo-700',
    ROOM_FINALIZED: 'bg-cyan-100 text-cyan-700',
    DEPOSIT_PENDING: 'bg-yellow-100 text-yellow-700',
    KYC_PENDING: 'bg-orange-100 text-orange-700',
    ACTIVE: 'bg-green-100 text-green-700',
    NOTICE_PERIOD: 'bg-red-100 text-red-700',
    MOVED_OUT: 'bg-gray-100 text-gray-700',
  };
  return map[status] ?? 'bg-gray-100 text-gray-700';
}
