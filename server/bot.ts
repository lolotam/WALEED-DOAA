import { Bot, InlineKeyboard } from 'grammy';
import { getSetting, setSetting, sqlite, logNotify } from './db.js';
import { getPlan, getPlanById, choose, autoChoose, shoppingLines, generatePlan, type PlanRow } from './planner.js';
import { getProfiles, portionFor, targetsFor } from './nutrition.js';
import { todayKW, addDays, formatDateAr } from './time.js';
import { SLOT_AR } from '../shared/types.js';
import { pushAll } from './notify.js';

const token = process.env.TELEGRAM_BOT_TOKEN;
export const bot = token ? new Bot(token) : null;
const SITE = process.env.PUBLIC_URL || 'https://health.walidmohamed.com';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const NUM = ['1️⃣', '2️⃣', '3️⃣'];

function chatId(): string | null { return getSetting('telegram_chat_id'); }

export let botUsername: string | null = null;

/** يبعت للجروب ويسجّل النتيجة في سجل الإرسال (بيظهر في صفحة الإعدادات) */
async function send(text: string, keyboard?: InlineKeyboard, kind = 'message') {
  const id = chatId();
  if (!bot) { logNotify(kind, false, 'التوكن مش موجود'); return; }
  if (!id) { logNotify(kind, false, 'الجروب مش متسجّل — اكتب /start في الجروب'); return; }
  try {
    await bot.api.sendMessage(id, text, { parse_mode: 'HTML', reply_markup: keyboard, link_preview_options: { is_disabled: true } });
    logNotify(kind, true, text.replace(/<[^>]+>/g, '').split('\n')[0]);
  } catch (e) {
    logNotify(kind, false, (e as Error).message);
    throw e;
  }
}

export function telegramStatus() {
  return {
    enabled: !!bot, botUsername, chatId: chatId(), chatTitle: getSetting('telegram_chat_title'),
    log: sqlite.prepare('SELECT * FROM notify_log ORDER BY id DESC LIMIT 30').all(),
  };
}

function cardText(plan: PlanRow): string {
  const [w, d] = getProfiles();
  let t = `🍽️ <b>${SLOT_AR[plan.slot]} — ${formatDateAr(plan.date)}</b>\nاختاروا واحدة من التلاتة:\n`;
  plan.options.forEach((o, i) => {
    const pw = portionFor(o, w, plan.slot), pd = portionFor(o, d, plan.slot);
    const mark = plan.chosenIndex === i ? ' ✅' : '';
    t += `\n${NUM[i]} <b>${esc(o.title)}</b>${mark}\n<i>${esc(o.cuisine)}</i> · ${esc(o.description)}\n`
      + `🟢 وليد ${pw.kcal} سعر · ${pw.protein}جم بروتين  |  🌸 دعاء ${pd.kcal} سعر · ${pd.protein}جم\n`;
  });
  if (plan.chosenIndex != null) t += `\n✅ الاختيار: <b>${esc(plan.options[plan.chosenIndex].title)}</b>${plan.chosenBy === 'auto' ? ' (اختيار تلقائي)' : ''}`;
  return t;
}
function cardKeyboard(plan: PlanRow) {
  const kb = new InlineKeyboard();
  plan.options.forEach((o, i) => kb.text(`${NUM[i]} ${o.title.slice(0, 22)}`, `pick:${plan.id}:${i}`).row());
  kb.url('📱 التفاصيل في الموقع', `${SITE}/meals.html?date=${plan.date}`);
  return kb;
}

/** 9 بالليل: كروت أكل بكرة */
export async function sendTomorrowCards() {
  const date = addDays(todayKW(), 1);
  const plans = await generatePlan(date);
  await send(`🌙 <b>منيو بكرة جاهز</b> — ${formatDateAr(date)}\nدوسوا على الوجبة اللي عايزينها. لو محدش اختار، هختار الأنسب قبل ميعادها.`, undefined, 'cards');
  for (const p of plans) await send(cardText(p), cardKeyboard(p), 'cards');
  await pushAll('منيو بكرة جاهز 🍽️', 'اختاروا الفطار والغدا والعشا', '/meals.html');
}

