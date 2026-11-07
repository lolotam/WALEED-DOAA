import * as webpush from 'web-push';
import { sqlite } from './db.js';

const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
export const pushEnabled = !!(pub && priv);
if (pushEnabled) webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', pub!, priv!);

export function saveSubscription(sub: { endpoint: string }) {
  sqlite.prepare('INSERT INTO push_subs(endpoint,json) VALUES (?,?) ON CONFLICT(endpoint) DO UPDATE SET json=excluded.json')
    .run(sub.endpoint, JSON.stringify(sub));
}

/** إشعار ويب لكل الأجهزة المشتركة */
export async function pushAll(title: string, body: string, url = '/') {
  if (!pushEnabled) return;
  const subs = sqlite.prepare('SELECT endpoint, json FROM push_subs').all() as { endpoint: string; json: string }[];
  await Promise.all(subs.map(async (s) => {
    try { await webpush.sendNotification(JSON.parse(s.json), JSON.stringify({ title, body, url })); }
    catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) sqlite.prepare('DELETE FROM push_subs WHERE endpoint=?').run(s.endpoint);
    }
  }));
}
