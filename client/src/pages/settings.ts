import { initLayout, revealCards, toast } from '../layout';
import { api, esc } from '../api';

const app = document.getElementById('app')!;
const ACT = [
  [1.2, 'قليل جدًا (قاعد معظم اليوم)'], [1.375, 'خفيف (شغل فيه حركة / مشي 1–3 مرات)'],
  [1.55, 'متوسط (رياضة 3–5 مرات)'], [1.725, 'عالي (رياضة يومية)'],
] as const;

let pushKey: string | null = null;

async function load() {
  const [profiles, tg, sch]: [any[], any, any] = await Promise.all([api('/profiles'), api('/telegram/status'), api('/schedule')]);
  app.innerHTML = `
    <h1 class="page-title">الإعدادات ⚙️</h1>
    <div id="sch"></div>
    <div class="grid-2">${profiles.map(profileForm).join('')}</div>

    <div class="card"><h3>🔔 الإشعارات</h3>
      <p class="muted small" style="margin-bottom:12px">على الآيفون: افتح الموقع من Safari ← مشاركة ← "إضافة إلى الشاشة الرئيسية"، وبعدها افتحه من الأيقونة وفعّل الإشعارات.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn primary" id="pushBtn" ${pushKey ? '' : 'disabled'}>${pushKey ? 'فعّل إشعارات الموبايل' : 'إشعارات الويب مش متفعلة على السيرفر'}</button>
        <button class="btn" data-test="push">جرّب إشعار</button>
      </div>
    </div>

    <div id="tg"></div>

    <div class="card"><h3>🚪 الحساب</h3><button class="btn" id="logout">تسجيل خروج</button></div>
    <p class="muted small">⚠️ الأرقام دي حسابات تقديرية مش بديل عن الدكتور. الحد الأدنى للسعرات 1500 للراجل و1200 للست.</p>`;
  app.querySelector('#tg')!.outerHTML = telegramCard(tg);
  app.querySelector('#sch')!.outerHTML = scheduleCard(sch, !!tg.chatId);
  bindSchedule(sch);
  revealCards(app);

  app.querySelectorAll<HTMLFormElement>('form[data-id]').forEach((f) => f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const b: any = Object.fromEntries(new FormData(f));
    b.avoidChicken = f.querySelector<HTMLInputElement>('[name=avoidChicken]')!.checked;
    b.avoidEggs = f.querySelector<HTMLInputElement>('[name=avoidEggs]')!.checked;
    b.waterGoalMl = Math.round(Number(b.waterL) * 1000); delete b.waterL;
    const r = await api(`/profiles/${f.dataset.id}`, { method: 'PUT', body: b });
    toast(`✅ اتحفظ — السعرات ${r.targets.kcal}`); load();
  }));
  app.querySelectorAll<HTMLButtonElement>('[data-test]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    try { await api(`/test/${b.dataset.test}`, { body: {} }); toast('اتبعت ✅'); }
    catch (e) { toast((e as Error).message); }
    b.disabled = false;
    if (b.dataset.test !== 'push') load();
  }));
  app.querySelector('#pushBtn')?.addEventListener('click', enablePush);
  app.querySelector('#logout')!.addEventListener('click', async () => { await api('/logout', { body: {} }); location.href = '/login.html'; });
}

const DAYS = ['الأحد', 'الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت'];

function scheduleCard(sch: any, connected: boolean) {
  return `<form class="card" id="schF">
    <div class="slot-head"><h3 style="margin:0">⚙️ مواعيد الإرسال والتذكيرات</h3><span class="tag">🕐 الكويت: ${esc(sch.now)}</span></div>
    <div style="display:grid;gap:10px">
    ${sch.meta.map((m: any) => {
      const c = sch.schedule[m.key];
      return `<div class="card" data-job="${m.key}" style="box-shadow:none;background:var(--card-2);padding:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <label style="display:flex;gap:10px;align-items:center;cursor:pointer">
            <input type="checkbox" name="enabled" ${c.enabled ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--lime)">
            <span><b>${esc(m.label)}</b><br><span class="muted small">${esc(m.hint)}</span></span>
          </label>
          <button type="button" class="btn sm" data-test="${m.key}" ${connected ? '' : 'disabled'}>ابعت دلوقتي</button>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;align-items:center">
          ${m.multi
            ? `<input class="input" name="times" value="${c.times.join('، ')}" placeholder="10:00، 12:00، 14:00" style="flex:1;min-width:200px">`
            : `<input class="input" type="time" name="times" value="${c.times[0]}" style="max-width:150px">`}
          ${m.weekly
            ? `<select class="input" name="day" style="max-width:150px">${DAYS.map((d, i) => `<option value="${i}" ${c.days[0] === i ? 'selected' : ''}>${d}</option>`).join('')}</select>`
            : '<span class="muted small">كل يوم</span>'}
        </div>
      </div>`;
    }).join('')}
    </div>
    <p class="muted small" style="margin:10px 0">خطة بكرة بتتولّد تلقائيًا قبل ميعاد الكروت بنص ساعة. تذكير المية: اكتب المواعيد بينها فاصلة.</p>
    <button class="btn primary block">حفظ المواعيد</button>
  </form>`;
}

