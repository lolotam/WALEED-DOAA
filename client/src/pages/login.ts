import '../style.css';
import { gsap } from 'gsap';
import { applyTheme } from '../layout';

applyTheme();
const app = document.getElementById('app')!;
app.className = 'login-wrap';
app.innerHTML = `
  <form class="login card" id="f">
    <div class="logo">💚🩷</div>
    <h1>وليد & دعاء</h1>
    <p class="muted">رحلتنا للوزن الصحي — مع بعض</p>
    <input class="input" type="password" name="password" placeholder="كلمة السر" autocomplete="current-password" required autofocus>
    <button class="btn primary block">دخول</button>
    <p class="muted small" id="err"></p>
  </form>`;

gsap.from('.login > *', { y: 20, opacity: 0, duration: .6, stagger: .08, ease: 'power3.out' });
gsap.to('.logo', { scale: 1.08, repeat: -1, yoyo: true, duration: 1.1, ease: 'sine.inOut' });

document.getElementById('f')!.addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = new FormData(e.target as HTMLFormElement).get('password');
  const res = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
  if (res.ok) { location.href = '/'; return; }
  const err = document.getElementById('err')!;
  err.textContent = 'كلمة السر غلط';
  gsap.fromTo('#f', { x: -10 }, { x: 0, duration: .5, ease: 'elastic.out(1, .3)' });
});
