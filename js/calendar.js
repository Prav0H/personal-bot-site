// «Календарь»: месяц с точками, расписание выбранного дня, напоминания; события с напоминанием.
import { rows, add, patch, remove } from "./store.js";
import { today, addDays } from "./db.js";
import { $, $$, esc, toast, sheet, confirmBox, dLong, rub } from "./ui.js";
import { REMIND, remindAt, remindLabel, scheduled, quad } from "./model.js";
import { taskSheet } from "./tasks.js";

const MON = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

export function eventSheet(e0, onChange) {
  const isNew = !e0?.id, e = { title: "", day: today(), time: "", note: "", ...e0 };
  const cur = e.remind_at ? (() => { const m = Math.round((new Date(e.day + "T" + (e.time || "09:00") + ":00") - new Date(e.remind_at)) / 6e4); return ["0", "15", "60"].includes(String(m)) ? String(m) : "1440"; })() : isNew ? "15" : "";
  const s = sheet(`<h2>${isNew ? "Новое событие" : "Событие"}</h2>
    <input id="et" placeholder="Звонок риелтору, встреча, вылет…" value="${esc(e.title)}">
    <div class="row2"><div><label class="f">Дата</label><input type="date" id="ed" value="${e.day}"></div><div><label class="f">Время</label><input type="time" id="em" value="${e.time}"></div></div>
    <label class="f">🔔 Напомнить</label><select id="er">${REMIND.filter(([v]) => v !== "m10").map(([v, l]) => `<option value="${v}" ${v === cur ? "selected" : ""}>${l}</option>`).join("")}</select>
    <label class="f">Заметка</label><input id="en" value="${esc(e.note)}" placeholder="Адрес, ссылка…">
    <button class="btn pri wide" id="es" style="margin-top:12px">${isNew ? "Добавить" : "Сохранить"}</button>
    ${isNew ? "" : `<button class="btn danger wide" id="ex" style="margin-top:8px">Удалить</button>`}`);
  const el = s.el;
  if (isNew) setTimeout(() => $("#et", el).focus(), 50);
  $("#es", el).onclick = () => {
    const title = $("#et", el).value.trim(); if (!title) return toast("Название события", true);
    const day = $("#ed", el).value || today(), time = $("#em", el).value, ra = remindAt(day, time, $("#er", el).value);
    const row = { title, day, time, note: $("#en", el).value.trim(), remind_at: ra, reminded: false };
    if (isNew) add("pb_events", row); else patch("pb_events", e.id, row);
    s.close(); toast(ra ? `Напомню ${remindLabel(ra)}` : "Сохранено"); onChange && onChange();
  };
  if (!isNew) $("#ex", el).onclick = async () => { if (await confirmBox("Удалить событие?", "Удалить")) { remove("pb_events", e.id); s.close(); onChange && onChange(); } };
}

