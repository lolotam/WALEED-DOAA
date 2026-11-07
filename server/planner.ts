import Anthropic from '@anthropic-ai/sdk';
import { sqlite } from './db.js';
import { LIBRARY } from './recipes.js';
import { addDays } from './time.js';
import { getProfiles, portionFor, targetsFor } from './nutrition.js';
import type { MealOption, Slot } from '../shared/types.js';
import { SLOTS, SLOT_AR } from '../shared/types.js';

export interface PlanRow {
  id: number; date: string; slot: Slot; options: MealOption[];
  chosenIndex: number | null; chosenBy: string | null; source: string; eaten: boolean;
}

function rowToPlan(r: any): PlanRow {
  return { id: r.id, date: r.date, slot: r.slot, options: JSON.parse(r.options_json), chosenIndex: r.chosen_index,
    chosenBy: r.chosen_by, source: r.source, eaten: !!r.eaten };
}

export function getPlan(date: string): PlanRow[] {
  const rows = sqlite.prepare("SELECT * FROM meal_plans WHERE date = ? ORDER BY CASE slot WHEN 'breakfast' THEN 0 WHEN 'lunch' THEN 1 ELSE 2 END").all(date);
  return rows.map(rowToPlan);
}
export function getPlanById(id: number): PlanRow | undefined {
  const r = sqlite.prepare('SELECT * FROM meal_plans WHERE id = ?').get(id);
  return r ? rowToPlan(r) : undefined;
}

function availablePantry(): string[] {
  return (sqlite.prepare('SELECT name FROM pantry WHERE available = 1').all() as { name: string }[]).map((r) => r.name);
}

/** عناوين الوجبات اللي اتاكلت آخر 4 أيام علشان منكررش */
function recentTitles(date: string): Set<string> {
  const rows = sqlite.prepare('SELECT options_json, chosen_index FROM meal_plans WHERE date >= ? AND date < ?')
    .all(addDays(date, -4), date) as { options_json: string; chosen_index: number | null }[];
  const s = new Set<string>();
  for (const r of rows) {
    const opts = JSON.parse(r.options_json) as MealOption[];
    if (r.chosen_index != null) s.add(opts[r.chosen_index]?.title);
  }
  return s;
}

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

function libraryOptions(slot: Slot, date: string): MealOption[] {
  const pantry = new Set(availablePantry());
  const recent = recentTitles(date);
  const all = LIBRARY[slot];
  const ok = all.filter((r) => r.needs.every((n) => pantry.has(n)));
  const fresh = ok.filter((r) => !recent.has(r.title));
  const pool = [...shuffle(fresh), ...shuffle(ok.filter((r) => recent.has(r.title))), ...shuffle(all.filter((r) => !ok.includes(r)))];
  return pool.slice(0, 3).map(({ needs, ...opt }) => opt);
}

function validOption(o: any): o is MealOption {
  return o && typeof o.title === 'string' && typeof o.baseKcal === 'number' && o.baseKcal > 100
    && typeof o.baseProtein === 'number' && Array.isArray(o.ingredients) && o.ingredients.length > 0
    && o.ingredients.every((i: any) => typeof i.name === 'string' && typeof i.grams === 'number')
    && Array.isArray(o.steps);
}

