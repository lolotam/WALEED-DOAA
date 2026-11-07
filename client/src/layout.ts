import './style.css';
import { gsap } from 'gsap';
import { api } from './api';

const LINKS = [
  { href: '/', file: 'index', ic: '📊', label: 'الرئيسية' },
  { href: '/meals.html', file: 'meals', ic: '🍽️', label: 'الوجبات' },
  { href: '/log.html', file: 'log', ic: '✍️', label: 'تسجيل' },
  { href: '/pantry.html', file: 'pantry', ic: '🧺', label: 'المخزن' },
  { href: '/history.html', file: 'history', ic: '📈', label: 'السجل' },
  { href: '/settings.html', file: 'settings', ic: '⚙️', label: 'الإعدادات' },
];

export function applyTheme() {
  let t: string | null = null;
  try { t = localStorage.getItem('theme'); } catch { /* ignore */ }
  document.documentElement.dataset.theme = t || 'dark';
}
applyTheme();

/** يبني الهيدر والنافيجيشن ويتأكد من تسجيل الدخول */
export async function initLayout(page: string) {
  const header = document.createElement('header');
  header.className = 'topbar';
  header.innerHTML = `
    <a class="brand" href="/"><span class="dots"><i></i><i></i></span> وليد & دعاء</a>
    <button class="icon-btn" id="themeBtn" aria-label="تغيير الوضع">🌓</button>`;
  const nav = document.createElement('nav');
  nav.className = 'nav';
  nav.innerHTML = LINKS.map((l) =>
    `<a href="${l.href}" class="${l.file === page ? 'active' : ''}"><span class="ic">${l.ic}</span><span>${l.label}</span></a>`).join('');
  document.body.prepend(nav);
  document.body.prepend(header);

  header.querySelector('#themeBtn')!.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch { /* ignore */ }
  });

  gsap.from(header, { y: -20, opacity: 0, duration: .5, ease: 'power2.out' });
  registerSW();
  return api('/me');
}

function registerSW() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
}

export function toast(msg: string) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  gsap.fromTo(el, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: .35, ease: 'back.out(1.7)' });
  gsap.to(el, { y: 20, opacity: 0, delay: 2.2, duration: .3, onComplete: () => el.remove() });
}

/** دخول الكروت بأنيميشن متتابع */
export function revealCards(root: ParentNode = document) {
  const cards = root.querySelectorAll('.card, .opt');
  gsap.fromTo(cards, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: .6, stagger: .06, ease: 'power3.out', clearProps: 'transform' });
}

/** عدّاد أرقام */
export function countUp(el: Element, to: number, decimals = 0, suffix = '') {
  const o = { v: 0 };
  gsap.to(o, { v: to, duration: 1.2, ease: 'power2.out', onUpdate: () => { el.textContent = o.v.toFixed(decimals) + suffix; } });
}

export function animateBars(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('.bar > i[data-w]').forEach((b) => {
    gsap.to(b, { width: `${b.dataset.w}%`, duration: 1.2, ease: 'power3.out', delay: .2 });
  });
}

export { gsap };
