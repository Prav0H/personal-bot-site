// «Вечер»: план против факта, переносы с причинами, самочувствие, заметка о дне, план на завтра.
import { list, ins, upd, ups, today, addDays } from "./db.js";
import { $, $$, esc, toast, sheet, dLong, dRel, scale, bindScale, plural, DICT } from "./ui.js";
import { taskRow, bindTasks, moveSheet, quickAdd } from "./tasks.js";

export const MOOD = ["😣", "😕", "😐", "🙂", "😄"];
export const ENERGY = ["🪫", "😮‍💨", "🙂", "💪", "⚡"];
export const LOAD = ["🌿", "🙂", "😐", "😓", "🔥"];

export async function render(main, arg) {
  const td = today();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(arg || "") ? arg : td;
  const tom = addDays(day, 1);
  const [tasks, drows, moves, tomTasks] = await Promise.all([
    list("pb_tasks", [["eq", "day", day]], ["priority desc", "created_at"]),
    list("pb_days", [["eq", "day", day]]),
    list("pb_moves", [["eq", "from_day", day]]),
    list("pb_tasks", [["eq", "day", tom]], ["priority desc", "created_at"]),
  ]);
  // сделанные в этот день задачи с другими датами — «сверх плана»
  const from = new Date(day + "T00:00:00").toISOString(), till = new Date(day + "T23:59:59.999").toISOString();
  const doneElse = (await list("pb_tasks", [["gte", "done_at", from], ["lte", "done_at", till]])).filter((t) => t.day !== day);
  const d = drows[0] || {};
  const plan = tasks.some((t) => t.in_plan) ? tasks.filter((t) => t.in_plan) : tasks;
  const extra = [...tasks.filter((t) => !plan.includes(t) && t.done_at), ...doneElse];
  const pDone = plan.filter((t) => t.done_at), pOpen = plan.filter((t) => !t.done_at);
  const movedAway = moves.filter((m) => !tasks.some((t) => t.id === m.task_id));
  const pct = plan.length ? Math.round((pDone.length / plan.length) * 100) : 0;
  const vals = { mood: d.mood, energy: d.energy, load: d.load };

  main.innerHTML = `<div class="top"><div><h1>Итоги дня</h1><div class="sub">${dLong(day)}${day !== td ? ` · <a href="#/evening">сегодня</a>` : ` · <a href="#/evening/${addDays(td, -1)}">вчера</a>`}</div></div></div>
    ${d.closed_at ? `<div class="card" style="background:var(--good-soft);border-color:var(--good)"><b>✅ День закрыт.</b> <span class="muted">Можно поправить и сохранить ещё раз.</span></div>` : ""}
    ${d.intention ? `<div class="card"><div class="small muted">🎯 Главное на день</div><div style="font-size:17px">${esc(d.intention)}</div></div>` : ""}
    <div class="kpis"><div class="kpi"><div class="v">${pDone.length}/${plan.length}</div><div class="l">план выполнен</div></div><div class="kpi"><div class="v">${pct}%</div><div class="l">выполнение</div></div><div class="kpi"><div class="v">${extra.length}</div><div class="l">сверх плана</div></div></div>
    <h3>План${tasks.some((t) => t.in_plan) ? " (утверждён утром)" : ""}</h3>
    <div class="card flat" id="pl">${plan.map((t) => taskRow(t, day)).join("") || `<div class="empty">На этот день задач не было</div>`}</div>
    ${pOpen.length ? `<button class="btn wide" id="moveAll">↪ Перенести несделанное (${pOpen.length}) на завтра</button><p class="hint center">Нажмите на задачу, чтобы перенести её отдельно и записать причину</p>` : ""}
    ${extra.length ? `<h3>Сверх плана</h3><div class="card flat" id="ex">${extra.map((t) => taskRow(t, day)).join("")}</div>` : ""}
    ${movedAway.length ? `<h3>Перенесено сегодня</h3><div class="card">${movedAway.map((m) => `<div class="small" style="margin-bottom:6px">↪ «${esc(m.task_title)}» → ${dRel(m.to_day, td)}${m.reason ? `<br><span class="muted">${esc(m.reason)}</span>` : ""}</div>`).join("")}</div>` : ""}
    <h3>Самочувствие</h3>
    <div class="card"><label class="f" style="margin-top:0">Настроение</label>${scale("mood", d.mood, MOOD)}
      <label class="f">Энергия</label>${scale("energy", d.energy, ENERGY)}
      <label class="f">Нагрузка</label>${scale("load", d.load, LOAD)}<div class="hint">🌿 лёгкий день … 🔥 перегруз</div></div>
    <h3>Как прошёл день</h3>
    <div class="card"><label class="f" style="margin-top:0">🏆 Что получилось лучше всего?</label><input id="win" value="${esc(d.win || "")}" placeholder="Даже маленькая победа считается">
      <label class="f">📝 Заметка о дне</label><textarea id="note" placeholder="Что было важного, что мешало, что понял…">${esc(d.note || "")}</textarea>${DICT}</div>
    <button class="btn pri wide" id="close">${d.closed_at ? "Сохранить" : "🌙 Закрыть день"}</button>
    <h3>Завтра · ${dLong(tom)}</h3>
    ${quickAdd(() => ({ day: tom }), () => render(main, arg), "Что сделать завтра?")}
    <div class="card flat" id="tm">${tomTasks.map((t) => taskRow(t, td)).join("") || `<div class="empty">Запишите 1–3 главные задачи на завтра — утром будет проще начать</div>`}</div>`;

  const re = () => render(main, arg);
  bindTasks($("#pl", main), plan, re);
  $("#ex", main) && bindTasks($("#ex", main), extra, re);
  bindTasks($("#tm", main), tomTasks, re);
  // в списке плана нажатие на несделанную задачу — сразу перенос с причиной
  $$("#pl .task", main).forEach((row) => {
    const t = plan.find((x) => x.id === row.dataset.id);
    if (t && !t.done_at) $(".t", row).onclick = () => moveSheet(t, re, "Почему не получилось?");
  });
  bindScale(main, (k, v) => (vals[k] = v));
  $("#moveAll", main) && ($("#moveAll", main).onclick = () => moveAll(pOpen, tom, re));
  $("#close", main).onclick = async () => {
    try {
      await ups("pb_days", { day, ...vals, win: $("#win", main).value.trim(), note: $("#note", main).value.trim(), closed_at: d.closed_at || new Date().toISOString() }, "user_id,day");
      toast(d.closed_at ? "Сохранено" : "День закрыт. Спокойной ночи 🌙"); re();
    } catch (e) { toast(e.message, true); }
  };
}

