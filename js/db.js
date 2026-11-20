// Доступ к данным. База — Supabase проекта Tropos (раздел pb_*, видит только владелец).
// На компьютере разработчика (127.0.0.1 с ?mock) — тестовые данные в памяти браузера, без сети.
export const SB_URL = "https://evmqihsukrbasnoyaduv.supabase.co";
export const SB_KEY = "sb_publishable_m0mzaiDkpVLo2rBEeKZhIQ_wDY0FM9W"; // публичный ключ, защищён правилами доступа в базе
export const MOCK = /^(127\.0\.0\.1|localhost)$/.test(location.hostname) && /[?&]mock/.test(location.search);

export const sb = MOCK ? null : window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, storageKey: "pb_auth", detectSessionInUrl: false } });

/* ---------- даты ---------- */
export const today = () => new Date().toLocaleDateString("en-CA");
export const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };
export const dayDiff = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 864e5);

/* ---------- запросы: list / ins / upd / del / ups ---------- */
// filters: [["eq","col",v], ["gte","col",v], ["lte",...], ["is","col",null], ["notnull","col"], ["in","col",[...]], ["neq",...]]
function apply(q, filters = []) {
  for (const [op, col, v] of filters) {
    if (op === "notnull") q = q.not(col, "is", null);
    else q = q[op](col, v);
  }
  return q;
}
const fail = (error) => { if (error) throw new Error(error.message || String(error)); };

export async function list(table, filters = [], order = null, limit = 0) {
  if (MOCK) return mock.list(table, filters, order, limit);
  let q = apply(sb.from(table).select("*"), filters);
  if (order) for (const o of [].concat(order)) { const [c, dir] = o.split(" "); q = q.order(c, { ascending: dir !== "desc", nullsFirst: false }); }
  if (limit) q = q.limit(limit);
  const { data, error } = await q; fail(error); return data || [];
}
export async function ins(table, row) {
  if (MOCK) return mock.ins(table, row);
  const { data, error } = await sb.from(table).insert(row).select().single(); fail(error); return data;
}
export async function upd(table, filters, patch) {
  if (MOCK) return mock.upd(table, filters, patch);
  const { error } = await apply(sb.from(table).update(patch), filters); fail(error);
}
export async function del(table, filters) {
  if (MOCK) return mock.del(table, filters);
  const { error } = await apply(sb.from(table).delete(), filters); fail(error);
}
export async function ups(table, row, onConflict) {
  if (MOCK) return mock.ups(table, row, onConflict);
  const { data, error } = await sb.from(table).upsert(row, { onConflict }).select().single(); fail(error); return data;
}

/* ---------- вход ---------- */
export async function session() {
  if (MOCK) return { user: { id: "u1", email: "test@example.com" } };
  const { data } = await sb.auth.getSession(); return data.session;
}
export async function allowed() {
  if (MOCK) return true;
  const { data, error } = await sb.rpc("pb_allowed"); if (error) return false; return !!data;
}
export async function logout() { if (!MOCK) await sb.auth.signOut(); location.hash = "#/"; location.reload(); }

/* ---------- функция pb (уведомления, Claude) ---------- */
export async function fn(body) {
  if (MOCK) return mock.fn(body);
  const s = await session();
  const r = await fetch(SB_URL + "/functions/v1/pb", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + (s?.access_token || "") }, body: JSON.stringify(body) });
  let j = {}; try { j = await r.json(); } catch (e) {}
  if (!r.ok || j.error) throw new Error(j.error || "Сервер не ответил, попробуйте ещё раз");
  return j;
}
/* функция tg проекта Tropos: вход по коду */
export async function tg(body) {
  const r = await fetch(SB_URL + "/functions/v1/tg", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let j = {}; try { j = await r.json(); } catch (e) {}
  if (!r.ok || j.error) throw new Error(j.error || "Сервер не ответил, попробуйте ещё раз");
  return j;
}

/* ---------- тестовые данные (только 127.0.0.1?mock) ---------- */
const mock = (() => {
  const key = "pb_mock";
  let D = {};
  try { D = JSON.parse(localStorage.getItem(key) || "{}"); } catch (e) { D = {}; }
  const save = () => localStorage.setItem(key, JSON.stringify(D));
  const T = (t) => (D[t] = D[t] || []);
  const id = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  const ok = (r, filters) => filters.every(([op, c, v]) => {
    const x = r[c];
    if (op === "eq") return x === v; if (op === "neq") return x !== v;
    if (op === "gte") return x != null && String(x) >= String(v); if (op === "lte") return x != null && String(x) <= String(v);
    if (op === "is") return x == null; if (op === "notnull") return x != null; if (op === "in") return v.includes(x);
    return true;
  });
  const defaults = {
    pb_tasks: { repeat: "", note: "", day: null, area: "личное", priority: 0, in_plan: false, done_at: null, moves: 0, sort: 0 },
    pb_ideas: { status: "new", value: null, feasibility: null, effort: null, check_plan: "", area: "личное", ai_review: "", ai_at: null },
    pb_expenses: { category: "Другое", kind: "личное", note: "" },
    pb_settings: { morning: "08:00", evening: "21:00", tz: "Europe/Moscow", push_on: true, categories: ["Еда", "Кафе", "Транспорт", "Дом", "Здоровье", "Одежда", "Связь", "Подписки", "Подарки", "Развлечения", "Работа", "Другое"], budget: null, weekly_on: true },
    pb_days: { intention: "", mood: null, energy: null, load: null, note: "", win: "" },
    pb_habits: { active: true, sort: 0 },
  };
  const full = (t, row) => ({ id: id(), user_id: "u1", created_at: new Date().toISOString(), ...(defaults[t] || {}), ...row });
  return {
    async list(t, f, order, limit) {
      let rows = T(t).filter((r) => ok(r, f));
      for (const o of [].concat(order || []).reverse()) { const [c, dir] = o.split(" "); rows.sort((a, b) => (a[c] == null) - (b[c] == null) || (String(a[c]) < String(b[c]) ? -1 : String(a[c]) > String(b[c]) ? 1 : 0) * (dir === "desc" ? -1 : 1)); }
      return JSON.parse(JSON.stringify(limit ? rows.slice(0, limit) : rows));
    },
    async ins(t, row) { const r = full(t, row); T(t).push(r); save(); return r; },
    async upd(t, f, p) { T(t).forEach((r) => ok(r, f) && Object.assign(r, p)); save(); },
    async del(t, f) { D[t] = T(t).filter((r) => !ok(r, f)); save(); },
    async ups(t, row, on) { const keys = on.split(","); const ex = T(t).find((r) => keys.every((k) => r[k] === (row[k] ?? "u1"))); if (ex) { Object.assign(ex, row); save(); return ex; } return this.ins(t, row); },
    async fn(b) {
      await new Promise((r) => setTimeout(r, 400));
      if (b.action === "status") return { claude: false };
      if (b.action === "ai") return { answer: "🧪 Тестовый ответ Claude.\n• Здесь будет разбор по вашим записям.\n• С датами и примерами." };
      if (b.action === "vapid") throw new Error("В тестовом режиме уведомления не работают");
      return {};
    },
  };
})();
