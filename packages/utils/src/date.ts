import {
  addMonths,
  format,
  getDaysInMonth,
  isAfter,
  isBefore,
  isToday,
  startOfMonth,
  endOfMonth,
  differenceInDays,
  parseISO,
} from 'date-fns';

export function getRentDueDate(month: number, year: number, dueDayOfMonth: number = 1): Date {
  // Use day=1 to avoid JS Date overflow (e.g. Feb 31 → March 3)
  const maxDay = getDaysInMonth(new Date(year, month - 1, 1));
  const day = Math.min(dueDayOfMonth, maxDay);
  return new Date(year, month - 1, day);
}

export function getNextRentMonth(month: number, year: number): { month: number; year: number } {
  const date = addMonths(new Date(year, month - 1, 1), 1);
  return { month: date.getMonth() + 1, year: date.getFullYear() };
}

export function isRentOverdue(dueDate: Date, gracePeriodDays: number = 5): boolean {
  const graceCutoff = new Date(dueDate);
  graceCutoff.setDate(graceCutoff.getDate() + gracePeriodDays);
  return isAfter(new Date(), graceCutoff);
}

export function formatMonthYear(month: number, year: number): string {
  return format(new Date(year, month - 1, 1), 'MMMM yyyy');
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function getDaysInCurrentMonth(): number {
  return getDaysInMonth(new Date());
}

export function getProratedRent(
  monthlyRent: number,
  moveInDate: Date,
  month: number,
  year: number,
): number {
  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(new Date(year, month - 1, 1));
  const totalDays = getDaysInMonth(new Date(year, month - 1, 1));

  const effectiveStart = isBefore(moveInDate, monthStart) ? monthStart : moveInDate;
  const effectiveEnd = monthEnd;

  if (isAfter(effectiveStart, effectiveEnd)) return 0;

  const occupiedDays = differenceInDays(effectiveEnd, effectiveStart) + 1;
  return Math.round((monthlyRent / totalDays) * occupiedDays);
}

export function parseDate(dateString: string): Date {
  return parseISO(dateString);
}

export function formatDate(date: Date, pattern: string = 'dd MMM yyyy'): string {
  return format(date, pattern);
}