function bindSchedule(sch: any) {
  app.querySelector<HTMLFormElement>('#schF')!.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body: any = {};
    app.querySelectorAll<HTMLElement>('[data-job]').forEach((row) => {
      const key = row.dataset.job!;
      const meta = sch.meta.find((m: any) => m.key === key);
      const raw = row.querySelector<HTMLInputElement>('[name=times]')!.value;
      const times = raw.split(/[،,\s]+/).map((t) => t.trim()).filter(Boolean).map((t) => (t.length === 4 ? '0' + t : t));
      const day = row.querySelector<HTMLSelectElement>('[name=day]');
      body[key] = { enabled: row.querySelector<HTMLInputElement>('[name=enabled]')!.checked, times, days: meta.weekly && day ? [Number(day.value)] : [] };
    });
    try { await api('/schedule', { method: 'PUT', body }); toast('✅ المواعيد اتحفظت واشتغلت'); load(); }
    catch (err) { toast((err as Error).message); }
  });
}

function telegramCard(tg: any) {
  const status = !tg.enabled ? '<span class="tag" style="color:var(--danger)">التوكن مش موجود</span>'
    : tg.chatId ? `<span class="tag c" style="--c:var(--lime)">✅ متوصل بـ ${esc(tg.chatTitle || 'الجروب')}</span>`
    : '<span class="tag" style="color:var(--danger)">⚠️ الجروب مش متسجّل</span>';
  const fmt = (iso: string) => new Date(iso).toLocaleString('ar-EG', { timeZone: 'Asia/Kuwait', weekday: 'short', hour: 'numeric', minute: '2-digit' });
  return `<div class="card">
    <div class="slot-head"><h3 style="margin:0">🤖 بوت التليجرام ${tg.botUsername ? `<a class="muted small" href="https://t.me/${esc(tg.botUsername)}" target="_blank">@${esc(tg.botUsername)}</a>` : ''}</h3>${status}</div>
    ${tg.chatId ? '' : `<p class="small" style="margin-bottom:12px">ضيف البوت للجروب (هيتسجّل لوحده)، أو ابعتله <b>/start</b> في الخاص. وبعدها حدّث الصفحة. لو مفيش ولا "incoming" في السجل تحت، يبقى الرسايل مش واصلة للبوت.</p>`}
    <details style="margin-top:12px"><summary class="muted small" style="cursor:pointer">سجل الإرسال (${tg.log.length})</summary>
      <table class="table small" style="margin-top:8px"><tbody>${tg.log.map((l: any) => `<tr>
        <td>${l.ok ? '✅' : '❌'}</td><td class="muted">${fmt(l.at)}</td><td>${esc(l.kind)}</td><td>${esc(l.detail || '')}</td></tr>`).join('')
        || '<tr><td class="muted">لسه مفيش حاجة اتبعتت.</td></tr>'}</tbody></table>
    </details>
  </div>`;
}

function profileForm(p: any) {
  const t = p.targets;
  return `<form class="card person ${p.id}" data-id="${p.id}" style="--c:var(--${p.id})">
    <div class="name-row"><h2>${esc(p.name)}</h2><span class="tag c">${t.kcal} سعر · ${t.protein}جم بروتين</span></div>
    <p class="muted small" style="margin-bottom:12px">الحرق الأساسي ${t.bmr} · الاحتياج اليومي ${t.tdee} سعر</p>
    <div class="form-grid">
      <div class="field"><label>الاسم</label><input class="input" name="name" value="${esc(p.name)}"></div>
      <div class="field"><label>تاريخ الميلاد</label><input class="input" type="date" name="birthDate" value="${p.birth_date}"></div>
      <div class="field"><label>الطول (سم)</label><input class="input" type="number" name="heightCm" value="${p.height_cm}"></div>
      <div class="field"><label>الوزن المستهدف (كجم)</label><input class="input" type="number" step="0.1" name="goalWeight" value="${p.goal_weight}"></div>
      <div class="field"><label>نسبة الدهون % (InBody)</label><input class="input" type="number" step="0.1" name="bodyFatPct" value="${p.body_fat_pct ?? ''}"></div>
      <div class="field"><label>هدف المية (لتر)</label><input class="input" type="number" step="0.1" name="waterL" value="${p.water_goal_ml / 1000}"></div>
      <div class="field full"><label>مستوى النشاط</label><select class="input" name="activityFactor">
        ${ACT.map(([v, l]) => `<option value="${v}" ${Number(p.activity_factor) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <label class="full" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="avoidChicken" ${p.avoid_chicken ? 'checked' : ''}> مش بياكل فراخ (يتبدّل بلحمة أو سمك)</label>
      <label class="full" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="avoidEggs" ${p.avoid_eggs ? 'checked' : ''}> مش بياكل بيض (يتبدّل بجبنة أو تونة)</label>
      <button class="btn c full">حفظ</button>
    </div>
  </form>`;
}

async function enablePush() {
  try {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) throw new Error('المتصفح ده مش بيدعم الإشعارات. على الآيفون لازم تضيف الموقع للشاشة الرئيسية الأول.');
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('الإذن اترفض');
    const reg = await navigator.serviceWorker.ready;
    const key = Uint8Array.from(atob(pushKey!.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (pushKey!.length % 4)) % 4)), (c) => c.charCodeAt(0));
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    await api('/push/subscribe', { body: sub.toJSON() });
    toast('🔔 الإشعارات اتفعلت');
  } catch (e) { toast((e as Error).message); }
}

initLayout('settings').then((me: any) => { pushKey = me.pushKey; return load(); })
  .catch((e) => { app.innerHTML = `<div class="card">${esc(e.message)}</div>`; });
