// Кайрос: файлы приложения хранятся на телефоне — запуск мгновенный и без интернета.
// Версия меняется при каждой выкладке (tools/site.py) → телефон скачивает новые файлы один раз.
const CACHE = "kairos-0d1fccc";
const ASSETS = ["./", "index.html", "manifest.webmanifest", "css/app.css", "js/ask.js", "js/calendar.js", "js/db.js", "js/evening.js", "js/goals.js", "js/habits.js", "js/ideas.js", "js/inbox.js", "js/journal.js", "js/login.js", "js/main.js", "js/model.js", "js/money.js", "js/more.js", "js/parse.js", "js/quick.js", "js/review.js", "js/search.js", "js/settings.js", "js/siri.js", "js/store.js", "js/tasks.js", "js/today.js", "js/ui.js", "js/voice.js", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];
const CDN = /^(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)$/;
self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((a) => new Request(a, { cache: "reload" })))).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET") return;
  if (u.origin === location.origin) {
    // сначала из памяти телефона; страница целиком — всегда index.html
    const key = r.mode === "navigate" ? "index.html" : u.pathname.replace(/^.*?\/(?=(js|css|icons)\/|index\.html|manifest)/, "");
    e.respondWith(caches.open(CACHE).then((c) => c.match(key, { ignoreSearch: true }).then((hit) => hit || fetch(r).then((res) => { if (res.ok && r.mode !== "navigate") c.put(r, res.clone()); return res; }))));
  } else if (CDN.test(u.hostname)) {
    e.respondWith(caches.open(CACHE + "-cdn").then((c) => c.match(r).then((hit) => hit || fetch(r).then((res) => { if (res.ok || res.type === "opaque") c.put(r, res.clone()); return res; }))));
  }
});
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: "Кайрос", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Кайрос", { body: d.body || "", tag: d.tag || "kairos", icon: "icons/icon-192.png", badge: "icons/icon-192.png", data: { url: d.url || "./" } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "./";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
    for (const c of cs) if ("focus" in c) { c.postMessage({ url }); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
