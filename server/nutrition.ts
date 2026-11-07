import { sqlite } from './db.js';
import { todayKW, daysBetween, addDays } from './time.js';
import type { MealOption, PersonPortion, ProfileId, Slot, DrinkCode } from '../shared/types.js';
import { SLOT_SHARE, DRINKS } from '../shared/types.js';

export interface ProfileRow {
  id: ProfileId; name: string; sex: 'male' | 'female'; birth_date: string; height_cm: number;
  start_weight: number; start_date: string; goal_weight: number; activity_factor: number;
  body_fat_pct: number | null; water_goal_ml: number; color: string; avoid_chicken: number; avoid_eggs: number;
}

export function getProfiles(): ProfileRow[] {
  return sqlite.prepare("SELECT * FROM profiles ORDER BY CASE id WHEN 'waleed' THEN 0 ELSE 1 END").all() as ProfileRow[];
}
export function getProfile(id: string): ProfileRow | undefined {
  return sqlite.prepare('SELECT * FROM profiles WHERE id = ?').get(id) as ProfileRow | undefined;
}

export function ageOf(birth: string, on = todayKW()): number {
  const [by, bm, bd] = birth.split('-').map(Number);
  const [y, m, d] = on.split('-').map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

export function latestWeight(id: string): { date: string; weight_kg: number; body_fat_pct: number | null } | undefined {
  return sqlite.prepare('SELECT date, weight_kg, body_fat_pct FROM weights WHERE profile_id = ? ORDER BY date DESC, id DESC LIMIT 1')
    .get(id) as any;
}
function latestBodyFat(id: string): number | null {
  const r = sqlite.prepare('SELECT body_fat_pct FROM weights WHERE profile_id = ? AND body_fat_pct IS NOT NULL ORDER BY date DESC LIMIT 1')
    .get(id) as { body_fat_pct: number } | undefined;
  return r?.body_fat_pct ?? null;
}

/** الحرق الأساسي: Katch-McArdle لو نسبة الدهون معروفة، وإلا Mifflin-St Jeor */
export function bmrOf(p: ProfileRow, weight: number): number {
  const bf = latestBodyFat(p.id) ?? p.body_fat_pct;
  if (bf) return 370 + 21.6 * weight * (1 - bf / 100);
  const s = p.sex === 'male' ? 5 : -161;
  return 10 * weight + 6.25 * p.height_cm - 5 * ageOf(p.birth_date) + s;
}

export interface Targets {
  weight: number; bmr: number; tdee: number; kcal: number; protein: number; waterMl: number;
  bmi: number; remainingKg: number; lostKg: number; progressPct: number;
  weeklyRate: number; etaDate: string | null; etaWeeks: number | null;
}

export function targetsFor(p: ProfileRow): Targets {
  const w = latestWeight(p.id)?.weight_kg ?? p.start_weight;
  const bmr = bmrOf(p, w);
  const tdee = bmr * p.activity_factor;
  // حد أدنى آمن: 90% من الحرق الأساسي ومش أقل من 1500 للراجل و1200 للست
  const floor = Math.max(p.sex === 'male' ? 1500 : 1200, Math.round((bmr * 0.9) / 50) * 50);
  const kcal = Math.max(floor, Math.round((tdee - 500) / 50) * 50);
  const protein = Math.round(p.goal_weight * (p.sex === 'male' ? 1.6 : 1.4));
  const remainingKg = Math.max(0, +(w - p.goal_weight).toFixed(1));
  const lostKg = +(p.start_weight - w).toFixed(1);
  const total = p.start_weight - p.goal_weight;
  const progressPct = total > 0 ? Math.min(100, Math.max(0, (lostKg / total) * 100)) : 100;

  // المعدل الفعلي لو فيه بيانات كفاية (أسبوعين على الأقل)، وإلا 0.6 كجم/أسبوع كمعدل آمن
  const days = daysBetween(p.start_date, todayKW());
  let weeklyRate = 0.6;
  if (days >= 14 && lostKg > 0) weeklyRate = Math.min(1, lostKg / (days / 7));
  const etaWeeks = remainingKg > 0 ? Math.ceil(remainingKg / weeklyRate) : 0;
  const etaDate = addDays(todayKW(), etaWeeks * 7);

  return {
    weight: w, bmr: Math.round(bmr), tdee: Math.round(tdee), kcal, protein, waterMl: p.water_goal_ml,
    bmi: +(w / (p.height_cm / 100) ** 2).toFixed(1), remainingKg, lostKg, progressPct: +progressPct.toFixed(1),
    weeklyRate: +weeklyRate.toFixed(2), etaDate, etaWeeks,
  };
}

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

export function drinkOf(id: string, date: string): DrinkCode {
  const r = sqlite.prepare('SELECT drink FROM drinks WHERE profile_id=? AND date=?').get(id, date) as { drink: DrinkCode } | undefined;
  return r?.drink ?? 'none';
}
export function setDrink(id: string, date: string, drink: DrinkCode) {
  sqlite.prepare('INSERT INTO drinks(profile_id,date,drink) VALUES (?,?,?) ON CONFLICT(profile_id,date) DO UPDATE SET drink=excluded.drink').run(id, date, drink);
}

/** يحسب كمية كل شخص من الوجبة حسب سعراته (ومشروب الصبح بيتخصم من الفطار) */
export function portionFor(opt: MealOption, p: ProfileRow, slot: Slot, date?: string): PersonPortion {
  const t = targetsFor(p);
  const drink = slot === 'breakfast' && date ? drinkOf(p.id, date) : 'none';
  const drinkKcal = drink !== 'none' ? DRINKS[drink].kcal : 0;
  const mealKcal = t.kcal * SLOT_SHARE[slot] - drinkKcal;
  const scale = mealKcal / opt.baseKcal;
  const lines = opt.ingredients.map((ing) => {
    const avoid = (ing.altFor ?? 'chicken') === 'egg' ? p.avoid_eggs : p.avoid_chicken;
    const useAlt = avoid && ing.doaaAlt;
    const name = useAlt ? ing.doaaAlt!.name : ing.name;
    const grams = useAlt ? ing.doaaAlt!.grams : ing.grams;
    return { name, grams: grams > 0 ? round5(grams * scale) : 0 };
  });
  return { kcal: Math.round(mealKcal), protein: Math.round(opt.baseProtein * scale), lines };
}
