// «Обзор»: неделя, месяц или свой период — задачи по квадрантам, привычки, траты, цели, вывод Кайроса.
import { rows } from "./store.js";
import { today, addDays, dayDiff, fn } from "./db.js";
import { $, $$, esc, rub, busy, aiHtml, plural } from "./ui.js";
import { quad, scheduled, sum, goalStats } from "./model.js";

const MON = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MON1 = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
let per = "week", custom = null;
const monday = (d) => { while (new Date(d + "T12:00:00").getDay() !== 1) d = addDays(d, -1); return d; };

function range() {
  const td = today();
  if (per === "week") { const m = monday(td); return [m, addDays(m, 6)]; }
  if (per === "month") return [td.slice(0, 8) + "01", new Date(+td.slice(0, 4), +td.slice(5, 7), 0).toLocaleDateString("en-CA")];
  return custom || [addDays(td, -29), td];
}
const title = (a, b) => per === "month" ? MON1[+a.slice(5, 7) - 1] : a.slice(5, 7) === b.slice(5, 7) ? `${+a.slice(8)}–${+b.slice(8)} ${MON[+b.slice(5, 7) - 1]}` : `${+a.slice(8)} ${MON[+a.slice(5, 7) - 1]} — ${+b.slice(8)} ${MON[+b.slice(5, 7) - 1]}`;

