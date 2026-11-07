import cron from 'node-cron';
import { TZ, todayKW, addDays } from './time.js';
import { generatePlan } from './planner.js';
import { sendTomorrowCards, sendIngredients, sendWeighReminder, sendWeeklyReport } from './bot.js';

const job = (name: string, expr: string, fn: () => Promise<unknown>) =>
  cron.schedule(expr, async () => {
    try { await fn(); console.log(`[cron] ${name} done`); }
    catch (e) { console.error(`[cron] ${name} failed`, e); }
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
}
