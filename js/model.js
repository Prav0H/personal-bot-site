// Общие правила: квадранты матрицы, сортировка по сроку, повторы, напоминания, цели, привычки, деньги.
import { rows, settings } from "./store.js";
import { today, addDays } from "./db.js";

export const QUAD = [null, { k: 1, t: "Срочное важное", s: "делать сейчас", cls: "q1" }, { k: 2, t: "Важное несрочное", s: "планировать", cls: "q2" }, { k: 3, t: "Срочное неважное", s: "быстро или упростить", cls: "q3" }, { k: 4, t: "Несрочное неважное", s: "кандидаты на удаление", cls: "q4" }];
/** Срочно — если отмечено или срок завтра/сегодня/просрочен. */
// priority = 2 — квадрант выбран вручную: срок больше не делает задачу срочной сам.
export const isUrgent = (t, td = today()) => !!t.urgent || (t.priority !== 2 && !!t.day && t.day <= addDays(td, 1) && !t.done_at);
export const quad = (t, td) => (t.important ? (isUrgent(t, td) ? 1 : 2) : isUrgent(t, td) ? 3 : 4);
export const quadFlags = (q) => ({ important: q === 1 || q === 2, urgent: q === 1 || q === 3, priority: 2 });
/** Сортировка по дедлайну: раньше — выше; без срока — в конце. */
export const byDeadline = (a, b) => (a.day || "9999") .localeCompare(b.day || "9999") || (a.time || "99").localeCompare(b.time || "99") || String(a.created_at).localeCompare(String(b.created_at));

export const REPEAT = [["", "Нет"], ["daily", "Каждый день"], ["weekdays", "По будням"], ["weekly", "Раз в неделю"], ["monthly", "Раз в месяц"]];
export function nextDay(day, repeat) {
  const d = new Date(day + "T12:00:00");
  if (repeat === "daily") d.setDate(d.getDate() + 1);
  else if (repeat === "weekly") d.setDate(d.getDate() + 7);
  else if (repeat === "monthly") d.setMonth(d.getMonth() + 1);
  else if (repeat === "weekdays") { do d.setDate(d.getDate() + 1); while (d.getDay() === 0 || d.getDay() === 6); }
  else return null;
  return d.toLocaleDateString("en-CA");
}
export const REMIND = [["", "Не напоминать"], ["0", "В момент"], ["15", "За 15 минут"], ["60", "За час"], ["1440", "За день, в 18:00"], ["m10", "Утром в 10:00"]];
/** Время напоминания (ISO) по дате, времени и варианту. */
export function remindAt(day, time, opt) {
  if (!day || opt === "" || opt == null) return null;
  if (opt === "1440") { const d = new Date(addDays(day, -1) + "T18:00:00"); return d.toISOString(); }
  if (opt === "m10") return new Date(day + "T10:00:00").toISOString();
  const d = new Date(day + "T" + (time || "09:00") + ":00"); d.setMinutes(d.getMinutes() - +opt); return d.toISOString();
}
export function remindLabel(iso, td = today()) {
  if (!iso) return "";
  const d = new Date(iso), day = d.toLocaleDateString("en-CA"), tm = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return (day === td ? "сегодня" : day === addDays(td, 1) ? "завтра" : `${day.slice(8, 10)}.${day.slice(5, 7)}`) + " в " + tm;
}

/* ---------- цели ---------- */
export function goalStats(g) {
  const tasks = rows("pb_tasks").filter((t) => t.goal_id === g.id);
  const done = tasks.filter((t) => t.done_at).length;
  const spent = rows("pb_expenses").filter((e) => e.goal_id === g.id && !e.planned).reduce((a, e) => a + +e.amount, 0);
  const left = g.due ? Math.round((new Date(g.due + "T12:00:00") - new Date(today() + "T12:00:00")) / 864e5) : null;
  const ms = g.milestones || [];
  const steps = tasks.length || ms.length, stepsDone = tasks.length ? done : ms.filter((m) => m.done).length;
  return { tasks, done, spent, left, steps, stepsDone, pct: steps ? stepsDone / steps : 0 };
}
export const goalName = (id) => rows("pb_goals").find((g) => g.id === id)?.title || "";

/* ---------- привычки ---------- */
const DAYNAMES = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
export const wdOf = (iso) => new Date(iso + "T12:00:00").getDay();
export const scheduled = (h, iso) => (h.days || [0, 1, 2, 3, 4, 5, 6]).includes(wdOf(iso));
export function scheduleText(h) {
  const d = h.days || [0, 1, 2, 3, 4, 5, 6];
  const s = d.length === 7 ? "каждый день" : d.length === 5 && !d.includes(0) && !d.includes(6) ? "будни" : [1, 2, 3, 4, 5, 6, 0].filter((x) => d.includes(x)).map((x) => DAYNAMES[x]).join(" ");
  return [s, h.time, h.minutes ? h.minutes + " минут" : ""].filter(Boolean).join(" · ");
}
export function habitStreak(h, td = today()) {
  const log = new Set(rows("pb_habit_log").filter((l) => l.habit_id === h.id).map((l) => l.day));
  let n = 0, d = log.has(td) ? td : addDays(td, -1), guard = 0;
  while (guard++ < 400) { if (!scheduled(h, d)) { d = addDays(d, -1); continue; } if (!log.has(d)) break; n++; d = addDays(d, -1); }
  const d7 = (h.days || []).length < 7;
  return d7 && n >= 3 ? `${Math.floor(n / Math.max(1, (h.days || []).length))} нед.` : n ? `${n} ${n % 10 === 1 && n % 100 !== 11 ? "день" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "дня" : "дней"}` : "";
}

/* ---------- деньги ---------- */
export const CATS_DEFAULT = ["Еда", "Дорога", "Жильё", "Связь и подписки", "Здоровье и спорт", "Покупки", "Отдых", "Образование", "Подарки", "В бизнес", "Целевые", "Прочее"];
export const cats = () => { const c = settings().categories; return Array.isArray(c) && c.length ? c : CATS_DEFAULT; };
export const sum = (r) => r.reduce((a, e) => a + +e.amount, 0);
export function balanceNow() {
  const s = settings();
  if (s.balance == null) return null;
  return +s.balance - sum(rows("pb_expenses").filter((e) => !e.planned && s.balance_at && e.day > s.balance_at));
}
