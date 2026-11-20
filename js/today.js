// «Сегодня»: главное на день, план, задачи, привычки, быстрые траты.
import { list, ins, upd, del, ups, today, addDays } from "./db.js";
import { $, $$, esc, toast, dLong, plural } from "./ui.js";
import { taskRow, bindTasks, quickAdd, moveSheet } from "./tasks.js";
import { expenseSheet } from "./money.js";
import { S } from "./main.js";

const TROPOS = "https://prav0h.github.io/tropos-site/#/tasks";
/** Рабочие задачи из Tropos, назначенные мне, на сегодня и просроченные. */
async function workTasks(td) {
  const me = await list("profiles", [["eq", "id", S.uid]]).catch(() => []);
  const pid = me[0]?.person_id; if (!pid) return [];
  const end = new Date(td + "T23:59:59").toISOString();
  return list("tasks", [["eq", "assignee", pid], ["neq", "status", "done"], ["lte", "due_at", end]], "due_at").catch(() => []);
}
const streakOf = (days, td) => { const closed = new Set(days.filter((d) => d.closed_at).map((d) => d.day)); let n = 0, d = closed.has(td) ? td : addDays(td, -1); while (closed.has(d)) { n++; d = addDays(d, -1); } return n; };

const hello = () => { const h = new Date().getHours(); return h < 5 ? "Доброй ночи" : h < 12 ? "Доброе утро" : h < 18 ? "Добрый день" : "Добрый вечер"; };

