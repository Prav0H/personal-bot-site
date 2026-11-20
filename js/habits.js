// «Привычки»: список и отметки за 7 дней.
import { list, ins, upd, del, today, addDays } from "./db.js";
import { $, $$, esc, toast, confirmBox, wd } from "./ui.js";

export async function render(main) {
  const td = today(), from = addDays(td, -6);
  const [habits, log] = await Promise.all([list("pb_habits", [], ["sort", "created_at"]), list("pb_habit_log", [["gte", "day", from]])]);
  const act = habits.filter((h) => h.active), off = habits.filter((h) => !h.active);
  const days = []; for (let d = from; d <= td; d = addDays(d, 1)) days.push(d);
  const streak = (h) => { let n = 0; for (let d = td; log.some((l) => l.habit_id === h.id && l.day === d); d = addDays(d, -1)) n++; return n; };
  main.innerHTML = `<div class="top"><div><a href="#/more" class="small">← Ещё</a><h1>Привычки</h1><div class="sub">Отмечаются на экране «Сегодня»</div></div></div>
    <form class="add" id="ha"><input placeholder="Например: зарядка, 2 л воды, без сахара" autocomplete="off"><button class="btn pri">＋</button></form>
    ${act.length ? `<div class="card"><div class="hgrid"><span></span>${days.map((d) => `<span class="d">${wd(d)}</span>`).join("")}${act.map((h) => `<span>${esc(h.title)}${streak(h) > 1 ? ` <span class="small" style="color:var(--accent)">🔥${streak(h)}</span>` : ""}</span>${days.map((d) => `<button data-h="${h.id}" data-d="${d}" class="${log.some((l) => l.habit_id === h.id && l.day === d) ? "on" : ""}"></button>`).join("")}`).join("")}</div>
      <p class="hint">Нажмите на клетку, чтобы отметить или снять отметку за прошлый день</p></div>
      <h3>Управление</h3><div class="card flat">${act.map((h) => `<div class="li"><div class="tx">${esc(h.title)}</div><button class="btn sm" data-off="${h.id}">Пауза</button><button class="btn sm" data-del="${h.id}" style="color:var(--bad)">✕</button></div>`).join("")}</div>`
      : `<div class="empty">Добавьте 1–3 привычки, которые хотите отслеживать каждый день</div>`}
    ${off.length ? `<h3>На паузе</h3><div class="card flat">${off.map((h) => `<div class="li"><div class="tx muted">${esc(h.title)}</div><button class="btn sm" data-on="${h.id}">Вернуть</button></div>`).join("")}</div>` : ""}`;
  const re = () => render(main);
  $("#ha", main).onsubmit = async (e) => { e.preventDefault(); const t = $("input", e.target).value.trim(); if (!t) return; await ins("pb_habits", { title: t, sort: habits.length }); re(); };
  $$("[data-d]", main).forEach((b) => (b.onclick = async () => {
    const on = !b.classList.contains("on"); b.classList.toggle("on", on);
    try { if (on) await ins("pb_habit_log", { habit_id: b.dataset.h, day: b.dataset.d }); else await del("pb_habit_log", [["eq", "habit_id", b.dataset.h], ["eq", "day", b.dataset.d]]); }
    catch (e) { toast(e.message, true); }
  }));
  $$("[data-off]", main).forEach((b) => (b.onclick = async () => { await upd("pb_habits", [["eq", "id", b.dataset.off]], { active: false }); re(); }));
  $$("[data-on]", main).forEach((b) => (b.onclick = async () => { await upd("pb_habits", [["eq", "id", b.dataset.on]], { active: true }); re(); }));
  $$("[data-del]", main).forEach((b) => (b.onclick = async () => { if (!(await confirmBox("Удалить привычку вместе с отметками?", "Удалить"))) return; await del("pb_habits", [["eq", "id", b.dataset.del]]); re(); }));
}
