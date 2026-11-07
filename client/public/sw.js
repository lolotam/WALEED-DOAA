// Service Worker: كاش بسيط للملفات + إشعارات الويب
const CACHE = 'wd-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

// الشبكة أولًا، والكاش لو مفيش نت (للصفحات والملفات بس — مش الـ API)
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api') || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request)),
  );
});

self.addEventListener('push', (e) => {
  let d = { title: 'وليد & دعاء', body: '', url: '/' };
  try { d = { ...d, ...e.data.json() }; } catch { /* ignore */ }
  e.waitUntil(self.registration.showNotification(d.title, {
    body: d.body, icon: '/icon-192.png', badge: '/icon-192.png', dir: 'rtl', lang: 'ar', data: { url: d.url },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.openWindow(e.notification.data?.url || '/'));
});
