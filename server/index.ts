import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { getSignedCookie, setSignedCookie, deleteCookie } from 'hono/cookie';
import { sqlite } from './db.js';
import { seed } from './seed.js';
import { getProfiles, getProfile, targetsFor, portionFor } from './nutrition.js';
import { getPlan, generatePlan, getPlanById, choose, regenerateSlot } from './planner.js';
import { todayKW, addDays } from './time.js';
import { startBot, sendTomorrowCards, sendIngredients, sendWeeklyReport } from './bot.js';
import { startScheduler } from './scheduler.js';
import { pushEnabled, saveSubscription, pushAll } from './notify.js';
import type { Slot } from '../shared/types.js';
import { SLOTS } from '../shared/types.js';

seed();

const PASSWORD = process.env.APP_PASSWORD || 'change-me';
const SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';
const app = new Hono();

const num = (v: unknown) => (v === '' || v == null ? null : Number(v));
const isProfile = (id: string) => id === 'waleed' || id === 'doaa';

// ---------- auth ----------
app.post('/api/login', async (c) => {
  const { password } = await c.req.json().catch(() => ({}));
  if (password !== PASSWORD) return c.json({ error: 'كلمة السر غلط' }, 401);
  await setSignedCookie(c, 'sess', 'home', SECRET, { httpOnly: true, sameSite: 'Lax', path: '/', maxAge: 60 * 60 * 24 * 180,
    secure: c.req.url.startsWith('https') || c.req.header('x-forwarded-proto') === 'https' });
  return c.json({ ok: true });
});
app.post('/api/logout', (c) => { deleteCookie(c, 'sess', { path: '/' }); return c.json({ ok: true }); });
app.get('/api/health', (c) => c.json({ ok: true }));

app.use('/api/*', async (c, next) => {
  const s = await getSignedCookie(c, SECRET, 'sess');
  if (s !== 'home') return c.json({ error: 'unauthorized' }, 401);
  await next();
});

app.get('/api/me', (c) => c.json({ ok: true, pushKey: pushEnabled ? process.env.VAPID_PUBLIC_KEY : null }));

// ---------- dashboard ----------
function dayStats(id: string, date: string) {
  const water = (sqlite.prepare('SELECT COALESCE(SUM(ml),0) s FROM water WHERE profile_id=? AND date=?').get(id, date) as any).s;
  const sleep = sqlite.prepare('SELECT * FROM sleep WHERE profile_id=? AND date=? ORDER BY id DESC LIMIT 1').get(id, date) ?? null;
  return { water, sleep };
}

function planWithPortions(date: string) {
  const people = getProfiles();
  return getPlan(date).map((p) => ({
    ...p,
    options: p.options.map((o) => ({ ...o, portions: Object.fromEntries(people.map((pr) => [pr.id, portionFor(o, pr, p.slot)])) })),
  }));
}

app.get('/api/dashboard', async (c) => {
  const date = todayKW();
  if (getPlan(date).length < 3) await generatePlan(date);
  const people = getProfiles().map((p) => ({
    profile: p, targets: targetsFor(p), today: dayStats(p.id, date),
    weights: sqlite.prepare('SELECT date, weight_kg FROM weights WHERE profile_id=? ORDER BY date').all(p.id),
    week: Array.from({ length: 7 }, (_, i) => { const d = addDays(date, i - 6); return { date: d, ...dayStats(p.id, d) }; }),
  }));
  return c.json({ date, people, plan: planWithPortions(date) });
});

// ---------- profiles ----------
app.get('/api/profiles', (c) => c.json(getProfiles().map((p) => ({ ...p, targets: targetsFor(p) }))));
app.put('/api/profiles/:id', async (c) => {
  const id = c.req.param('id');
  if (!getProfile(id)) return c.json({ error: 'not found' }, 404);
  const b = await c.req.json();
  const fields: Record<string, string> = { name: 'name', birthDate: 'birth_date', heightCm: 'height_cm', goalWeight: 'goal_weight',
    activityFactor: 'activity_factor', bodyFatPct: 'body_fat_pct', waterGoalMl: 'water_goal_ml', avoidChicken: 'avoid_chicken' };
  for (const [k, col] of Object.entries(fields)) {
    if (!(k in b)) continue;
    let v = b[k];
    if (k === 'avoidChicken') v = v ? 1 : 0;
    else if (k !== 'name' && k !== 'birthDate') v = num(v);
    sqlite.prepare(`UPDATE profiles SET ${col}=? WHERE id=?`).run(v, id);
  }
  return c.json({ ...getProfile(id), targets: targetsFor(getProfile(id)!) });
});

// ---------- weights ----------
app.get('/api/weights', (c) => c.json(sqlite.prepare('SELECT * FROM weights ORDER BY date DESC, id DESC').all()));
app.post('/api/weights', async (c) => {
  const b = await c.req.json();
  if (!isProfile(b.profileId) || !(Number(b.weightKg) > 20)) return c.json({ error: 'بيانات غلط' }, 400);
  const date = b.date || todayKW();
  sqlite.prepare('DELETE FROM weights WHERE profile_id=? AND date=?').run(b.profileId, date);
  sqlite.prepare('INSERT INTO weights(profile_id,date,weight_kg,body_fat_pct,waist_cm,note) VALUES (?,?,?,?,?,?)')
    .run(b.profileId, date, Number(b.weightKg), num(b.bodyFatPct), num(b.waistCm), b.note || null);
  return c.json({ ok: true, targets: targetsFor(getProfile(b.profileId)!) });
});
app.delete('/api/weights/:id', (c) => { sqlite.prepare('DELETE FROM weights WHERE id=?').run(c.req.param('id')); return c.json({ ok: true }); });

