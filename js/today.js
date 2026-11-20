// «Сегодня»: главное на день, план, задачи, привычки, быстрые траты.
import { list, ins, upd, del, ups, today } from "./db.js";
import { $, $$, esc, toast, dLong, plural } from "./ui.js";
import { taskRow, bindTasks, quickAdd, moveSheet } from "./tasks.js";
import { expenseSheet } from "./money.js";

const hello = () => { const h = new Date().getHours(); return h < 5 ? "Доброй ночи" : h < 12 ? "Доброе утро" : h < 18 ? "Добрый день" : "Добрый вечер"; };

export async function render(main) {
  const td = today();
  const [tasks, late, days, habits, hlog, spent] = await Promise.all([
    list("pb_tasks", [["eq", "day", td]], ["priority desc", "created_at"]),
    list("pb_tasks", [["lte", "day", td], ["is", "done_at", null]], ["day"]).then((r) => r.filter((t) => t.day < td)),
    list("pb_days", [["eq", "day", td]]),
    list("pb_habits", [["eq", "active", true]], ["sort", "created_at"]),
    list("pb_habit_log", [["eq", "day", td]]),
    list("pb_expenses", [["eq", "day", td]]),
  ]);
  const day = days[0] || {};
  const open = tasks.filter((t) => !t.done_at), done = tasks.filter((t) => t.done_at);
  const pct = tasks.length ? Math.round((done.length / tasks.length) * 100) : 0;
  const spentSum = spent.reduce((a, e) => a + +e.amount, 0);
  const planned = !!day.planned_at;

  main.innerHTML = `<div class="top"><div><div class="sub">${hello()}</div><h1>Сегодня</h1><div class="sub">${dLong(td)}</div></div></div>
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
}