export function render(main) {
  const td = today(), [from, to] = range(), end = to < td ? to : td;
  const len = dayDiff(from, to) + 1;
  const tasks = rows("pb_tasks").filter((t) => t.day && t.day >= from && t.day <= to);
  const doneIn = rows("pb_tasks").filter((t) => t.done_at && new Date(t.done_at).toLocaleDateString("en-CA") >= from && new Date(t.done_at).toLocaleDateString("en-CA") <= to);
  const pool = [...new Map([...tasks, ...doneIn].map((t) => [t.id, t])).values()];
  const Q = [1, 2, 3, 4].map((k) => { const l = pool.filter((t) => quad({ ...t, done_at: null }, t.day || td) === k); return [l.filter((t) => t.done_at).length, l.length]; });
  const done = pool.filter((t) => t.done_at).length;
  let hTotal = 0, hDone = 0;
  const log = rows("pb_habit_log");
  rows("pb_habits").filter((h) => h.active !== false).forEach((h) => { for (let d = from; d <= end; d = addDays(d, 1)) if (scheduled(h, d)) { hTotal++; if (log.some((l) => l.habit_id === h.id && l.day === d)) hDone++; } });
  const hp = hTotal ? Math.round((hDone / hTotal) * 100) : null;
  const exp = rows("pb_expenses").filter((e) => !e.planned && e.day >= from && e.day <= to);
  const prev = rows("pb_expenses").filter((e) => !e.planned && e.day >= addDays(from, -len) && e.day < from);
  const spent = sum(exp), prevSpent = sum(prev);
  const byCat = {}; exp.forEach((e) => (byCat[e.category] = (byCat[e.category] || 0) + +e.amount));
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3), max = top[0]?.[1] || 1;
  const goals = rows("pb_goals").filter((g) => g.status !== "done").map((g) => ({ g, n: rows("pb_tasks").filter((t) => t.goal_id === g.id && doneIn.includes(t)).length })).filter((x) => x.n);
  const moves = rows("pb_moves").filter((m) => String(m.created_at).slice(0, 10) >= from && String(m.created_at).slice(0, 10) <= to);
  // Вывод Кайроса — по цифрам
  const say = [];
  if (Q[0][1]) say.push(Q[0][0] === Q[0][1] ? "Всё срочное и важное закрыто." : `Срочного и важного закрыто ${Q[0][0]} из ${Q[0][1]}.`);
  const waiting = Q[1][1] - Q[1][0]; if (waiting > 1) say.push(`Важное несрочное копится — ${waiting} ${plural(waiting, "задача ждёт", "задачи ждут", "задач ждут")} окна.`);
  if (byCat["Целевые"] && spent && byCat["Целевые"] / spent >= 0.15) say.push(`${Math.round((byCat["Целевые"] / spent) * 100)}% трат ушло на цели — хороший знак.`);
  else if (top[0]) say.push(`Больше всего трат — ${top[0][0].toLowerCase()}.`);
  if (prevSpent && spent) { const d = Math.round(((spent - prevSpent) / prevSpent) * 100); if (Math.abs(d) >= 15) say.push(`Траты ${d > 0 ? "выросли" : "снизились"} на ${Math.abs(d)}% к прошлому периоду.`); }
  if (hp != null) say.push(hp >= 70 ? `Привычки держатся на ${hp}%.` : `Привычки просели до ${hp}%.`);
  if (moves.length >= 3) say.push(`Переносов: ${moves.length}.`);

  main.innerHTML = `<a class="back" href="#/today">‹ Сегодня</a><div class="cap" style="margin-top:2px">Обзор</div><h1>${title(from, to)}</h1>
    <div class="seg" id="per">${[["week", "Неделя"], ["month", "Месяц"], ["custom", "Свой период"]].map(([k, l]) => `<button data-p="${k}" class="${per === k ? "on" : ""}">${l}</button>`).join("")}</div>
    ${per === "custom" ? `<div class="row" style="margin-top:8px"><input type="date" id="cf" value="${from}"><input type="date" id="ct" value="${to}"></div>` : ""}
    <p class="voice" style="margin-top:12px">${say.join(" ") || "Данных за период пока мало — записывайте дела, привычки и траты."}</p>
    <div class="kpis"><div class="kpi"><div class="l">задачи</div><div class="v">${done}/${pool.length}</div></div><div class="kpi"><div class="l">привычки</div><div class="v">${hp == null ? "—" : hp + "%"}</div></div><div class="kpi"><div class="l">потрачено</div><div class="v">${rub(spent)}</div></div></div>
    <div class="card"><div class="cap" style="margin:0 0 8px">Задачи по квадрантам · сделано</div><div class="qgrid">${["срочное важное", "важное несрочное", "срочное неважное", "несрочное неважное"].map((l, i) => `<div class="q${i + 1}">${l}<b>${Q[i][0]} из ${Q[i][1]}</b></div>`).join("")}</div></div>
    ${top.length ? `<div class="card"><div class="cap" style="margin:0 0 8px">Больше всего трат</div><div class="bars">${top.map(([c, v]) => `<div class="bar"><span>${esc(c)}</span><div class="progress"><i style="width:${(v / max) * 100}%"></i></div><span>${rub(v)}</span></div>`).join("")}</div></div>` : ""}
    <div class="card row" style="justify-content:space-between"><b>Цели</b><span class="small muted">${goals.map((x) => `${esc(x.g.title.toLowerCase())} +${x.n} ${plural(x.n, "шаг", "шага", "шагов")}`).join(" · ") || "шагов за период нет"}</span></div>
    <button class="btn wide blue" id="ai">✨ Подробный разбор — Claude</button><div id="aiout" style="margin-top:8px"></div>`;
  const re = () => render(main);
  $$("#per button", main).forEach((b) => (b.onclick = () => { per = b.dataset.p; if (per === "custom" && !custom) custom = [addDays(td, -29), td]; re(); }));
  if (per === "custom") { const ch = () => { const a = $("#cf", main).value, b = $("#ct", main).value; if (a && b && a <= b) { custom = [a, b]; re(); } }; $("#cf", main).onchange = ch; $("#ct", main).onchange = ch; }
  $("#ai", main).onclick = (ev) => busy(ev.currentTarget, async () => { const j = await fn({ action: "ai", kind: "week", from, to: end }); $("#aiout", main).innerHTML = `<div class="ai"><div class="who">Кайрос · Claude</div>${aiHtml(j.answer)}</div>`; });
}
