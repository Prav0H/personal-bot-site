// «Цели»: список и экран цели — шаги, бюджет (план/факт по тратам «Целевые»), вехи, задачи с квадрантами.
import { rows, add, patch, remove, get } from "./store.js";
import { today, addDays } from "./db.js";
import { $, $$, esc, toast, sheet, confirmBox, rub, dShort, plural, DICT } from "./ui.js";
import { goalStats, QUAD, quad, byDeadline } from "./model.js";
import { taskSheet, toggleDone, deadline } from "./tasks.js";
import { expenseSheet } from "./money.js";

const days = (n) => `${n} ${plural(n, "день", "дня", "дней")}`;

export function goalSheet(g0, onChange) {
  const isNew = !g0?.id, g = { title: "", why: "", due: "", budget: null, milestones: [], ...g0 };
  let ms = JSON.parse(JSON.stringify(g.milestones || []));
  const s = sheet(`<h2>${isNew ? "Новая цель" : "Цель"}</h2>
    <input id="gt" placeholder="Переезд, первые клиенты, три тренировки в неделю…" value="${esc(g.title)}">
    <label class="f">Зачем и как понять, что достигнута</label><textarea id="gw" placeholder="Признак достижения">${esc(g.why)}</textarea>${DICT}
    <div class="row2"><div><label class="f">Срок</label><input type="date" id="gd" value="${g.due || ""}"></div><div><label class="f">Бюджет, ₽</label><input id="gb" inputmode="decimal" placeholder="не задан" value="${g.budget ? +g.budget : ""}"></div></div>
    <label class="f">Вехи (этапы с датами)</label><div id="ms"></div><button class="btn sm" id="am" style="margin-top:6px">＋ Веха</button>
    <button class="btn pri wide" id="gs" style="margin-top:14px">${isNew ? "Создать цель" : "Сохранить"}</button>
    ${isNew ? "" : `<div class="row2"><button class="btn" id="gdone">${g.status === "done" ? "Вернуть в работу" : "✓ Цель достигнута"}</button><button class="btn danger" id="gx">Удалить</button></div>`}`);
  const el = s.el;
  const draw = () => {
    $("#ms", el).innerHTML = ms.map((m, i) => `<div class="row" style="margin-bottom:6px"><input data-mt="${i}" value="${esc(m.title)}" placeholder="Этап" class="grow"><input type="date" data-md="${i}" value="${m.date || ""}" style="width:150px"><button class="btn sm" data-mx="${i}">✕</button></div>`).join("") || `<p class="hint">Например: Бюджет · 30 ноя, Документы · 20 дек, Жильё · 15 янв</p>`;
    $$("[data-mt]", el).forEach((x) => (x.oninput = () => (ms[+x.dataset.mt].title = x.value)));
    $$("[data-md]", el).forEach((x) => (x.onchange = () => (ms[+x.dataset.md].date = x.value)));
    $$("[data-mx]", el).forEach((x) => (x.onclick = () => { ms.splice(+x.dataset.mx, 1); draw(); }));
  };
  draw();
  $("#am", el).onclick = () => { ms.push({ title: "", date: "", done: false }); draw(); };
  if (isNew) setTimeout(() => $("#gt", el).focus(), 50);
  $("#gs", el).onclick = () => {
    const title = $("#gt", el).value.trim(); if (!title) return toast("Название цели", true);
    const row = { title, why: $("#gw", el).value.trim(), due: $("#gd", el).value || null, budget: +String($("#gb", el).value).replace(/\s/g, "").replace(",", ".") || null, milestones: ms.filter((m) => m.title.trim()).sort((a, b) => (a.date || "9").localeCompare(b.date || "9")) };
    const saved = isNew ? add("pb_goals", { ...row, status: "active", sort: rows("pb_goals").length }) : patch("pb_goals", g.id, row);
    s.close(); toast(isNew ? "Цель создана" : "Сохранено"); if (isNew) location.hash = "#/goal/" + saved.id; else onChange && onChange();
  };
  if (!isNew) {
    $("#gdone", el).onclick = () => { patch("pb_goals", g.id, { status: g.status === "done" ? "active" : "done" }); s.close(); toast(g.status === "done" ? "Цель снова в работе" : "Поздравляю! 🎉"); onChange && onChange(); };
    $("#gx", el).onclick = async () => { if (!(await confirmBox("Удалить цель? Задачи и траты останутся, но без привязки.", "Удалить"))) return; rows("pb_tasks").filter((t) => t.goal_id === g.id).forEach((t) => patch("pb_tasks", t.id, { goal_id: null })); remove("pb_goals", g.id); s.close(); location.hash = "#/goals"; };
  }
}

