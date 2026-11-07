export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: opts.body ? { 'content-type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
  });
  if (res.status === 401 && !location.pathname.endsWith('login.html')) {
    location.href = '/login.html';
    throw new Error('unauthorized');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || 'حصل خطأ');
  return data as T;
}

export type ProfileId = 'waleed' | 'doaa';
export const NAMES: Record<ProfileId, string> = { waleed: 'وليد', doaa: 'دعاء' };
export const SLOT_AR: Record<string, string> = { breakfast: 'الفطار', lunch: 'الغدا', dinner: 'العشا' };
export const SLOT_IC: Record<string, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙' };

export const fmtDate = (d: string, o: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }) =>
  new Intl.DateTimeFormat('ar-EG', { ...o, timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'));

export const todayKW = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuwait', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export function addDays(date: string, n: number) {
  const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
