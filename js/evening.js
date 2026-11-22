// «Итоги дня»: что сделано, перенос несделанного с причиной, самочувствие, победа дня, заметка, план на завтра.
import { rows, add, patch, day as dayRow, setDay } from "./store.js";
import { today, addDays } from "./db.js";
import { $, $$, esc, toast, sheet, dLong, dRel, scale, bindScale, plural, DICT } from "./ui.js";
import { taskRow, bindTasks, moveSheet, taskSheet } from "./tasks.js";

export const MOOD = ["😣", "😕", "😐", "🙂", "😄"];
export const ENERGY = ["🪫", "😮‍💨", "🙂", "💪", "⚡"];
export const LOAD = ["🌿", "🙂", "😐", "😓", "🔥"];

export function render(main, arg) {
  const td = today(), day = /^\d{4}-\d{2}-\d{2}$/.test(arg || "") ? arg : td, tom = addDays(day, 1);
  const T = rows("pb_tasks");
  const plan = T.filter((t) => t.day === day);
  const extra = T.filter((t) => t.done_at && t.day !== day && new Date(t.done_at).toLocaleDateString("en-CA") === day);
  const done = plan.filter((t) => t.done_at), open = plan.filter((t) => !t.done_at);
  const moved = rows("pb_moves").filter((m) => m.from_day === day && !plan.some((t) => t.id === m.task_id));
  const tomT = T.filter((t) => t.day === tom);
  const d = dayRow(day), vals = { mood: d.mood, energy: d.energy, load: d.load };
  const pct = plan.length ? Math.round((done.length / plan.length) * 100) : 0;
  main.innerHTML = `<a class="back" href="#/today">‹ Сегодня</a><div class="cap" style="margin-top:2px">${dLong(day)}</div><h1>Итоги дня</h1>
    <p class="voice">${plan.length ? `Сделано ${done.length} из ${plan.length}${extra.length ? ` и ещё ${extra.length} сверх плана` : ""}.${open.length ? " Несделанное перенесём — с причиной, так видно, что мешает." : " Всё закрыто — отличный день."}` : "На этот день задач не было. Как он прошёл?"}${day === td ? ` <a href="#/evening/${addDays(td, -1)}">Вчера →</a>` : ` <a href="#/evening">Сегодня →</a>`}</p>
    ${d.closed_at ? `<div class="card" style="border-color:var(--good)"><b style="color:var(--good)">✓ День закрыт.</b> <span class="muted small">Можно поправить и сохранить ещё раз.</span></div>` : ""}
    <div class="kpis"><div class="kpi"><div class="l">план</div><div class="v">${done.length}/${plan.length}</div></div><div class="kpi"><div class="l">выполнение</div><div class="v">${pct}%</div></div><div class="kpi"><div class="l">сверх плана</div><div class="v">${extra.length}</div></div></div>
    <div class="cap">Задачи дня</div><div class="card flat" id="pl">${plan.map((t) => taskRow(t, day)).join("") || `<div class="empty">Задач не было</div>`}</div>
    ${open.length ? `<button class="btn wide" id="moveAll">↪ Несделанное (${open.length}) — на завтра</button>` : ""}
    ${extra.length ? `<div class="cap">Сверх плана</div><div class="card flat" id="ex">${extra.map((t) => taskRow(t, day)).join("")}</div>` : ""}
    ${moved.length ? `<div class="cap">Перенесено</div><div class="card">${moved.map((m) => `<div class="small" style="margin-bottom:6px">↪ «${esc(m.task_title)}» → ${m.to_day ? dRel(m.to_day, td) : "когда-нибудь"}${m.reason ? `<br><span class="muted">${esc(m.reason)}</span>` : ""}</div>`).join("")}</div>` : ""}
    <div class="cap">Самочувствие</div>
    <div class="card"><label class="f" style="margin-top:0">Настроение</label>${scale("mood", d.mood, MOOD)}<label class="f">Энергия</label>${scale("energy", d.energy, ENERGY)}<label class="f">Нагрузка</label>${scale("load", d.load, LOAD)}</div>
    <div class="cap">Как прошёл день</div>
    <div class="card"><label class="f" style="margin-top:0">🏆 Что получилось лучше всего</label><input id="win" value="${esc(d.win || "")}" placeholder="Даже маленькая победа считается">
      <label class="f">📝 Заметка</label><textarea id="note" placeholder="Что было важного, что мешало, что понял">${esc(d.note || "")}</textarea>${DICT}</div>
    <button class="btn pri wide" id="close">${d.closed_at ? "Сохранить" : "🌙 Закрыть день"}</button>
    <div class="cap">Завтра · ${dLong(tom)}</div>
    <div class="card flat" id="tm">${tomT.map((t) => taskRow(t, td)).join("") || `<div class="empty">Запишите 1–3 главных дела на завтра</div>`}</div>
    <button class="btn wide" id="addTom">＋ Дело на завтра</button>`;
  const re = () => render(main, arg);
  bindTasks($("#pl", main), re); $("#ex", main) && bindTasks($("#ex", main), re); bindTasks($("#tm", main), re);
  $$("#pl .task", main).forEach((r) => { const t = plan.find((x) => x.id === r.dataset.id); if (t && !t.done_at) $(".t", r).onclick = () => moveSheet(t, re, "Почему не получилось?"); });
  bindScale(main, (k, v) => (vals[k] = v));
  $("#addTom", main).onclick = () => taskSheet({ day: tom }, re);
  $("#close", main).onclick = () => { setDay(day, { ...vals, win: $("#win", main).value.trim(), note: $("#note", main).value.trim(), closed_at: d.closed_at || new Date().toISOString() }); toast(d.closed_at ? "Сохранено" : "День закрыт. Спокойной ночи 🌙"); re(); };
  $("#moveAll", main) && ($("#moveAll", main).onclick = () => {
    const s = sheet(`<h2>На завтра</h2><p class="muted small">${open.map((t) => "«" + esc(t.title) + "»").join(", ")}</p><label class="f">Общая причина</label>
      <div class="chips" id="mr">${["Не хватило времени", "Срочное вытеснило", "Нет сил", "Жду других", "Переоценил силы"].map((r) => `<button class="chip" data-r="${r}">${r}</button>`).join("")}</div>
      <textarea id="mt" placeholder="Своими словами" style="margin-top:8px"></textarea>${DICT}<button class="btn pri wide" id="go" style="margin-top:12px">Перенести все</button>`);
    $$("#mr .chip", s.el).forEach((b) => (b.onclick = () => b.classList.toggle("on")));
    $("#go", s.el).onclick = () => {
      const reason = [...$$("#mr .chip.on", s.el).map((b) => b.dataset.r), $("#mt", s.el).value.trim()].filter(Boolean).join(". ");
      open.forEach((t) => { add("pb_moves", { task_id: t.id, task_title: t.title, from_day: t.day, to_day: tom, reason }); patch("pb_tasks", t.id, { day: tom, moves: (t.moves || 0) + 1, in_plan: false }); });
      s.close(); toast("Перенесено на завтра"); re();
    };
  });
}