export function render(main, id) {
  if (id) return detail(main, id);
  const td = today();
  const goals = rows("pb_goals").filter((g) => g.status !== "done").sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999") || a.sort - b.sort);
  const done = rows("pb_goals").filter((g) => g.status === "done");
  const near = goals.find((g) => g.due);
  const say = goals.length ? `${goals.length === 1 ? "Одна цель" : `${goals.length} ${plural(goals.length, "цель", "цели", "целей")}`}.${near ? ` ${esc(near.title)} ближе всех к сроку — ${days(Math.max(0, goalStats(near).left))}.` : " Поставьте сроки — я подскажу, что ближе."}` : "Целей пока нет. С какой начнём?";
  main.innerHTML = `<div class="cap" style="margin-top:6px">Цели</div><h1>Куда идём</h1><p class="voice">${say}</p>
    ${goals.map((g) => { const st = goalStats(g); return `<a class="card" href="#/goal/${g.id}" style="display:block;color:inherit">
      <div class="row" style="justify-content:space-between"><b style="font-size:14.5px">${esc(g.title)}</b><span class="small muted">${g.due ? "до " + dShort(g.due) : "без срока"}</span></div>
      <div class="progress" style="margin:9px 0 10px"><i style="width:${Math.round(st.pct * 100)}%"></i></div>
      <div class="row" style="justify-content:space-between;font-size:11px"><div><div class="muted">задачи</div><b>${st.done} из ${st.tasks.length}</b></div><div><div class="muted">бюджет</div><b>${g.budget ? `${rub(st.spent).replace(" ₽", "")} из ${rub(g.budget)}` : st.spent ? rub(st.spent) : "не задан"}</b></div><div class="right"><div class="muted">срок</div><b>${g.due ? dShort(g.due) : "—"}</b></div></div></a>`; }).join("")}
    <button class="btn wide" id="ng" style="border-color:var(--gold);color:var(--gold2)">🎯 Новая цель</button>
    ${done.length ? `<div class="cap">Достигнуто · ${done.length}</div><div class="card flat">${done.map((g) => `<a class="li" href="#/goal/${g.id}" style="color:inherit"><span class="ic">✓</span><div class="tx">${esc(g.title)}</div></a>`).join("")}</div>` : ""}`;
  $("#ng", main).onclick = () => goalSheet({}, () => render(main));
}