/** 5ص / 12ظ / 5م: مكونات الوجبة الجاية */
export async function sendIngredients(slot: 'breakfast' | 'lunch' | 'dinner') {
  const date = todayKW();
  const plans = await generatePlan(date);
  const plan = plans.find((p) => p.slot === slot)!;
  const idx = autoChoose(plan);
  const { opt, people, total, slotAr } = shoppingLines(getPlanById(plan.id)!, idx);
  let t = `🧺 <b>مكونات ${slotAr}: ${esc(opt.title)}</b>\n\n<b>الإجمالي للطبخة:</b>\n`;
  for (const l of total) t += `• ${esc(l.name)}${l.grams ? ` — ${l.grams} جم` : ''}\n`;
  for (const { p, portion } of people) {
    t += `\n${p.id === 'waleed' ? '🟢' : '🌸'} <b>طبق ${p.name}</b> (${portion.kcal} سعر · ${portion.protein}جم بروتين)\n`;
    for (const l of portion.lines) if (l.grams) t += `  ◦ ${esc(l.name)}: ${l.grams} جم\n`;
  }
  t += `\n👩‍🍳 <b>الطريقة:</b>\n` + opt.steps.map((s, i) => `${i + 1}. ${esc(s)}`).join('\n');
  await send(t, new InlineKeyboard().url('📱 افتح في الموقع', `${SITE}/meals.html`), `ingredients-${slot}`);
  await pushAll(`مكونات ${slotAr} 🧺`, opt.title, '/meals.html');
}

/** الجمعة بالليل */
export async function sendWeighReminder() {
  await send(`⚖️ <b>ميعاد الوزن الأسبوعي</b>\nبكرة الصبح على الريق، بعد الحمام وقبل الأكل.`,
    new InlineKeyboard().url('⚖️ سجّل الوزن', `${SITE}/log.html`), 'weigh');
  await pushAll('ميعاد الوزن ⚖️', 'سجّلوا وزنكم الأسبوعي', '/log.html');
}

/** تقرير الأسبوع (السبت 12 الضهر) */
export async function sendWeeklyReport() {
  const from = addDays(todayKW(), -7);
  let t = `📊 <b>تقرير الأسبوع</b>\n`;
  for (const p of getProfiles()) {
    const tg = targetsFor(p);
    const prev = sqlite.prepare('SELECT weight_kg FROM weights WHERE profile_id=? AND date<=? ORDER BY date DESC LIMIT 1').get(p.id, from) as any;
    const delta = prev ? +(tg.weight - prev.weight_kg).toFixed(1) : null;
    const water = sqlite.prepare('SELECT COALESCE(SUM(ml),0) s FROM water WHERE profile_id=? AND date>?').get(p.id, from) as any;
    const sleep = sqlite.prepare('SELECT AVG(hours) a FROM sleep WHERE profile_id=? AND date>?').get(p.id, from) as any;
    t += `\n${p.id === 'waleed' ? '🟢' : '🌸'} <b>${p.name}</b>\n`
      + `الوزن: ${tg.weight} كجم${delta != null ? ` (${delta > 0 ? '+' : ''}${delta} الأسبوع ده)` : ''}\n`
      + `نزلت لحد دلوقتي: ${tg.lostKg} كجم · فاضل ${tg.remainingKg} كجم (${tg.progressPct}%)\n`
      + `متوسط المية: ${(water.s / 7 / 1000).toFixed(1)} لتر/يوم · النوم: ${sleep.a ? sleep.a.toFixed(1) : '—'} ساعة\n`
      + `سعرات الأسبوع الجاي: ${tg.kcal} · الوصول المتوقع: ${tg.etaDate ? formatDateAr(tg.etaDate) : '—'}\n`;
  }
  await send(t, new InlineKeyboard().url('📈 التقرير الكامل', `${SITE}/history.html`), 'report');
}