function moveAll(tasks, to, onDone) {
  const s = sheet(`<h2>Перенести на завтра</h2><p class="muted">${tasks.length} ${plural(tasks.length, "задача", "задачи", "задач")}: ${tasks.map((t) => "«" + esc(t.title) + "»").join(", ")}</p>
    <label class="f">Общая причина</label>
    <div class="chips" id="mr">${["Не хватило времени", "Срочное вытеснило", "Нет сил", "Жду других", "Переоценил силы"].map((r) => `<button class="chip" data-r="${r}">${r}</button>`).join("")}</div>
    <textarea id="mt" placeholder="Своими словами" style="margin-top:8px"></textarea>${DICT}
    <button class="btn pri wide" id="go" style="margin-top:14px">Перенести все</button>`);
  $$("#mr .chip", s.el).forEach((b) => (b.onclick = () => b.classList.toggle("on")));
  $("#go", s.el).onclick = async () => {
    const reason = [...$$("#mr .chip.on", s.el).map((b) => b.dataset.r), $("#mt", s.el).value.trim()].filter(Boolean).join(". ");
    try {
      for (const t of tasks) {
        await ins("pb_moves", { task_id: t.id, task_title: t.title, from_day: t.day, to_day: to, reason });
        await upd("pb_tasks", [["eq", "id", t.id]], { day: to, moves: (t.moves || 0) + 1, in_plan: false });
      }
      s.close(); toast("Перенесено на завтра"); onDone();
    } catch (e) { toast(e.message, true); }
  };
}