function detail(main, id) {
  const g = get("pb_goals", id);
  if (!g) { main.innerHTML = `<a class="back" href="#/goals">‹ Цели</a><div class="empty">Цель не найдена</div>`; return; }
  const td = today(), st = goalStats(g);
  const open = st.tasks.filter((t) => !t.done_at).sort(byDeadline), closed = st.tasks.filter((t) => t.done_at);
  const ms = g.milestones || [];
  const steps = st.tasks.length || ms.length;
  const lastSpend = rows("pb_expenses").filter((e) => e.goal_id === g.id && !e.planned).sort((a, b) => String(b.day).localeCompare(a.day))[0];
  main.innerHTML = `<a class="back" href="#/goals">‹ Цели</a>
    <div class="cap" style="margin-top:2px">Цель${g.due ? " · до " + dShort(g.due) : ""}</div>
    <div class="top"><h1>${esc(g.title)}</h1><button class="btn sm" id="ed">Изменить</button></div>
    <div class="row small muted" style="justify-content:space-between;margin:2px 0 6px"><span>шаги: ${st.stepsDone} из ${steps}</span><span>${st.left != null ? (st.left >= 0 ? "осталось " + days(st.left) : "срок прошёл") : ""}</span></div>
    ${steps ? `<div class="steps">${Array.from({ length: Math.min(steps, 14) }, (_, i) => `<i class="${i < Math.round((st.stepsDone / steps) * Math.min(steps, 14)) ? "on" : ""}"></i>`).join("")}</div>` : ""}
    ${g.why ? `<p class="voice" style="margin-top:10px">${esc(g.why)}</p>` : ""}
    <div class="card" style="margin-top:12px"><div class="row" style="justify-content:space-between"><div class="cap" style="margin:0">Бюджет</div><span class="small muted">${g.budget ? Math.round((st.spent / g.budget) * 100) + "% потрачено" : ""}</span></div>
      <div style="margin:6px 0"><span class="big">${rub(st.spent)}</span> ${g.budget ? `<span class="muted">из ${rub(g.budget)}</span>` : ""}</div>
      ${g.budget ? `<div class="progress"><i style="width:${Math.min(100, (st.spent / g.budget) * 100)}%"></i></div>` : ""}
      <p class="hint">Траты с категорией «Целевые» и этой целью попадают сюда сами${lastSpend ? ` · последняя: ${esc(lastSpend.title || lastSpend.note || lastSpend.category)}` : ""}.</p>
      <button class="btn sm" id="sp">＋ Трата на цель</button></div>
    ${ms.length ? `<div class="card"><div class="cap" style="margin:0 0 10px">Сроки</div><div class="mile">${ms.map((m, i) => `<div class="${m.done ? "on" : ""}" data-m="${i}"><i></i>${esc(m.title)}<span>${m.date ? dShort(m.date) : ""}</span></div>`).join("")}</div><p class="hint center">Нажмите на веху, чтобы отметить</p></div>` : ""}
    <div class="row" style="justify-content:space-between"><div class="cap">Задачи</div><a class="small" href="#/tasks">в матрице →</a></div>
    <div class="card flat">${[...open, ...closed].map((t) => { const q = quad(t, td); return `<div class="task${t.done_at ? " done" : ""}" data-id="${t.id}"><button class="ck${t.done_at ? " on" : ""}"></button><div class="t"><div class="tt">${esc(t.title)}</div><div class="meta"><span class="tag ${q === 1 ? "gold" : q === 3 ? "terra" : ""}">${QUAD[q].t.toLowerCase()}</span><span>${t.done_at ? "сделано " + dShort(new Date(t.done_at).toLocaleDateString("en-CA")) : esc(deadline(t, td))}</span></div></div></div>`; }).join("") || `<div class="empty">Добавьте первый шаг</div>`}</div>
    <button class="btn wide" id="at">＋ Шаг к цели</button>`;
  const re = () => detail(main, id);
  $("#ed", main).onclick = () => goalSheet(g, re);
  $("#at", main).onclick = () => taskSheet({ goal_id: g.id, important: true, day: null }, re);
  $("#sp", main).onclick = () => expenseSheet({ category: "Целевые", goal_id: g.id }, re);
  $$("[data-m]", main).forEach((b) => (b.onclick = () => { const m = [...ms]; m[+b.dataset.m] = { ...m[+b.dataset.m], done: !m[+b.dataset.m].done }; patch("pb_goals", g.id, { milestones: m }); re(); }));
  $$(".task", main).forEach((row) => {
    const t = () => rows("pb_tasks").find((x) => x.id === row.dataset.id);
    $(".ck", row).onclick = (e) => { e.stopPropagation(); toggleDone(t()); re(); };
    $(".t", row).onclick = () => taskSheet(t(), re);
  });
}