async function aiOptions(date: string): Promise<Record<Slot, MealOption[]> | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const client = new Anthropic({ apiKey: key });
  const [w, d] = getProfiles();
  const tw = targetsFor(w), td = targetsFor(d);
  const recent = [...recentTitles(date)].filter(Boolean);

  const prompt = `أنت أخصائي تغذية. اعمل خطة وجبات ليوم ${date} لزوجين بيطبخوا نفس الطبخة وكل واحد ياخد كمية مختلفة.
- وليد: هدفه ${tw.kcal} سعر و${tw.protein} جم بروتين في اليوم. بياكل فراخ عادي.
- دعاء: هدفها ${td.kcal} سعر و${td.protein} جم بروتين. **مش بتاكل فراخ**. أي مكون فراخ لازم يكون له "doaaAlt" (لحمة بقري أو سمك أو جمبري أو بيض) بكمية مناسبة.
- الوجبات: فطار وغدا وعشا. لكل وجبة 3 اختيارات مختلفة من المطابخ: مصري، خليجي، شامي، صحي عالمي.
- استخدم المكونات دي بس (وأي بهارات): ${availablePantry().join('، ')}.
- ممنوع تكرار الأطباق دي: ${recent.join('، ') || 'لا يوجد'}.
- الحصة الأساسية لكل وصفة حوالي 500 سعر، والكميات بالجرام (نيء للحوم والرز والحبوب). لو المكون بهارات حط grams = 0.
- السعرات والبروتين تقريبية بس واقعية، والوجبات صحية لخسارة الوزن ببروتين عالي.

رجّع JSON بس، من غير أي كلام قبله أو بعده، بالشكل ده:
{"breakfast":[OPT,OPT,OPT],"lunch":[...],"dinner":[...]}
و OPT = {"title":"...","cuisine":"...","description":"سطر واحد","baseKcal":500,"baseProtein":30,
"ingredients":[{"name":"...","grams":150,"doaaAlt":{"name":"...","grams":150}}],"steps":["...","..."]}
(doaaAlt اختياري ويُستخدم بس مع الفراخ)`;

  try {
    const res: any = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    });
    const text: string = res.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
    const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    const out = {} as Record<Slot, MealOption[]>;
    for (const s of SLOTS) {
      const opts = (json[s] || []).filter(validOption).slice(0, 3);
      if (opts.length < 3) return null;
      out[s] = opts;
    }
    return out;
  } catch (e) {
    console.error('[ai] meal generation failed:', (e as Error).message);
    return null;
  }
}

/** يولّد خطة يوم (لو مش موجودة أو force) */
export async function generatePlan(date: string, force = false): Promise<PlanRow[]> {
  const existing = getPlan(date);
  if (existing.length === 3 && !force) return existing;
  const ai = await aiOptions(date);
  const ins = sqlite.prepare(`INSERT INTO meal_plans(date,slot,options_json,source) VALUES (?,?,?,?)
    ON CONFLICT(date,slot) DO UPDATE SET options_json=excluded.options_json, source=excluded.source, chosen_index=NULL, chosen_by=NULL, eaten=0`);
  for (const s of SLOTS) {
    const opts = ai?.[s] ?? libraryOptions(s, date);
    ins.run(date, s, JSON.stringify(opts), ai ? 'ai' : 'library');
  }
  return getPlan(date);
}

/** يبدّل اختيارات وجبة واحدة بخيارات جديدة من المكتبة */
export function regenerateSlot(date: string, slot: Slot) {
  const opts = libraryOptions(slot, date);
  sqlite.prepare("UPDATE meal_plans SET options_json=?, source='library', chosen_index=NULL, chosen_by=NULL WHERE date=? AND slot=?")
    .run(JSON.stringify(opts), date, slot);
}

export function choose(planId: number, idx: number, by: 'user' | 'auto' = 'user') {
  sqlite.prepare('UPDATE meal_plans SET chosen_index=?, chosen_by=? WHERE id=?').run(idx, by, planId);
}

/** لو محدش اختار: الأنسب = الأكثر بروتين لكل سعر */
export function autoChoose(plan: PlanRow): number {
  if (plan.chosenIndex != null) return plan.chosenIndex;
  let best = 0, bestScore = -1;
  plan.options.forEach((o, i) => { const sc = o.baseProtein / o.baseKcal; if (sc > bestScore) { bestScore = sc; best = i; } });
  choose(plan.id, best, 'auto');
  return best;
}

/** قائمة المكونات المجمّعة للوجبة المختارة (للاتنين) */
export function shoppingLines(plan: PlanRow, idx: number) {
  const opt = plan.options[idx];
  const people = getProfiles().map((p) => ({ p, portion: portionFor(opt, p, plan.slot) }));
  const total = new Map<string, number>();
  for (const { portion } of people) for (const l of portion.lines) total.set(l.name, (total.get(l.name) ?? 0) + l.grams);
  return { opt, people, total: [...total.entries()].map(([name, grams]) => ({ name, grams })), slotAr: SLOT_AR[plan.slot] };
}
