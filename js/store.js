// Хранилище «сначала телефон»: все записи лежат в памяти и в localStorage, экран рисуется мгновенно.
// Изменения сразу видны на экране и отправляются в базу в фоне (очередь переживает закрытие и отсутствие сети).
import { sb, MOCK } from "./db.js";

export const TABLES = ["pb_tasks", "pb_moves", "pb_days", "pb_expenses", "pb_ideas", "pb_habits", "pb_habit_log", "pb_settings", "pb_goals", "pb_events", "pb_inbox", "pb_ai"];
const KEY = { pb_days: ["day"], pb_habit_log: ["habit_id", "day"], pb_settings: ["user_id"] };
const keyOf = (t) => KEY[t] || ["id"];
const CONFLICT = { pb_days: "user_id,day", pb_habit_log: "habit_id,day", pb_settings: "user_id" };
const conflict = (t) => CONFLICT[t] || "id";
const same = (t, a, b) => keyOf(t).every((k) => a[k] === b[k]);
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

let uid = null, D = {}, Q = [], listeners = new Set(), flushing = false, lastSync = 0;
const cacheKey = () => "pb_cache_" + uid, queueKey = () => "pb_queue_" + uid;
const save = () => { try { localStorage.setItem(cacheKey(), JSON.stringify(D)); localStorage.setItem(queueKey(), JSON.stringify(Q)); } catch (e) { /* переполнение — данные всё равно в базе */ } };
const emit = (kind) => listeners.forEach((f) => { try { f(kind); } catch (e) { console.error(e); } });

export const onChange = (f) => (listeners.add(f), () => listeners.delete(f));
export const rows = (t) => D[t] || (D[t] = []);
export const get = (t, id) => rows(t).find((r) => r.id === id);
export const settings = () => rows("pb_settings")[0] || {};
export const pending = () => Q.length;
export const syncedAt = () => lastSync;

/** Открыть хранилище пользователя: сразу из кэша, затем свежие данные из базы. */
export async function init(user) {
  uid = user;
  try { D = JSON.parse(localStorage.getItem(cacheKey()) || "{}"); Q = JSON.parse(localStorage.getItem(queueKey()) || "[]"); } catch (e) { D = {}; Q = []; }
  TABLES.forEach(rows);
  const fresh = !rows("pb_settings").length;
  const p = sync();
  if (fresh) await p; // первый запуск на устройстве — дождаться данных
  if (!rows("pb_settings").length) put("pb_settings", { user_id: uid });
  addEventListener("online", () => flush());
  // вернулись в приложение (например, после записи через Siri) — сразу свежие данные; пока открыто — раз в 30 с
  const pull = () => { if (!document.hidden && Date.now() - lastSync > 3e3) sync(); };
  document.addEventListener("visibilitychange", pull);
  addEventListener("focus", pull);
  addEventListener("pageshow", pull);
  setInterval(() => { if (Q.length) flush(); if (!document.hidden && Date.now() - lastSync > 30e3) sync(); }, 10e3);
}

/** Скачать всё из базы и наложить ещё не отправленные изменения. */
export async function sync() {
  if (MOCK || !uid) return;
  await flush();
  try {
    const res = await Promise.all(TABLES.map((t) => {
      let q = sb.from(t).select("*");
      if (t === "pb_ai") q = q.order("created_at", { ascending: false }).limit(40);
      if (t === "pb_moves") q = q.order("created_at", { ascending: false }).limit(1500);
      return q;
    }));
    res.forEach(({ data, error }, i) => { if (!error && data) D[TABLES[i]] = data; });
    for (const op of Q) applyLocal(op); // неотправленное поверх
    lastSync = Date.now(); save(); emit("remote");
  } catch (e) { console.warn("sync", e); }
}

function applyLocal(op) {
  const list = rows(op.t);
  const i = list.findIndex((r) => same(op.t, r, op.row));
  if (op.op === "del") { if (i >= 0) list.splice(i, 1); }
  else if (i >= 0) list[i] = { ...list[i], ...op.row }; else list.push({ ...op.row });
}

async function flush() {
  if (MOCK || flushing || !Q.length || !navigator.onLine) return;
  flushing = true;
  try {
    while (Q.length) {
      const op = Q[0];
      let r;
      if (op.op === "del") { let q = sb.from(op.t).delete(); for (const k of keyOf(op.t)) q = q.eq(k, op.row[k]); r = await q; }
      else r = await sb.from(op.t).upsert(op.row, { onConflict: conflict(op.t) });
      if (r.error) {
        if (/JWT|auth|401/i.test(r.error.message)) break; // войдёт заново — отправим потом
        console.error("sync drop", op, r.error); // ошибка данных — не блокируем очередь
      }
      Q.shift(); save();
    }
  } catch (e) { console.warn("flush", e); } finally { flushing = false; }
}

function enqueue(op) { applyLocal(op); if (!MOCK) Q.push(op); save(); emit("local"); flush().then(() => emit("local")); }

/** Добавить или заменить строку целиком (ключ — id или составной). */
export function put(t, row) {
  const full = { user_id: uid, ...row };
  if (keyOf(t)[0] === "id" && !full.id) full.id = uuid();
  if (!full.created_at && t !== "pb_days" && t !== "pb_habit_log" && t !== "pb_settings") full.created_at = new Date().toISOString();
  const old = rows(t).find((r) => same(t, r, full));
  enqueue({ op: "put", t, row: old ? { ...old, ...full } : full });
  return rows(t).find((r) => same(t, r, full));
}
export const add = (t, row) => put(t, row);
export function patch(t, idOrRow, p) {
  const match = typeof idOrRow === "string" ? { id: idOrRow } : idOrRow;
  const old = rows(t).find((r) => same(t, r, match));
  if (!old && t !== "pb_days") return null;
  return put(t, { ...(old || match), ...p });
}
export function remove(t, idOrRow) {
  const match = typeof idOrRow === "string" ? { id: idOrRow } : idOrRow;
  const old = rows(t).find((r) => same(t, r, match));
  if (old) enqueue({ op: "del", t, row: old });
}
export const setSettings = (p) => put("pb_settings", { ...settings(), ...p, user_id: uid, updated_at: new Date().toISOString() });

/* ---------- удобные выборки ---------- */
export const day = (d) => rows("pb_days").find((x) => x.day === d) || { day: d };
export const setDay = (d, p) => put("pb_days", { ...day(d), ...p, day: d });
export const habitDone = (hid, d) => rows("pb_habit_log").some((l) => l.habit_id === hid && l.day === d);
export function toggleHabit(hid, d) { if (habitDone(hid, d)) remove("pb_habit_log", { habit_id: hid, day: d }); else put("pb_habit_log", { habit_id: hid, day: d }); }
