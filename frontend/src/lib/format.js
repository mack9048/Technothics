/** Indian-style grouping: 1846200 -> "18,46,200" */
export function inr(n, decimals = 0) {
  const num = Number(n) || 0;
  const s = Math.abs(num).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (num < 0 ? '− ' : '') + s;
}

/** "₹18,46,200" (or "− ₹12,000") */
export function rs(n, decimals = 0) {
  const num = Number(n) || 0;
  return (num < 0 ? '− ' : '') + '₹' + inr(Math.abs(num), decimals);
}

export const pad2 = (n) => String(n).padStart(2, '0');

export function shortDate(ymd) {
  if (!ymd) return '';
  const d = new Date(ymd + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}