// ---------- water & sleep ----------
app.post('/api/water', async (c) => {
  const b = await c.req.json();
  if (!isProfile(b.profileId)) return c.json({ error: 'bad profile' }, 400);
  sqlite.prepare('INSERT INTO water(profile_id,date,ml,created_at) VALUES (?,?,?,?)')
    .run(b.profileId, todayKW(), Number(b.ml) || 250, new Date().toISOString());
  return c.json(dayStats(b.profileId, todayKW()));
});
app.post('/api/water/undo', async (c) => {
  const b = await c.req.json();
  sqlite.prepare('DELETE FROM water WHERE id = (SELECT id FROM water WHERE profile_id=? AND date=? ORDER BY id DESC LIMIT 1)')
    .run(b.profileId, todayKW());
  return c.json(dayStats(b.profileId, todayKW()));
});
app.post('/api/sleep', async (c) => {
  const b = await c.req.json();
  if (!isProfile(b.profileId) || !b.bedTime || !b.wakeTime) return c.json({ error: 'بيانات ناقصة' }, 400);
  const [bh, bm] = b.bedTime.split(':').map(Number), [wh, wm] = b.wakeTime.split(':').map(Number);
  let mins = wh * 60 + wm - (bh * 60 + bm); if (mins <= 0) mins += 1440;
  const date = b.date || todayKW();
  sqlite.prepare('DELETE FROM sleep WHERE profile_id=? AND date=?').run(b.profileId, date);
  sqlite.prepare('INSERT INTO sleep(profile_id,date,bed_time,wake_time,hours) VALUES (?,?,?,?,?)')
    .run(b.profileId, date, b.bedTime, b.wakeTime, +(mins / 60).toFixed(2));
  return c.json(dayStats(b.profileId, date));
});

// ---------- meal plan ----------
app.get('/api/plan', async (c) => {
  const date = c.req.query('date') || todayKW();
  if (getPlan(date).length < 3 && date >= todayKW() && date <= addDays(todayKW(), 2)) await generatePlan(date);
  return c.json({ date, plan: planWithPortions(date) });
});
app.post('/api/plan/:id/choose', async (c) => {
  const { index } = await c.req.json();
  const p = getPlanById(Number(c.req.param('id')));
  if (!p || !(index >= 0 && index < p.options.length)) return c.json({ error: 'bad' }, 400);
  choose(p.id, index, 'user');
  return c.json({ ok: true });
});
app.post('/api/plan/:id/eaten', async (c) => {
  const { eaten } = await c.req.json();
  sqlite.prepare('UPDATE meal_plans SET eaten=? WHERE id=?').run(eaten ? 1 : 0, Number(c.req.param('id')));
  return c.json({ ok: true });
});
app.post('/api/plan/regenerate', async (c) => {
  const { date, slot } = await c.req.json();
  if (slot && SLOTS.includes(slot)) regenerateSlot(date, slot as Slot);
  else await generatePlan(date, true);
  return c.json({ ok: true });
});

// ---------- pantry ----------
app.get('/api/pantry', (c) => c.json(sqlite.prepare('SELECT * FROM pantry ORDER BY category, name').all()));
app.post('/api/pantry', async (c) => {
  const { name, category } = await c.req.json();
  if (!name?.trim()) return c.json({ error: 'الاسم مطلوب' }, 400);
  sqlite.prepare('INSERT INTO pantry(name,category,available) VALUES (?,?,1)').run(name.trim(), category || 'إضافات');
  return c.json({ ok: true });
});
app.patch('/api/pantry/:id', async (c) => {
  const { available } = await c.req.json();
  sqlite.prepare('UPDATE pantry SET available=? WHERE id=?').run(available ? 1 : 0, c.req.param('id'));
  return c.json({ ok: true });
});
app.delete('/api/pantry/:id', (c) => { sqlite.prepare('DELETE FROM pantry WHERE id=?').run(c.req.param('id')); return c.json({ ok: true }); });

// ---------- history ----------
app.get('/api/history', (c) => {
  const from = addDays(todayKW(), -30);
  return c.json({
    weights: sqlite.prepare('SELECT * FROM weights ORDER BY date').all(),
    water: sqlite.prepare('SELECT profile_id, date, SUM(ml) ml FROM water WHERE date>=? GROUP BY profile_id, date ORDER BY date').all(from),
    sleep: sqlite.prepare('SELECT profile_id, date, hours FROM sleep WHERE date>=? ORDER BY date').all(from),
    meals: sqlite.prepare('SELECT date, slot, options_json, chosen_index, eaten FROM meal_plans WHERE date>=? AND chosen_index IS NOT NULL ORDER BY date DESC').all(from)
      .map((r: any) => ({ date: r.date, slot: r.slot, eaten: !!r.eaten, title: JSON.parse(r.options_json)[r.chosen_index]?.title })),
  });
});

// ---------- push & telegram tests ----------
app.post('/api/push/subscribe', async (c) => { saveSubscription(await c.req.json()); return c.json({ ok: true }); });
app.post('/api/test/:what', async (c) => {
  const w = c.req.param('what');
  if (w === 'cards') await sendTomorrowCards();
  else if (w === 'breakfast' || w === 'lunch' || w === 'dinner') await sendIngredients(w);
  else if (w === 'report') await sendWeeklyReport();
  else if (w === 'push') await pushAll('تجربة إشعار ✅', 'الإشعارات شغالة');
  return c.json({ ok: true });
});

// ---------- static (Vite build) ----------
app.use('/*', serveStatic({ root: './dist' }));
app.notFound((c) => (c.req.path.startsWith('/api') ? c.json({ error: 'not found' }, 404) : c.redirect('/')));

const port = Number(process.env.PORT || 3000);
serve({ fetch: app.fetch, port }, () => console.log(`[http] listening on :${port}`));
startBot();
startScheduler();
