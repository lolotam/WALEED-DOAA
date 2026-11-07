import { initLayout, revealCards, toast } from '../layout';
import { api, esc, fmtDate, NAMES, SLOT_AR, type ProfileId } from '../api';
import { lineChart } from '../chart';

const app = document.getElementById('app')!;

async function load() {
  const h = await api('/history');
  const cs = getComputedStyle(document.documentElement);
  const col = (id: string) => cs.getPropertyValue(`--${id}`).trim();
  const ids: ProfileId[] = ['waleed', 'doaa'];
  const byP = (arr: any[], key: string) => ids.map((id) => ({
    name: NAMES[id], color: col(id), points: arr.filter((r) => r.profile_id === id).map((r) => ({ x: r.date, y: +r[key] })),
  }));

  app.innerHTML = `
    <h1 class="page-title">السجل والتقارير 📈</h1>
    <div class="card"><h3>⚖️ الوزن من البداية</h3><div id="c1"></div></div>
    <div class="grid-2">
      <div class="card"><h3>💧 المية (لتر) — آخر 30 يوم</h3><div id="c2"></div></div>
      <div class="card"><h3>😴 النوم (ساعات) — آخر 30 يوم</h3><div id="c3"></div></div>
    </div>
    <div class="card"><h3>📋 كل الأوزان</h3>
      <div style="overflow-x:auto"><table class="table"><thead><tr><th>التاريخ</th><th>مين</th><th>الوزن</th><th>دهون %</th><th>الوسط</th><th>ملاحظة</th><th></th></tr></thead>
      <tbody>${[...h.weights].reverse().map((w: any) => `<tr>
        <td>${w.date}</td><td style="color:var(--${w.profile_id})">${NAMES[w.profile_id as ProfileId]}</td>
        <td><b>${w.weight_kg}</b></td><td>${w.body_fat_pct ?? '—'}</td><td>${w.waist_cm ?? '—'}</td><td class="muted">${esc(w.note || '')}</td>
        <td><button class="btn sm" data-del="${w.id}" title="حذف">🗑</button></td></tr>`).join('')}</tbody></table></div>
    </div>
    <div class="card"><h3>🍽️ الوجبات اللي اتاكلت</h3>
      <div style="overflow-x:auto"><table class="table"><thead><tr><th>اليوم</th><th>الوجبة</th><th>الطبق</th><th></th></tr></thead>
      <tbody>${h.meals.slice(0, 60).map((m: any) => `<tr><td>${fmtDate(m.date, { weekday: 'short', day: 'numeric', month: 'short' })}</td>
        <td>${SLOT_AR[m.slot]}</td><td>${esc(m.title)}</td><td>${m.eaten ? '✅' : ''}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">لسه مفيش.</td></tr>'}</tbody></table></div>
    </div>`;

  lineChart(document.getElementById('c1')!, byP(h.weights, 'weight_kg'), { unit: ' كجم' });
  lineChart(document.getElementById('c2')!, byP(h.water.map((r: any) => ({ ...r, l: (r.ml / 1000).toFixed(2) })), 'l'), { unit: ' لتر' });
  lineChart(document.getElementById('c3')!, byP(h.sleep, 'hours'), { unit: ' ساعة' });
  revealCards(app);

  app.querySelectorAll<HTMLButtonElement>('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('حذف القراءة دي؟')) return;
    await api(`/weights/${b.dataset.del}`, { method: 'DELETE' }); toast('اتحذف'); load();
  }));
}

initLayout('history').then(load).catch((e) => { app.innerHTML = `<div class="card">${esc(e.message)}</div>`; });
