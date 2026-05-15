const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function formatMonth(month: number, year: number): string {
  return `${MONTHS[month - 1]} ${year}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
