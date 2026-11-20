/**
 * Format helpers adhering to admin-table-format skill:
 * - Table alignment + locale
 * - Vietnam date/time (en-GB date + en-US AM/PM)
 * - Dot grouping for numbers (vi-VN)
 * - VND currency format
 * - Null-safe: returns "—" on invalid/empty
 */

export function formatDateVN(input: Date | string | number | null | undefined): string {
  if (!input) return '—';
  const d = new Date(input);
  if (isNaN(d.getTime())) return '—';

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(d);
}

export function formatTimeVN(
  input: Date | string | number | null | undefined,
  withSeconds = false
): string {
  if (!input) return '—';
  const d = new Date(input);
  if (isNaN(d.getTime())) return '—';

  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: withSeconds ? '2-digit' : undefined,
    hour12: true,
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(d);
}

export function formatDateTimeVN(
  input: Date | string | number | null | undefined,
  withSeconds = false
): string {
  if (!input) return '—';
  const dateStr = formatDateVN(input);
  const timeStr = formatTimeVN(input, withSeconds);
  if (dateStr === '—' || timeStr === '—') return '—';
  return `${dateStr} ${timeStr}`;
}

export function formatNumberVN(
  value: number | string | null | undefined,
  decimals?: number
): string {
  if (value === null || value === undefined || value === '') return '—';
  const num = typeof value === 'string' ? Number(value) : value;
  if (isNaN(num)) return '—';

  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function formatCurrencyVN(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const num = typeof value === 'string' ? Number(value) : value;
  if (isNaN(num)) return '—';

  return `${formatNumberVN(num)} ₫`;
}
