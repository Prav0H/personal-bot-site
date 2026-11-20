// «Неделя»: цифры по фактическим записям + разбор Claude.
import { list, today, addDays, fn } from "./db.js";
import { $, esc, rub, dShort, wd, busy, aiHtml, plural } from "./ui.js";
import { MOOD, ENERGY } from "./evening.js";
import { icon } from "./money.js";

const monday = (iso) => { const d = new Date(iso + "T12:00:00"); const k = (d.getDay() + 6) % 7; return addDays(iso, -k); };

export async function render(main, arg) {
  const off = +(arg || 0) || 0;
  const from = addDays(monday(today()), off * 7), to = addDays(from, 6);
  const tsFrom = new Date(from + "T00:00:00").toISOString(), tsTo = new Date(to + "T23:59:59.999").toISOString();
  const [tasks, doneElse, moves, days, exp, prevExp, ideas, habits, hlog, ai] = await Promise.all([
    list("pb_tasks", [["gte", "day", from], ["lte", "day", to]]),
    list("pb_tasks", [["gte", "done_at", tsFrom], ["lte", "done_at", tsTo]]),
    list("pb_moves", [["gte", "created_at", tsFrom], ["lte", "created_at", tsTo]], "created_at"),
    list("pb_days", [["gte", "day", from], ["lte", "day", to]], "day"),
    list("pb_expenses", [["gte", "day", from], ["lte", "day", to]]),
    list("pb_expenses", [["gte", "day", addDays(from, -7)], ["lte", "day", addDays(to, -7)]]),
    list("pb_ideas", [["gte", "created_at", tsFrom], ["lte", "created_at", tsTo]]),
    list("pb_habits", [["eq", "active", true]], "sort"),
    list("pb_habit_log", [["gte", "day", from], ["lte", "day", to]]),
    list("pb_ai", [["eq", "kind", "week"]], "created_at desc", 5),
  ]);
  const done = [...new Map([...tasks.filter((t) => t.done_at), ...doneElse].map((t) => [t.id, t])).values()];
  const planned = tasks.length, pct = planned ? Math.round((tasks.filter((t) => t.done_at).length / planned) * 100) : 0;
  const reasons = {};
  moves.forEach((m) => (m.reason || "без причины").split(/\.\s*/).filter(Boolean).forEach((r) => (reasons[r] = (reasons[r] || 0) + 1)));
  const topR = Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const moved = {}; moves.forEach((m) => (moved[m.task_title] = (moved[m.task_title] || 0) + 1));
  const stuck = Object.entries(moved).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
  const sum = (r) => r.reduce((a, e) => a + +e.amount, 0);
  const spent = sum(exp), prevSpent = sum(prevExp);
  const byCat = {}; exp.forEach((e) => (byCat[e.category] = (byCat[e.category] || 0) + +e.amount));
  const dlist = []; for (let d = from; d <= to; d = addDays(d, 1)) dlist.push(d);
  const dmap = Object.fromEntries(days.map((d) => [d.day, d]));
  const avg = (k) => { const v = days.map((d) => d[k]).filter(Boolean); return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : "—"; };
  const closed = days.filter((d) => d.closed_at).length;
  const wins = days.filter((d) => d.win);
  const ruD = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
  const lastAi = ai.find((a) => a.question.includes(`${ruD(from)}–${ruD(to)}`)) || null;

  main.innerHTML = `<div class="top"><div><a href="#/more" class="small">← Ещё</a><h1>Неделя</h1><div class="sub">${dShort(from)} — ${dShort(to)}</div></div>
      <div class="row"><a class="btn sm" href="#/week/${off - 1}">‹</a>${off < 0 ? `<a class="btn sm" href="#/week/${off + 1}">›</a>` : ""}</div></div>
    <div class="kpis"><div class="kpi"><div class="v">${done.length}</div><div class="l">сделано задач</div></div><div class="kpi"><div class="v">${pct}%</div><div class="l">плана недели</div></div><div class="kpi"><div class="v">${moves.length}</div><div class="l">${plural(moves.length, "перенос", "переноса", "переносов")}</div></div></div>
    <div class="kpis"><div class="kpi"><div class="v">${avg("mood")}</div><div class="l">настроение</div></div><div class="kpi"><div class="v">${avg("energy")}</div><div class="l">энергия</div></div><div class="kpi"><div class="v">${closed}/7</div><div class="l">дней закрыто</div></div></div>
    <div class="card"><div class="small muted" style="margin-bottom:6px">Задачи и самочувствие по дням</div><div class="cols">${dlist.map((d) => {
      const n = done.filter((t) => String(t.done_at).length > 4 && new Date(t.done_at).toLocaleDateString("en-CA") === d).length;
      const max = Math.max(1, ...dlist.map((x) => done.filter((t) => new Date(t.done_at).toLocaleDateString("en-CA") === x).length));
      return `<div class="c"><span style="font-size:15px">${dmap[d]?.mood ? MOOD[dmap[d].mood - 1] : "·"}</span><i class="b" style="height:${(n / max) * 70}%"></i><span>${wd(d)} ${n || ""}</span></div>`;
    }).join("")}</div></div>
    <button class="btn wide blue" id="ai">✨ Разбор недели — Claude</button><div id="aiout" style="margin-top:10px">${lastAi ? `<div class="ai"><div class="who">Claude · ${esc(lastAi.question)}</div>${aiHtml(lastAi.answer)}</div>` : ""}</div>
    ${topR.length ? `<h3>Почему переносил</h3><div class="card"><div class="bars">${topR.map(([r, n]) => `<div class="bar"><div class="bl"><span>${esc(r)}</span><b>${n}</b></div><div class="progress"><i style="width:${(n / topR[0][1]) * 100}%"></i></div></div>`).join("")}</div></div>` : ""}
    ${stuck.length ? `<h3>Застрявшие задачи</h3><div class="card">${stuck.map(([t, n]) => `<div style="margin-bottom:6px">↪×${n} «${esc(t)}»</div>`).join("")}<p class="hint">Переносились несколько раз: разбейте на шаги, делегируйте или откажитесь</p></div>` : ""}
    ${wins.length ? `<h3>Победы недели 🏆</h3><div class="card">${wins.map((d) => `<div style="margin-bottom:6px"><span class="muted small">${wd(d.day)}</span> ${esc(d.win)}</div>`).join("")}</div>` : ""}
    <h3>Деньги</h3><div class="card"><div class="row" style="justify-content:space-between"><b style="font-size:22px">${rub(spent)}</b><span class="small ${spent > prevSpent ? "delta up" : "delta down"}">${prevSpent ? (spent > prevSpent ? "▲ " : "▼ ") + rub(Math.abs(spent - prevSpent)) + " к прошлой" : ""}</span></div>
      ${Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c, v]) => `<div class="row small" style="justify-content:space-between;margin-top:6px"><span>${icon(c)} ${esc(c)}</span><span>${rub(v)}</span></div>`).join("")}</div>
    ${habits.length ? `<h3>Привычки</h3><div class="card"><div class="hgrid"><span></span>${dlist.map((d) => `<span class="d">${wd(d)}</span>`).join("")}${habits.map((h) => `<span>${esc(h.title)}</span>${dlist.map((d) => `<button class="${hlog.some((l) => l.habit_id === h.id && l.day === d) ? "on" : ""}" disabled></button>`).join("")}`).join("")}</div></div>` : ""}
    ${ideas.length ? `<h3>Идеи недели · ${ideas.length}</h3><div class="card">${ideas.map((i) => `<div style="margin-bottom:6px">💡 ${esc(i.text.slice(0, 140))}</div>`).join("")}</div>` : ""}`;

  $("#ai", main).onclick = (ev) => busy(ev.currentTarget, async () => {
    const j = await fn({ action: "ai", kind: "week", from, to });
    $("#aiout", main).innerHTML = `<div class="ai"><div class="who">Claude · неделя ${dShort(from)}–${dShort(to)}</div>${aiHtml(j.answer)}</div>`;
  });
}
