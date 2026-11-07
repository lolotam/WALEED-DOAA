import { initLayout, revealCards, toast, gsap } from '../layout';
import { api, esc } from '../api';

const app = document.getElementById('app')!;
const CATS = ['لحوم وبروتين', 'بقوليات', 'نشويات وحبوب', 'خضار', 'ألبان', 'دهون', 'فاكهة', 'إضافات'];

async function load() {
  const items: any[] = await api('/pantry');
  const groups = new Map<string, any[]>();
  for (const it of items) { if (!groups.has(it.category)) groups.set(it.category, []); groups.get(it.category)!.push(it); }
  const avail = items.filter((i) => i.available).length;

  app.innerHTML = `
    <div><h1 class="page-title">المخزن 🧺</h1>
    <p class="muted">${avail} صنف متاح من ${items.length}. دوس على الصنف لما يخلص، والوجبات مش هتستخدمه لحد ما يرجع.</p></div>

    <form class="card" id="addF">
      <h3>➕ إضافة صنف</h3>
      <div class="form-grid">
        <div class="field"><label>الاسم</label><input class="input" name="name" required placeholder="مثلًا: سلمون"></div>
        <div class="field"><label>القسم</label><select class="input" name="category">${CATS.map((c) => `<option>${c}</option>`).join('')}</select></div>
        <button class="btn primary full">إضافة</button>
      </div>
    </form>

    ${[...groups.entries()].map(([cat, list]) => `
      <div class="card"><h3>${esc(cat)} <span class="muted small">(${list.filter((i) => i.available).length}/${list.length})</span></h3>
        <div class="chips">${list.map((i) => `<span class="chip ${i.available ? 'on' : 'off'}" data-id="${i.id}" data-a="${i.available ? 1 : 0}">${esc(i.name)}</span>`).join('')}</div>
      </div>`).join('')}
    <p class="muted small">ضغطة طويلة على الصنف = حذفه.</p>`;
  revealCards(app);

  app.querySelectorAll<HTMLElement>('.chip').forEach((ch) => {
    let timer: number | undefined, long = false;
    ch.addEventListener('pointerdown', () => { long = false; timer = window.setTimeout(async () => {
      long = true;
      if (confirm(`حذف "${ch.textContent}" من المخزن؟`)) { await api(`/pantry/${ch.dataset.id}`, { method: 'DELETE' }); load(); }
    }, 650); });
    ch.addEventListener('pointerup', () => clearTimeout(timer));
    ch.addEventListener('pointerleave', () => clearTimeout(timer));
    ch.addEventListener('click', async () => {
      if (long) return;
      const next = ch.dataset.a !== '1';
      await api(`/pantry/${ch.dataset.id}`, { method: 'PATCH', body: { available: next } });
      ch.dataset.a = next ? '1' : '0';
      ch.className = `chip ${next ? 'on' : 'off'}`;
      gsap.fromTo(ch, { scale: .85 }, { scale: 1, duration: .4, ease: 'back.out(3)' });
    });
  });
  app.querySelector<HTMLFormElement>('#addF')!.addEventListener('submit', async (e) => {
    e.preventDefault();
    await api('/pantry', { body: Object.fromEntries(new FormData(e.target as HTMLFormElement)) });
    toast('اتضاف ✅'); load();
  });
}

initLayout('pantry').then(load).catch((e) => { app.innerHTML = `<div class="card">${esc(e.message)}</div>`; });