let month = null, sel = null;
export function render(main, arg) {
  const td = today();
  if (arg && /^\d{4}-\d{2}-\d{2}$/.test(arg)) { sel = arg; month = arg.slice(0, 7); }
  sel = sel || td; month = month || td.slice(0, 7);
  const tasks = rows("pb_tasks"), events = rows("pb_events"), exp = rows("pb_expenses").filter((x) => x.planned), habits = rows("pb_habits").filter((h) => h.active !== false);
  const first = month + "-01", wd = (new Date(first + "T12:00:00").getDay() + 6) % 7;
  const start = addDays(first, -wd), cells = []; for (let i = 0; i < 42; i++) cells.push(addDays(start, i));
  const dots = (d) => {
    const g = tasks.some((t) => t.day === d && !t.done_at && t.time) || events.some((e) => e.day === d);
    const t = tasks.some((x) => x.day === d && !x.done_at && quad(x, td) !== 4 && !x.time) || exp.some((x) => x.day === d);
    return g || t ? `<span class="ds">${g ? "<i></i>" : ""}${t ? '<i class="t"></i>' : ""}</span>` : "";
  };
  const dayItems = [
    ...habits.filter((h) => scheduled(h, sel) && h.time).map((h) => ({ at: h.time, title: h.title, sub: "привычка", cls: "" })),
    ...events.filter((e) => e.day === sel).map((e) => ({ at: e.time, title: e.title, sub: e.remind_at ? "🔔 " + remindLabel(e.remind_at) : "событие", cls: "m", ev: e.id })),
    ...tasks.filter((t) => t.day === sel).map((t) => ({ at: t.time, title: t.title, sub: t.done_at ? "сделано" : "срок", cls: t.time ? "" : "t", task: t.id, done: !!t.done_at })),
    ...exp.filter((x) => x.day === sel).map((x) => ({ at: "", title: (x.title || x.category) + " · " + rub(x.amount), sub: "платёж", cls: "t" })),
  ].sort((a, b) => (a.at || "99").localeCompare(b.at || "99"));
  const now = new Date().toISOString();
  const rem = [...tasks.filter((t) => t.remind_at && !t.done_at && t.remind_at > now).map((t) => ({ ...t, kind: "task" })), ...events.filter((e) => e.remind_at && e.remind_at > now).map((e) => ({ ...e, kind: "event" }))].sort((a, b) => a.remind_at.localeCompare(b.remind_at)).slice(0, 12);
  const [y, m] = month.split("-").map(Number);

  main.innerHTML = `<a class="back" href="#/today">‹ Сегодня</a>
    <div class="top"><h1>${MON[m - 1]} ${y}</h1><div class="row"><button class="btn sm" id="pm">‹</button><button class="btn sm" id="nm">›</button></div></div>
    <div class="cal">${["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => `<div class="h">${d}</div>`).join("")}${cells.map((d) => `<button data-d="${d}" class="${d.slice(0, 7) !== month ? "out" : ""}${d === sel ? " sel" : ""}${d === td ? " today" : ""}">${+d.slice(8)}${dots(d)}</button>`).join("")}</div>
    <p class="hint center"><span style="color:var(--gold)">●</span> дела и события по времени · <span style="color:var(--terra)">●</span> сроки и платежи</p>
    <div class="row" style="justify-content:space-between"><div class="cap">${dLong(sel)}</div><button class="btn sm" id="ae">＋ Событие</button></div>
    <div class="card flat">${dayItems.map((i) => `<div class="li" ${i.ev ? `data-ev="${i.ev}"` : i.task ? `data-task="${i.task}"` : ""}><span class="small muted" style="width:38px">${i.at || ""}</span><span class="bar-l ${i.cls}"></span><div class="tx"><div${i.done ? ' style="text-decoration:line-through;color:var(--dim)"' : ""}>${esc(i.title)}</div><div class="s">${esc(i.sub)}</div></div></div>`).join("") || `<div class="empty">Пусто. Свободный день.</div>`}</div>
    <div class="cap">Напоминания</div>
    <div class="card flat">${rem.map((r) => `<div class="li" data-${r.kind === "task" ? "task" : "ev"}="${r.id}"><span class="small muted" style="width:52px">${esc(remindLabel(r.remind_at).replace(" в ", "<br>"))}</span><span class="bar-l t"></span><div class="tx"><div>${esc(r.title)}</div><div class="s">${r.kind === "task" ? "задача" : "событие"}</div></div></div>`).join("") || `<div class="empty">Напоминаний нет. Скажите: «напомни завтра в 10 оплатить аренду».</div>`}</div>`;
  const re = () => render(main);
  const shift = (n) => { const d = new Date(month + "-15T12:00:00"); d.setMonth(d.getMonth() + n); month = d.toLocaleDateString("en-CA").slice(0, 7); re(); };
  $("#pm", main).onclick = () => shift(-1); $("#nm", main).onclick = () => shift(1);
  $$("[data-d]", main).forEach((b) => (b.onclick = () => { sel = b.dataset.d; if (sel.slice(0, 7) !== month) month = sel.slice(0, 7); re(); }));
  $("#ae", main).onclick = () => eventSheet({ day: sel }, re);
  $$("[data-ev]", main).forEach((b) => (b.onclick = () => eventSheet(rows("pb_events").find((x) => x.id === b.dataset.ev), re)));
  $$("[data-task]", main).forEach((b) => (b.onclick = () => taskSheet(rows("pb_tasks").find((x) => x.id === b.dataset.task), re)));
}
