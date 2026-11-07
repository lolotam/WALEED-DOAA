import { initLayout, revealCards, toast, gsap } from '../layout';
import { api, esc, todayKW, NAMES, type ProfileId } from '../api';

const app = document.getElementById('app')!;
let who: ProfileId = (new URLSearchParams(location.search).get('p') as ProfileId) || 'waleed';

async function load() {
  const d = await api('/dashboard');
  const p = d.people.find((x: any) => x.profile.id === who);
  const t = p.targets;
  const water = p.today.water, pct = Math.min(100, (water / t.waterMl) * 100);
  const lastW = p.weights[p.weights.length - 1];

  app.style.setProperty('--c', `var(--${who})`);
  app.innerHTML = `
    <div class="slot-head">
      <h1 class="page-title">تسجيل اليوم</h1>
      <div class="seg">${(['waleed', 'doaa'] as ProfileId[]).map((id) =>
        `<button data-p="${id}" class="${id === who ? 'on' : ''}">${NAMES[id]}</button>`).join('')}</div>
    </div>

    <div class="grid-2">
      <div class="card person ${who}">
        <h3>💧 المية</h3>
        <div class="water">
          <div class="glass"><i id="glassFill"></i></div>
          <div style="flex:1">
            <div style="font-size:1.6rem;font-weight:700">${(water / 1000).toFixed(2)} <span class="muted small">/ ${(t.waterMl / 1000).toFixed(1)} لتر</span></div>
            <div class="muted small">${Math.floor(water / 250)} كوباية من ${Math.round(t.waterMl / 250)}</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:14px">
          <button class="btn c" style="flex:1" data-ml="250">+ كوباية (250)</button>
          <button class="btn c" data-ml="500">+ 500</button>
          <button class="btn" id="undo" title="تراجع">↩</button>
        </div>
      </div>

      <div class="card person ${who}">
        <h3>😴 النوم <span class="muted small">(الليلة اللي فاتت)</span></h3>
        <form id="sleepF" class="form-grid">
          <div class="field"><label>نمت الساعة</label><input class="input" type="time" name="bedTime" value="${p.today.sleep?.bed_time || '23:00'}" required></div>
          <div class="field"><label>صحيت الساعة</label><input class="input" type="time" name="wakeTime" value="${p.today.sleep?.wake_time || '06:00'}" required></div>
          <button class="btn c full">${p.today.sleep ? `تحديث (${p.today.sleep.hours} ساعة)` : 'حفظ النوم'}</button>
        </form>
      </div>
    </div>

    <div class="card person ${who}">
      <h3>⚖️ الوزن الأسبوعي</h3>
      <p class="muted small" style="margin-bottom:12px">آخر وزن: <b>${lastW ? `${lastW.weight_kg} كجم` : '—'}</b> ${lastW ? `(${lastW.date})` : ''}. اتوزن الصبح على الريق بعد الحمام.</p>
      <form id="weightF" class="form-grid">
        <div class="field"><label>الوزن (كجم) *</label><input class="input" type="number" step="0.1" min="30" max="250" name="weightKg" required inputmode="decimal"></div>
        <div class="field"><label>التاريخ</label><input class="input" type="date" name="date" value="${todayKW()}"></div>
        <div class="field"><label>نسبة الدهون % (لو عندك InBody)</label><input class="input" type="number" step="0.1" name="bodyFatPct" inputmode="decimal"></div>
        <div class="field"><label>مقاس الوسط (سم)</label><input class="input" type="number" step="0.5" name="waistCm" inputmode="decimal"></div>
        <div class="field full"><label>ملاحظة</label><input class="input" name="note" placeholder="اختياري"></div>
        <button class="btn primary full">حفظ الوزن</button>
      </form>
    </div>`;

  gsap.to('#glassFill', { height: `${pct}%`, duration: 1.2, ease: 'power2.out' });
  revealCards(app);

  app.querySelectorAll<HTMLButtonElement>('[data-p]').forEach((b) => b.addEventListener('click', () => {
    who = b.dataset.p as ProfileId; history.replaceState(null, '', `?p=${who}`); load();
  }));
  app.querySelectorAll<HTMLButtonElement>('[data-ml]').forEach((b) => b.addEventListener('click', async () => {
    await api('/water', { body: { profileId: who, ml: Number(b.dataset.ml) } });
    toast(`💧 +${b.dataset.ml} مل`); load();
  }));
  app.querySelector('#undo')!.addEventListener('click', async () => { await api('/water/undo', { body: { profileId: who } }); load(); });
  app.querySelector<HTMLFormElement>('#sleepF')!.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target as HTMLFormElement));
    const r = await api('/sleep', { body: { profileId: who, ...f } });
    toast(`😴 ${r.sleep.hours} ساعة نوم`); load();
  });
  app.querySelector<HTMLFormElement>('#weightF')!.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target as HTMLFormElement));
    try {
      const r = await api('/weights', { body: { profileId: who, ...f } });
      toast(`⚖️ اتسجل — سعراتك الجديدة ${r.targets.kcal}`); load();
    } catch (err) { toast((err as Error).message); }
  });
}

initLayout('log').then(load).catch((e) => { app.innerHTML = `<div class="card">${esc(e.message)}</div>`; });