export async function render(main) {
  const td = today();
  const [tasks, late, days, habits, hlog, spent, recent] = await Promise.all([
    list("pb_tasks", [["eq", "day", td]], ["priority desc", "created_at"]),
    list("pb_tasks", [["lte", "day", td], ["is", "done_at", null]], ["day"]).then((r) => r.filter((t) => t.day < td)),
    list("pb_days", [["eq", "day", td]]),
    list("pb_habits", [["eq", "active", true]], ["sort", "created_at"]),
    list("pb_habit_log", [["eq", "day", td]]),
    list("pb_expenses", [["eq", "day", td]]),
    list("pb_days", [["gte", "day", addDays(td, -60)]]),
  ]);
  const streak = streakOf(recent, td);
  const day = days[0] || {};
  const open = tasks.filter((t) => !t.done_at), done = tasks.filter((t) => t.done_at);
  const pct = tasks.length ? Math.round((done.length / tasks.length) * 100) : 0;
  const spentSum = spent.reduce((a, e) => a + +e.amount, 0);
  const planned = !!day.planned_at;

  main.innerHTML = `<div class="top"><div><div class="sub">${hello()}</div><h1>Сегодня</h1><div class="sub">${dLong(td)}</div></div>${streak > 1 ? `<div class="tag hot" style="font-size:13px;padding:5px 10px" title="Дней подряд с закрытыми итогами">🔥 ${streak}</div>` : ""}</div>
    ${tasks.length ? `<div class="card"><div class="row" style="justify-content:space-between;margin-bottom:8px"><b>${done.length} из ${tasks.length} ${plural(tasks.length, "задачи", "задач", "задач")}</b><span class="muted">${pct}%</span></div><div class="progress"><i style="width:${pct}%"></i></div></div>` : ""}
    <div class="card"><label class="f" style="margin-top:0">🎯 Главное на сегодня</label>
      <input id="int" value="${esc(day.intention || "")}" placeholder="Одна вещь, которая сделает день удачным" enterkeyhint="done"></div>
    ${habits.length ? `<h3>Привычки</h3><div class="habits">${habits.map((h) => `<button class="habit${hlog.some((l) => l.habit_id === h.id) ? " on" : ""}" data-h="${h.id}">${hlog.some((l) => l.habit_id === h.id) ? "✓" : "○"} ${esc(h.title)}</button>`).join("")}</div>` : ""}
    ${late.length ? `<h3>Просрочено · ${late.length}</h3><div class="card flat" id="late">${late.map((t) => taskRow(t, td)).join("")}</div>
      <div class="row" style="margin:-2px 0 6px"><button class="btn sm" id="lateAll">Все на сегодня</button><button class="btn sm" id="lateMove">Разобрать по одной</button></div>` : ""}
    <h3>План на день</h3>
    ${quickAdd(() => ({ day: td, in_plan: !planned || new Date().getHours() < 12 }), () => render(main), "Что нужно сделать сегодня?")}
    <div class="card flat" id="list">${open.map((t) => taskRow(t, td)).join("") || `<div class="empty">${done.length ? "Всё сделано! 🎉" : "Добавьте задачи на сегодня"}</div>`}</div>
    ${open.length && !planned ? `<button class="btn wide" id="fix">✅ Утвердить план дня</button><p class="hint center">Вечером сравним план с тем, что получилось</p>` : planned ? `<p class="hint center">План утверждён · вечером — итоги</p>` : ""}
    ${done.length ? `<h3>Сделано · ${done.length}</h3><div class="card flat" id="done">${done.map((t) => taskRow(t, td)).join("")}</div>` : ""}
    <div id="work"></div>
    <h3>Деньги сегодня</h3>
    <div class="card row" style="justify-content:space-between"><div><b>${spentSum ? Math.round(spentSum).toLocaleString("ru-RU") + " ₽" : "Трат нет"}</b><div class="small muted">${spent.length ? `${spent.length} ${plural(spent.length, "запись", "записи", "записей")}` : "Записывайте сразу — так точнее"}</div></div><button class="btn pri sm" id="spend">＋ Трата</button></div>
    <div class="row" style="margin-top:14px"><a class="btn grow" href="#/evening">🌙 Итоги дня</a><a class="btn grow" href="#/journal">📓 Дневник</a></div>`;

  const re = () => render(main);
  bindTasks($("#list", main), tasks, re);
  $("#done", main) && bindTasks($("#done", main), tasks, re);
  $("#late", main) && bindTasks($("#late", main), late, re);
  const intInp = $("#int", main);
  const saveInt = async () => { const v = intInp.value.trim(); if (v === (day.intention || "")) return; try { await ups("pb_days", { day: td, intention: v }, "user_id,day"); day.intention = v; toast("Записано"); } catch (e) { toast(e.message, true); } };
  intInp.onchange = saveInt; intInp.onkeydown = (e) => e.key === "Enter" && intInp.blur();
  $$("[data-h]", main).forEach((b) => (b.onclick = async () => {
    const on = !b.classList.contains("on");
    b.classList.toggle("on", on); b.textContent = (on ? "✓ " : "○ ") + b.textContent.slice(2);
    try { if (on) await ins("pb_habit_log", { habit_id: b.dataset.h, day: td }); else await del("pb_habit_log", [["eq", "habit_id", b.dataset.h], ["eq", "day", td]]); }
    catch (e) { toast(e.message, true); }
  }));
  $("#lateAll", main) && ($("#lateAll", main).onclick = async () => { for (const t of late) await upd("pb_tasks", [["eq", "id", t.id]], { day: td }); toast("Перенесено на сегодня"); re(); });
  $("#lateMove", main) && ($("#lateMove", main).onclick = () => { const t = late[0]; moveSheet(t, re, "Что делаем с задачей?"); });
  $("#fix", main) && ($("#fix", main).onclick = async () => {
    try {
      for (const t of open) if (!t.in_plan) await upd("pb_tasks", [["eq", "id", t.id]], { in_plan: true });
      await ups("pb_days", { day: td, planned_at: new Date().toISOString() }, "user_id,day");
      toast("План на день утверждён 💪"); re();
    } catch (e) { toast(e.message, true); }
  });
  $("#spend", main).onclick = () => expenseSheet(null, re);
  workTasks(td).then((w) => {
    const box = $("#work", main); if (!box || !w.length) return;
    const fmt = (t) => { const d = new Date(t.due_at), day = d.toLocaleDateString("en-CA"); return day < td ? `<span class="tag bad">просрочено · ${day.slice(8, 10)}.${day.slice(5, 7)}</span>` : d.getHours() || d.getMinutes() ? d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "сегодня"; };
    box.innerHTML = `<h3>💼 Работа в Tropos · ${w.length}</h3><div class="card flat">${w.slice(0, 12).map((t) => `<a class="li" href="${TROPOS}" target="_blank" rel="noopener" style="color:inherit"><span class="ic">${t.status === "doing" ? "▶️" : "▫️"}</span><div class="tx"><div>${esc(t.title)}</div><div class="s">${fmt(t)}</div></div><span class="ar">›</span></a>`).join("")}</div>`;
  });
}