/** بعد الساعة 9 بالليل: لو كروت بكرة متبعتتش، ابعتها */
export async function catchUpCards() {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuwait', hour: '2-digit', hour12: false }).format(new Date()));
  if (h < 21) return;
  const since = new Date(Date.now() - (h - 21 + 1) * 3600000).toISOString();
  const sent = sqlite.prepare("SELECT 1 FROM notify_log WHERE kind='cards' AND ok=1 AND at >= ?").get(since);
  if (!sent) await sendTomorrowCards();
}

export function startBot() {
  if (!bot) { console.log('[bot] TELEGRAM_BOT_TOKEN missing — bot disabled'); return; }

  bot.command(['start', 'register'], async (ctx) => {
    if (ctx.chat.type === 'private') {
      await ctx.reply('ضيفني في جروب البيت واكتب /start هناك علشان أبعت الكروت فيه.');
      return;
    }
    setSetting('telegram_chat_id', String(ctx.chat.id));
    setSetting('telegram_chat_title', ctx.chat.title || 'الجروب');
    logNotify('register', true, `اتسجّل الجروب: ${ctx.chat.title || ctx.chat.id}`);
    await ctx.reply('تمام ✅ الجروب ده اتسجّل.\n\n🕘 9 بالليل: كروت أكل بكرة\n🌅 5 الفجر: مكونات الفطار\n☀️ 12 الضهر: مكونات الغدا\n🌙 5 المغرب: مكونات العشا\n⚖️ الجمعة 9م: تذكير الوزن\n📊 السبت 12ظ: تقرير الأسبوع',
      { reply_markup: new InlineKeyboard().url('📱 افتح الموقع', SITE) });
    await catchUpCards();
  });

  bot.command('status', async (ctx) => {
    const lines = getProfiles().map((p) => { const t = targetsFor(p); return `${p.id === 'waleed' ? '🟢' : '🌸'} ${p.name}: ${t.weight} كجم · فاضل ${t.remainingKg} · ${t.kcal} سعر`; });
    await ctx.reply(`📊 الحالة النهارده\n${lines.join('\n')}`, { reply_markup: new InlineKeyboard().url('📱 الداشبورد', SITE) });
  });

  bot.command('menu', async (ctx) => {
    const plans = await generatePlan(todayKW());
    for (const p of plans) await ctx.reply(cardText(p), { parse_mode: 'HTML', reply_markup: cardKeyboard(p) });
  });

  bot.command('tomorrow', async () => { await sendTomorrowCards(); });

  bot.on('callback_query:data', async (ctx) => {
    const m = /^pick:(\d+):(\d)$/.exec(ctx.callbackQuery.data);
    if (!m) return ctx.answerCallbackQuery();
    const plan = getPlanById(Number(m[1]));
    if (!plan) return ctx.answerCallbackQuery({ text: 'الوجبة دي مش موجودة' });
    choose(plan.id, Number(m[2]), 'user');
    const updated = getPlanById(plan.id)!;
    await ctx.answerCallbackQuery({ text: `✅ ${updated.options[updated.chosenIndex!].title}` });
    try { await ctx.editMessageText(cardText(updated), { parse_mode: 'HTML', reply_markup: cardKeyboard(updated) }); } catch { /* نفس النص */ }
  });

  bot.catch((e) => console.error('[bot]', e.message));
  bot.api.setMyCommands([
    { command: 'start', description: 'تسجيل الجروب لاستقبال الإشعارات' },
    { command: 'menu', description: 'منيو النهارده' },
    { command: 'tomorrow', description: 'ابعت كروت بكرة دلوقتي' },
    { command: 'status', description: 'الوزن والسعرات النهارده' },
  ]).catch(() => {});
  // زرار القائمة في الشات الخاص بيفتح الموقع جوه التليجرام
  bot.api.setChatMenuButton({ menu_button: { type: 'web_app', text: 'التطبيق', web_app: { url: SITE } } }).catch(() => {});

  bot.start({ onStart: (me) => { botUsername = me.username; console.log(`[bot] @${me.username} running`); } }).catch((e) => console.error('[bot] start failed', e.message));
}

export { getPlan };
