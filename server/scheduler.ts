import cron from 'node-cron';
import { TZ, todayKW, addDays } from './time.js';
import { generatePlan } from './planner.js';
import { sendTomorrowCards, sendIngredients, sendWeighReminder, sendWeeklyReport, catchUpCards } from './bot.js';
import { logNotify } from './db.js';

const job = (name: string, expr: string, fn: () => Promise<unknown>) =>
  cron.schedule(expr, async () => {
    try { await fn(); console.log(`[cron] ${name} done`); }
    catch (e) { console.error(`[cron] ${name} failed`, e); logNotify(`cron:${name}`, false, (e as Error).message); }
  }, { timezone: TZ });

export function startScheduler() {
  job('generate-tomorrow', '30 20 * * *', () => generatePlan(addDays(todayKW(), 1)));
  job('cards-9pm', '0 21 * * *', sendTomorrowCards);
  job('breakfast-5am', '0 5 * * *', () => sendIngredients('breakfast'));
  job('lunch-12pm', '0 12 * * *', () => sendIngredients('lunch'));
  job('dinner-5pm', '0 17 * * *', () => sendIngredients('dinner'));
  job('weigh-friday', '0 21 * * 5', sendWeighReminder);
  job('report-saturday', '0 12 * * 6', sendWeeklyReport);
  console.log(`[cron] scheduled (${TZ})`);
  // لو السيرفر اتعمله restart بعد 9 بالليل، يبعت كروت بكرة اللي فاتت
  setTimeout(() => catchUpCards().catch((e) => console.error('[cron] catch-up failed', e)), 15000);
}

export const SCHEDULE = [
  { key: 'cards', label: 'كروت أكل بكرة', time: '9:00 م', days: 'كل يوم' },
  { key: 'breakfast', label: 'مكونات الفطار', time: '5:00 ص', days: 'كل يوم' },
  { key: 'lunch', label: 'مكونات الغدا', time: '12:00 ظ', days: 'كل يوم' },
  { key: 'dinner', label: 'مكونات العشا', time: '5:00 م', days: 'كل يوم' },
  { key: 'weigh', label: 'تذكير الوزن', time: '9:00 م', days: 'الجمعة' },
  { key: 'report', label: 'تقرير الأسبوع', time: '12:00 ظ', days: 'السبت' },
];
