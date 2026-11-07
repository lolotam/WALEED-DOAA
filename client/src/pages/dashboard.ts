import { initLayout, revealCards, animateBars, countUp, toast, gsap } from '../layout';
import { api, esc, fmtDate, SLOT_AR, SLOT_IC, type ProfileId } from '../api';
import { lineChart, ring, animateRings } from '../chart';

const app = document.getElementById('app')!;
app.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';

const greet = () => { const h = new Date().getHours(); return h < 12 ? 'صباح الخير' : h < 18 ? 'مساء النور' : 'مساء الخير'; };

async function load() {
  const d = await api('/dashboard');
  const [w, dd] = d.people;
  const totalLost = +(w.targets.lostKg + dd.targets.lostKg).toFixed(1);

  app.innerHTML = `
    <div>
      <h1 class="page-title">${greet()} يا وليد ودعاء 👋</h1>
      <p class="muted">${fmtDate(d.date)}</p>
    </div>

    <div class="card" style="--c: var(--lime)">
      <div class="slot-head">
        <h3 style="margin:0">🏆 رحلتنا مع بعض</h3>
        <span class="tag c">مجموع النزول: <b class="cnt" data-v="${totalLost}">0</b> كجم</span>
      </div>
      <div class="bar-row">
        <div class="lbl"><span>تقدّم الاتنين نحو الهدف</span><span>${((w.targets.progressPct + dd.targets.progressPct) / 2).toFixed(0)}%</span></div>
        <div class="bar"><i data-w="${(w.targets.progressPct + dd.targets.progressPct) / 2}"></i></div>
      </div>
    </div>

    <div class="grid-2">${d.people.map(personCard).join('')}</div>

    <div class="card">
      <div class="slot-head">
        <h3 style="margin:0">📉 الوزن</h3>
        <div class="legend"><span><i style="background:var(--waleed)"></i>وليد</span><span><i style="background:var(--doaa)"></i>دعاء</span><span class="small">--- الهدف</span></div>
      </div>
      <div id="wchart"></div>
    </div>

    <div class="card">
      <div class="slot-head"><h3 style="margin:0">🍽️ وجبات النهارده</h3><a class="btn sm" href="/meals.html">كل الاختيارات ←</a></div>
      <div class="grid-3">${d.plan.map(todayMeal).join('')}</div>
    </div>`;

  const cs = getComputedStyle(document.documentElement);
  lineChart(document.getElementById('wchart')!, d.people.map((p: any) => ({
    name: p.profile.name, color: cs.getPropertyValue(`--${p.profile.id}`).trim(), goal: p.profile.goal_weight,
    points: p.weights.map((x: any) => ({ x: x.date, y: x.weight_kg })),
  })), { unit: ' كجم' });

  revealCards(app); animateRings(app); animateBars(app);
  app.querySelectorAll<HTMLElement>('.cnt').forEach((el) => countUp(el, Number(el.dataset.v), String(el.dataset.v).includes('.') ? 1 : 0));

  app.querySelectorAll<HTMLButtonElement>('[data-water]').forEach((b) => b.addEventListener('click', async () => {
    const pid = b.dataset.water as ProfileId;
    await api('/water', { body: { profileId: pid, ml: 250 } });
    gsap.fromTo(b, { scale: .9 }, { scale: 1, duration: .4, ease: 'back.out(3)' });
    toast('💧 +250 مل');
    load();
  }));
}

function personCard(p: any) {
  const t = p.targets, pr = p.profile, id = pr.id as ProfileId;
  const waterPct = Math.min(100, (p.today.water / t.waterMl) * 100);
  const cups = Math.round(t.waterMl / 250), full = Math.floor(p.today.water / 250);
  const sleep = p.today.sleep;
  return `
  <div class="card person ${id}">
    <div class="name-row"><h2>${esc(pr.name)}</h2><span class="tag c">BMI ${t.bmi}</span></div>
    <div class="hero">
      ${ring(t.progressPct, `var(--${id})`, `${t.progressPct.toFixed(0)}%`, 'من الهدف')}
      <div class="stats">
        <div class="stat"><b class="cnt" data-v="${t.weight}">0</b><span>الوزن الحالي (كجم)</span></div>
        <div class="stat"><b>${t.remainingKg}</b><span>فاضل للهدف ${pr.goal_weight}</span></div>
        <div class="stat"><b class="cnt" data-v="${t.kcal}">0</b><span>سعرات اليوم</span></div>
        <div class="stat"><b>${t.protein} جم</b><span>بروتين</span></div>
      </div>
    </div>
    <div class="bar-row">
      <div class="lbl"><span>📅 الوصول المتوقع</span><span>${t.etaDate ? fmtDate(t.etaDate, { day: 'numeric', month: 'long', year: 'numeric' }) : '—'} <span class="muted small">(${t.etaWeeks} أسبوع)</span></span></div>
    </div>
    <div class="bar-row">
      <div class="lbl"><span>💧 المية النهارده</span><span>${(p.today.water / 1000).toFixed(2)} / ${(t.waterMl / 1000).toFixed(1)} لتر</span></div>
      <div class="bar"><i data-w="${waterPct}"></i></div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div class="cups">${Array.from({ length: cups }, (_, i) => `<span class="${i < full ? 'full' : ''}"></span>`).join('')}</div>
        <button class="btn sm c" data-water="${id}">+ كوباية</button>
      </div>
    </div>
    <div class="bar-row"><div class="lbl"><span>😴 النوم</span><span>${sleep ? `${sleep.hours} ساعة (${sleep.bed_time} ← ${sleep.wake_time})` : '<a href="/log.html" class="muted">سجّل نومك</a>'}</span></div></div>
  </div>`;
}

function todayMeal(p: any) {
  const o = p.chosenIndex != null ? p.options[p.chosenIndex] : null;
  return `<div class="card" style="box-shadow:none;background:var(--card-2)">
    <div class="muted small">${SLOT_IC[p.slot]} ${SLOT_AR[p.slot]}</div>
    ${o ? `<div style="font-weight:700;margin:4px 0">${esc(o.title)}</div>
      <div class="small"><span style="color:var(--waleed)">وليد ${o.portions.waleed.kcal}</span> · <span style="color:var(--doaa)">دعاء ${o.portions.doaa.kcal}</span> سعر</div>`
      : `<div style="margin:4px 0">لسه متختارتش</div><a class="small" style="color:var(--lime)" href="/meals.html">اختار من ${p.options.length} ←</a>`}
  </div>`;
}

initLayout('index').then(load).catch((e) => { app.innerHTML = `<div class="card">${esc(e.message)}</div>`; });
