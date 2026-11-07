import { initLayout, revealCards, toast, gsap } from '../layout';
import { api, esc, fmtDate, todayKW, addDays, SLOT_AR, SLOT_IC } from '../api';

const app = document.getElementById('app')!;
let date = new URLSearchParams(location.search).get('date') || todayKW();
let curDrinks: Record<string, string> = {};
const DR = [['coffee', '☕ قهوة بالحليب'], ['tea', '🍵 شاي بالحليب'], ['none', '✖ ولا حاجة']];

function drinkRow() {
  return `<div class="card" style="box-shadow:none;background:var(--card-2);padding:12px;margin-bottom:12px">
    <div class="small muted" style="margin-bottom:8px">☕ مشروب الصبح (سعراته بتتخصم من الفطار)</div>
    ${(['waleed', 'doaa'] as const).map((id) => `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px">
      <b style="color:var(--${id});min-width:44px">${id === 'waleed' ? 'وليد' : 'دعاء'}</b>
      <div class="chips">${DR.map(([k, l]) => `<span class="chip ${curDrinks[id] === k || (!curDrinks[id] && k === 'none') ? 'on' : ''}" data-drink="${id}:${k}">${l}</span>`).join('')}</div>
    </div>`).join('')}
  </div>`;
}

async function load() {
  app.innerHTML = '<div class="skeleton"></div>';
  const { plan, drinks } = await api(`/plan?date=${date}`);
  curDrinks = drinks || {};
  const t = todayKW();
  const label = date === t ? 'النهارده' : date === addDays(t, 1) ? 'بكرة' : date === addDays(t, -1) ? 'امبارح' : '';

  app.innerHTML = `
    <div class="slot-head">
      <div><h1 class="page-title">الوجبات ${label}</h1><p class="muted">${fmtDate(date)}</p></div>
      <div class="seg">
        <button data-nav="-1">→ اليوم اللي قبله</button>
        <button data-nav="0" class="${date === t ? 'on' : ''}">النهارده</button>
        <button data-nav="1">اللي بعده ←</button>
      </div>
    </div>
    ${plan.length ? plan.map(slotCard).join('') : `<div class="card"><p class="muted">مفيش خطة لليوم ده.</p>
      <button class="btn primary" id="gen" style="margin-top:12px">ولّد خطة لليوم ده</button></div>`}
    <p class="muted small">السعرات والكميات تقريبية، وبتتعدل تلقائيًا كل ما الوزن يتغير. البيانات مصدرها ${plan[0]?.source === 'ai' ? 'الذكاء الاصطناعي' : 'مكتبة الوصفات'}.</p>`;

  app.querySelectorAll<HTMLButtonElement>('[data-nav]').forEach((b) => b.addEventListener('click', () => {
    const n = Number(b.dataset.nav); date = n === 0 ? todayKW() : addDays(date, n);
    history.replaceState(null, '', `?date=${date}`); load();
  }));
  app.querySelector('#gen')?.addEventListener('click', async () => { await api('/plan/regenerate', { body: { date } }); load(); });

  app.querySelectorAll<HTMLElement>('[data-choose]').forEach((el) => el.addEventListener('click', async (e) => {
    if ((e.target as HTMLElement).closest('details, button')) return;
    const [id, idx] = el.dataset.choose!.split(':').map(Number);
    await api(`/plan/${id}/choose`, { body: { index: idx } });
    gsap.fromTo(el, { scale: .97 }, { scale: 1, duration: .5, ease: 'elastic.out(1, .5)' });
    toast('✅ تم الاختيار');
    load();
  }));
  app.querySelectorAll<HTMLButtonElement>('[data-regen]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    await api('/plan/regenerate', { body: { date, slot: b.dataset.regen } });
    toast('🔄 اختيارات جديدة'); load();
  }));
  app.querySelectorAll<HTMLButtonElement>('[data-eaten]').forEach((b) => b.addEventListener('click', async () => {
    const [id, v] = b.dataset.eaten!.split(':');
    await api(`/plan/${id}/eaten`, { body: { eaten: v === '1' } });
    toast(v === '1' ? '👏 برافو!' : 'اتلغى'); load();
  }));
  app.querySelectorAll<HTMLElement>('[data-drink]').forEach((ch) => ch.addEventListener('click', async () => {
    const [profileId, drink] = ch.dataset.drink!.split(':');
    await api('/drinks', { body: { profileId, date, drink } });
    toast('☕ اتسجّل'); load();
  }));
  revealCards(app);
}

function slotCard(p: any) {
  return `<section class="card">
    <div class="slot-head">
      <h3>${SLOT_IC[p.slot]} ${SLOT_AR[p.slot]} ${p.chosenBy === 'auto' ? '<span class="tag">اختيار تلقائي</span>' : ''}</h3>
      <div style="display:flex;gap:8px">
        ${p.chosenIndex != null ? `<button class="btn sm ${p.eaten ? 'lime' : ''}" data-eaten="${p.id}:${p.eaten ? 0 : 1}">${p.eaten ? '✔ اتاكلت' : 'علّم إنها اتاكلت'}</button>` : ''}
        <button class="btn sm" data-regen="${p.slot}" title="اختيارات تانية">🔄 غيّر</button>
      </div>
    </div>
    ${p.slot === 'breakfast' ? drinkRow() : ''}
    <div class="options">${p.options.map((o: any, i: number) => optCard(p, o, i)).join('')}</div>
  </section>`;
}

function optCard(p: any, o: any, i: number) {
  const w = o.portions.waleed, d = o.portions.doaa;
  const lines = (pp: any) => pp.lines.filter((l: any) => l.grams).map((l: any) => `<li>${esc(l.name)} — <b>${l.grams}</b> جم</li>`).join('');
  return `<article class="opt ${p.chosenIndex === i ? 'chosen' : ''}" data-choose="${p.id}:${i}">
    ${o.image ? `<img class="opt-img" src="${esc(o.image)}" alt="${esc(o.title)}" loading="lazy">` : ''}
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:start">
      <div class="t">${esc(o.title)}</div>
      ${p.chosenIndex === i ? '<span class="chosen-badge">✓ مختارة</span>' : `<span class="tag">${i + 1}</span>`}
    </div>
    <div><span class="tag">${esc(o.cuisine)}</span></div>
    <div class="muted small">${esc(o.description)}</div>
    <div class="portions">
      <div class="w">🟢 وليد<br><b>${w.kcal}</b> سعر · ${w.protein}جم</div>
      <div class="d">🌸 دعاء<br><b>${d.kcal}</b> سعر · ${d.protein}جم</div>
    </div>
    <details><summary>المكونات بالجرام</summary>
      <div style="color:var(--waleed);margin-top:6px">وليد:</div><ul>${lines(w)}</ul>
      <div style="color:var(--doaa);margin-top:6px">دعاء:</div><ul>${lines(d)}</ul>
    </details>
    <details><summary>طريقة التحضير</summary><ol>${o.steps.map((s: string) => `<li>${esc(s)}</li>`).join('')}</ol></details>
  </article>`;
}

initLayout('meals').then(load).catch((e) => { app.innerHTML = `<div class="card">${esc(e.message)}</div>`; });
