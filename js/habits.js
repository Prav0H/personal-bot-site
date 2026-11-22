// «Привычки»: ритм недели — расписание и время, точки недели, серия, отметка сегодня.
import { rows, add, patch, remove, toggleHabit, habitDone } from "./store.js";
import { today, addDays } from "./db.js";
import { $, $$, esc, toast, sheet, confirmBox } from "./ui.js";
import { scheduled, scheduleText, habitStreak } from "./model.js";

const DN = [[1, "П"], [2, "В"], [3, "С"], [4, "Ч"], [5, "П"], [6, "С"], [0, "В"]];

export function habitSheet(h0, onChange) {
  const isNew = !h0?.id, h = { title: "", days: [1, 2, 3, 4, 5, 6, 0], time: "", minutes: null, ...h0 };
  let days = [...(h.days || [])];
  const s = sheet(`<h2>${isNew ? "Новая привычка" : "Привычка"}</h2>
    <input id="ht" placeholder="Английский, тренировка, чтение…" value="${esc(h.title)}">
    <label class="f">Дни</label><div class="chips" id="hd">${DN.map(([d, l]) => `<button class="chip${days.includes(d) ? " on" : ""}" data-d="${d}" style="width:38px;justify-content:center">${l}</button>`).join("")}</div>
    <div class="row" style="margin-top:6px"><button class="btn sm" data-p="all">Каждый день</button><button class="btn sm" data-p="wd">Будни</button></div>
    <div class="row2"><div><label class="f">Время (в плане дня)</label><input type="time" id="hm" value="${h.time || ""}"></div><div><label class="f">Минут</label><input id="hn" inputmode="numeric" value="${h.minutes || ""}" placeholder="—"></div></div>
    <button class="btn pri wide" id="hs" style="margin-top:12px">${isNew ? "Добавить" : "Сохранить"}</button>
    ${isNew ? "" : `<div class="row2"><button class="btn" id="hp">${h.active === false ? "Вернуть" : "Пауза"}</button><button class="btn danger" id="hx">Удалить</button></div>`}`);
  const el = s.el;
  const draw = () => $$("#hd .chip", el).forEach((b) => b.classList.toggle("on", days.includes(+b.dataset.d)));
  $$("#hd .chip", el).forEach((b) => (b.onclick = () => { const d = +b.dataset.d; days = days.includes(d) ? days.filter((x) => x !== d) : [...days, d]; draw(); }));
  $$("[data-p]", el).forEach((b) => (b.onclick = () => { days = b.dataset.p === "all" ? [1, 2, 3, 4, 5, 6, 0] : [1, 2, 3, 4, 5]; draw(); }));
  if (isNew) setTimeout(() => $("#ht", el).focus(), 50);
  $("#hs", el).onclick = () => {
    const title = $("#ht", el).value.trim(); if (!title) return toast("Название привычки", true);
    if (!days.length) return toast("Выберите хотя бы один день", true);
    const row = { title, days, time: $("#hm", el).value, minutes: +$("#hn", el).value || null };
    if (isNew) add("pb_habits", { ...row, active: true, sort: rows("pb_habits").length }); else patch("pb_habits", h.id, row);
    s.close(); onChange && onChange();
  };
  if (!isNew) {
    $("#hp", el).onclick = () => { patch("pb_habits", h.id, { active: h.active === false }); s.close(); onChange && onChange(); };
    $("#hx", el).onclick = async () => { if (!(await confirmBox("Удалить привычку вместе с отметками?", "Удалить"))) return; rows("pb_habit_log").filter((l) => l.habit_id === h.id).forEach((l) => remove("pb_habit_log", l)); remove("pb_habits", h.id); s.close(); onChange && onChange(); };
  }
}

export function render(main) {
  const td = today();
  const mon = (() => { let d = td; while (new Date(d + "T12:00:00").getDay() !== 1) d = addDays(d, -1); return d; })();
  const week = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const habits = rows("pb_habits").sort((a, b) => (a.active === false) - (b.active === false) || (a.time || "99").localeCompare(b.time || "99"));
  main.innerHTML = `<a class="back" href="#/today">‹ Сегодня</a><div class="cap" style="margin-top:2px">Привычки</div><h1>Ритм недели</h1>
    <p class="voice">Каждая привычка с временем стоит в плане дня. Дела я двигаю вокруг них, а не наоборот.</p>
    ${habits.map((h) => {
      const on = habitDone(h.id, td), sch = scheduled(h, td), streak = habitStreak(h, td);
      return `<div class="card" data-h="${h.id}" style="${h.active === false ? "opacity:.5" : ""}"><div class="row" style="justify-content:space-between">
        <div class="grow" data-edit style="cursor:pointer"><b style="font-size:14px">${esc(h.title)}</b><div class="small muted">${esc(scheduleText(h))}${h.active === false ? " · на паузе" : ""}</div></div>
        ${streak ? `<span class="small" style="color:var(--gold2);font-weight:600">${streak}</span>` : ""}<button class="ck${on ? " on" : ""}" data-ck style="width:26px;height:26px${sch ? "" : ";opacity:.4"}"></button></div>
        <div class="wk">${week.map((d, i) => { const done = habitDone(h.id, d), s = scheduled(h, d); const cls = done ? "on" : !s ? "off" : d < td ? "miss" : d > td ? "ahead" : ""; return `<div><span>${DN[i][1]}</span><i class="${cls}" data-d="${d}"></i></div>`; }).join("")}</div></div>`;
    }).join("") || `<div class="empty">Привычек пока нет</div>`}
    <button class="btn wide" id="nh" style="border-color:var(--gold);color:var(--gold2)">＋ Новая привычка</button>
    <p class="hint center">Точки: золотая — сделано, терракотовая — пропущено, пунктир — впереди, маленькая — выходной.</p>`;
  const re = () => render(main);
  $$("[data-h]", main).forEach((c) => {
    const h = rows("pb_habits").find((x) => x.id === c.dataset.h);
    $("[data-ck]", c).onclick = () => { toggleHabit(h.id, td); re(); };
    $("[data-edit]", c).onclick = () => habitSheet(h, re);
    $$("[data-d]", c).forEach((i) => (i.onclick = () => { if (i.dataset.d <= td) { toggleHabit(h.id, i.dataset.d); re(); } }));
  });
  $("#nh", main).onclick = () => habitSheet({}, re);
}
