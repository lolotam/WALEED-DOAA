import cron, { type ScheduledTask } from 'node-cron';
import { TZ, todayKW, addDays } from './time.js';
import { generatePlan } from './planner.js';
import { sendTomorrowCards, sendIngredients, sendWeighReminder, sendWeeklyReport, sendWaterReminder, catchUpCards } from './bot.js';
import { logNotify, getSetting, setSetting } from './db.js';

export type JobKey = 'cards' | 'breakfast' | 'lunch' | 'dinner' | 'weigh' | 'report' | 'water';
export interface JobConfig { enabled: boolean; times: string[]; days: number[] } // days: 0=الأحد … 6=السبت، فاضي = كل يوم

export const SCHEDULE_META: { key: JobKey; label: string; hint: string; weekly?: boolean; multi?: boolean }[] = [
  { key: 'cards', label: 'كروت أكل بكرة', hint: 'الاختيارات التلاتة لكل وجبة + مشروب الصبح' },
  { key: 'breakfast', label: 'مكونات الفطار', hint: 'المكونات بالجرام لكل واحد' },
  { key: 'lunch', label: 'مكونات الغدا', hint: 'المكونات بالجرام لكل واحد' },
  { key: 'dinner', label: 'مكونات العشا', hint: 'المكونات بالجرام لكل واحد' },
  { key: 'weigh', label: 'تذكير الوزن', hint: 'تذكير أسبوعي', weekly: true },
  { key: 'report', label: 'تقرير الأسبوع', hint: 'الوزن والمية والنوم والسعرات الجديدة', weekly: true },
  { key: 'water', label: 'تذكير المية', hint: 'كذا ميعاد في اليوم', multi: true },
];

export const DEFAULT_SCHEDULE: Record<JobKey, JobConfig> = {
  cards: { enabled: true, times: ['21:00'], days: [] },
  breakfast: { enabled: true, times: ['05:00'], days: [] },
  lunch: { enabled: true, times: ['12:00'], days: [] },
  dinner: { enabled: true, times: ['17:00'], days: [] },
  weigh: { enabled: true, times: ['21:00'], days: [5] },
  report: { enabled: true, times: ['12:00'], days: [6] },
  water: { enabled: false, times: ['10:00', '12:00', '14:00', '16:00', '18:00', '20:00'], days: [] },
};

const RUN: Record<JobKey, () => Promise<unknown>> = {
  cards: () => sendTomorrowCards(),
  breakfast: () => sendIngredients('breakfast'),
  lunch: () => sendIngredients('lunch'),
  dinner: () => sendIngredients('dinner'),
  weigh: () => sendWeighReminder(),
  report: () => sendWeeklyReport(),
  water: () => sendWaterReminder(),
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function getSchedule(): Record<JobKey, JobConfig> {
  let saved: Partial<Record<JobKey, JobConfig>> = {};
  try { saved = JSON.parse(getSetting('schedule') || '{}'); } catch { /* ignore */ }
  const out = {} as Record<JobKey, JobConfig>;
  for (const k of Object.keys(DEFAULT_SCHEDULE) as JobKey[]) out[k] = { ...DEFAULT_SCHEDULE[k], ...(saved[k] || {}) };
  return out;
}

export function saveSchedule(input: Partial<Record<JobKey, Partial<JobConfig>>>) {
  const cur = getSchedule();
  for (const k of Object.keys(input) as JobKey[]) {
    if (!(k in cur)) continue;
    const v = input[k]!;
    const times = (v.times ?? cur[k].times).filter((t) => TIME_RE.test(t));
    if (!times.length) throw new Error(`ميعاد غلط في "${SCHEDULE_META.find((m) => m.key === k)!.label}"`);
    const days = (v.days ?? cur[k].days).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    cur[k] = { enabled: v.enabled ?? cur[k].enabled, times: [...new Set(times)].sort(), days };
  }
  setSetting('schedule', JSON.stringify(cur));
  applySchedule();
  return cur;
}

let tasks: ScheduledTask[] = [];

function job(name: string, expr: string, fn: () => Promise<unknown>) {
  tasks.push(cron.schedule(expr, async () => {
    try { await fn(); console.log(`[cron] ${name} done`); }
    catch (e) { console.error(`[cron] ${name} failed`, e); logNotify(`cron:${name}`, false, (e as Error).message); }
  }, { timezone: TZ }));
}

/** يوقف كل المواعيد ويشغّلها من جديد حسب الإعدادات */
export function applySchedule() {
  for (const t of tasks) t.stop();
  tasks = [];
  const s = getSchedule();
  for (const k of Object.keys(s) as JobKey[]) {
    const c = s[k];
    if (!c.enabled) continue;
    const dow = c.days.length ? c.days.join(',') : '*';
    for (const t of c.times) {
      const [h, m] = t.split(':').map(Number);
      job(`${k}@${t}`, `${m} ${h} * * ${dow}`, RUN[k]);
    }
  }
  // توليد خطة بكرة قبل ميعاد الكروت بنص ساعة
  const [ch, cm] = s.cards.times[0].split(':').map(Number);
  const gen = (ch * 60 + cm - 30 + 1440) % 1440;
  job('generate-tomorrow', `${gen % 60} ${Math.floor(gen / 60)} * * *`, () => generatePlan(addDays(todayKW(), 1)));
  console.log(`[cron] ${tasks.length} jobs scheduled (${TZ})`);
}

export function startScheduler() {
  applySchedule();
  // لو السيرفر اتعمله restart بعد ميعاد الكروت، يبعت كروت بكرة اللي فاتت
  setTimeout(() => catchUpCards().catch((e) => console.error('[cron] catch-up failed', e)), 15000);
}
