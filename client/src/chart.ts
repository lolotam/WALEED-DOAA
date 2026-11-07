import { gsap } from 'gsap';

export interface Series { name: string; color: string; points: { x: string; y: number }[]; goal?: number }

/** رسم بياني خطي بسيط (SVG) مع أنيميشن رسم الخط */
export function lineChart(el: HTMLElement, series: Series[], opts: { unit?: string } = {}) {
  const W = Math.max(300, el.clientWidth || 640), H = 230, P = { t: 16, r: 16, b: 28, l: 40 };
  const all = series.flatMap((s) => s.points);
  if (!all.length) { el.innerHTML = '<p class="muted small">مفيش بيانات لسه.</p>'; return; }
  const dates = [...new Set(all.map((p) => p.x))].sort();
  const goals = series.map((s) => s.goal).filter((g): g is number => g != null);
  let min = Math.min(...all.map((p) => p.y), ...goals), max = Math.max(...all.map((p) => p.y), ...goals);
  if (max - min < 4) { min -= 2; max += 2; }
  min = Math.floor(min - 1); max = Math.ceil(max + 1);
  const t0 = new Date(dates[0]).getTime(), t1 = new Date(dates[dates.length - 1]).getTime() || t0 + 1;
  const sx = (d: string) => P.l + ((new Date(d).getTime() - t0) / Math.max(1, t1 - t0)) * (W - P.l - P.r) || P.l;
  const sy = (v: number) => P.t + (1 - (v - min) / (max - min)) * (H - P.t - P.b);

  let svg = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">`;
  for (let i = 0; i <= 4; i++) {
    const v = min + ((max - min) * i) / 4, y = sy(v);
    svg += `<line x1="${P.l}" x2="${W - P.r}" y1="${y}" y2="${y}" stroke="currentColor" stroke-opacity=".08"/>`;
    svg += `<text x="${P.l - 8}" y="${y + 4}" text-anchor="end">${v.toFixed(0)}</text>`;
  }
  const labelIdx = dates.length <= 6 ? dates.map((_, i) => i) : [0, Math.floor(dates.length / 2), dates.length - 1];
  for (const i of labelIdx) {
    const d = dates[i];
    svg += `<text x="${sx(d)}" y="${H - 8}" text-anchor="middle">${new Date(d).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}</text>`;
  }
  series.forEach((s, si) => {
    if (s.goal != null) svg += `<line x1="${P.l}" x2="${W - P.r}" y1="${sy(s.goal)}" y2="${sy(s.goal)}" stroke="${s.color}" stroke-dasharray="5 6" stroke-opacity=".6"/>`;
    if (!s.points.length) return;
    const pts = s.points.map((p) => `${sx(p.x)},${sy(p.y)}`);
    if (s.points.length > 1) {
      const area = `M${pts[0]} L${pts.join(' L')} L${sx(s.points[s.points.length - 1].x)},${H - P.b} L${sx(s.points[0].x)},${H - P.b} Z`;
      svg += `<defs><linearGradient id="g${si}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${s.color}" stop-opacity=".28"/><stop offset="1" stop-color="${s.color}" stop-opacity="0"/></linearGradient></defs>`;
      svg += `<path class="area" d="${area}" fill="url(#g${si})"/>`;
      svg += `<path class="ln" d="M${pts.join(' L')}" fill="none" stroke="${s.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    for (const p of s.points) svg += `<circle class="dot" cx="${sx(p.x)}" cy="${sy(p.y)}" r="4.5" fill="${s.color}"><title>${s.name}: ${p.y}${opts.unit ?? ''}</title></circle>`;
  });
  svg += '</svg>';
  el.innerHTML = svg;

  el.querySelectorAll<SVGPathElement>('path.ln').forEach((p) => {
    const len = p.getTotalLength();
    gsap.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut' });
  });
  gsap.from(el.querySelectorAll('path.area'), { opacity: 0, duration: 1, delay: .6 });
  gsap.from(el.querySelectorAll('circle.dot'), { scale: 0, transformOrigin: 'center', duration: .4, stagger: .03, delay: .8, ease: 'back.out(2)' });
}

/** حلقة تقدّم */
export function ring(pct: number, color: string, big: string, small: string) {
  const r = 52, c = 2 * Math.PI * r;
  return `<div class="ring"><svg viewBox="0 0 120 120">
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="currentColor" stroke-opacity=".08" stroke-width="10"/>
    <circle class="ring-fg" cx="60" cy="60" r="${r}" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${c}" data-target="${c * (1 - Math.min(100, pct) / 100)}"/>
  </svg><div class="val"><div><b>${big}</b><br><span>${small}</span></div></div></div>`;
}
export function animateRings(root: ParentNode = document) {
  root.querySelectorAll<SVGCircleElement>('.ring-fg').forEach((c) =>
    gsap.to(c, { strokeDashoffset: Number(c.dataset.target), duration: 1.6, ease: 'power3.out', delay: .2 }));
}
