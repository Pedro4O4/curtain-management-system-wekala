export type User = { id: string; username: string };

export type AuthResponse = { token: string; user: User };

export type MonthDay = {
  date: string;
  locked: boolean;
  saleTotal: number;
  adjustmentTotal: number;
  dayTotal: number;
  saleCount: number;
  adjustmentCount: number;
};

export type MonthResponse = {
  month: string;
  today: string;
  days: MonthDay[];
  total: number;
};

export type SaleItem = { item: string; price: number };

export type SaleReceipt = {
  number: number | null;
  items: SaleItem[];
  total: number;
  createdAt: string;
  legacy: boolean;
};

export type DayResponse = {
  date: string;
  locked: boolean;
  sales: SaleItem[];
  receipts: SaleReceipt[];
  createdReceipt?: SaleReceipt;
  adjustments: { amount: number; reason: string; direction: '+' | '-' }[];
  saleTotal: number;
  adjustmentTotal: number;
  dayTotal: number;
};

export type SalesListResponse = {
  sales: Array<SaleReceipt & { date: string }>;
  total: number;
  receiptCount: number;
};

export type DraftSaleRow = {
  id: string;
  item: string;
  price: string;
  confirmed: boolean;
};

export type DraftAdjustmentRow = {
  id: string;
  amount: string;
  reason: string;
  direction: '+' | '-';
  confirmed: boolean;
};

export const currency = new Intl.NumberFormat('ar-EG', {
  style: 'currency',
  currency: 'EGP',
  maximumFractionDigits: 0,
});

export function todayIsoDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

export function isValidIsoDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;

  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function monthKeyFromDate(date: string) {
  return date.slice(0, 7);
}

export function monthLabel(month: string) {
  const parsed = new Date(`${month}-01T00:00:00`);
  return new Intl.DateTimeFormat('ar-EG', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Cairo',
  }).format(parsed);
}

export function shiftMonth(month: string, delta: number) {
  const [yearPart, monthPart] = month.split('-');
  const shifted = new Date(Number(yearPart), Number(monthPart) - 1 + delta, 1);
  const year = shifted.getFullYear();
  const nextMonth = String(shifted.getMonth() + 1).padStart(2, '0');
  return `${year}-${nextMonth}`;
}

export function weekdayCount(month: string) {
  const [yearPart, monthPart] = month.split('-');
  const firstDay = new Date(Number(yearPart), Number(monthPart) - 1, 1);
  const daysInMonth = new Date(Number(yearPart), Number(monthPart), 0).getDate();
  const leadingEmpty = firstDay.getDay();
  const slots: Array<{ type: 'empty' } | { type: 'day'; day: number }> = [];

  for (let index = 0; index < leadingEmpty; index += 1) {
    slots.push({ type: 'empty' });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    slots.push({ type: 'day', day });
  }

  return slots;
}

/**
 * Decode a JWT payload without verification (client-side only).
 * Returns null if the token is malformed.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

/**
 * Check if a JWT token is expired based on the `exp` claim.
 * Returns true if expired or if the token cannot be decoded.
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return true;
  // Allow 30 seconds of clock skew
  return Date.now() >= (payload.exp - 30) * 1000;
}

export const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function apiRequest<T>(path: string, token?: string, init?: RequestInit) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    throw new Error(payload?.message ?? 'Request failed');
  }

  return payload as T;
}
