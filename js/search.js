// «Поиск»: задачи, идеи, дневник, траты, цели.
import { rows } from "./store.js";
import { $, $$, esc, rub, dShort } from "./ui.js";
import { taskSheet } from "./tasks.js";
import { ideaSheet } from "./ideas.js";
import { expenseSheet } from "./money.js";

let q = "";
export function render(main) {
  main.innerHTML = `<a class="back" href="#/more">‹ Ещё</a><h1>Поиск</h1><input id="q" type="search" placeholder="Слово из задачи, идеи, заметки, траты" value="${esc(q)}" autocomplete="off"><div id="res" style="margin-top:12px"></div>`;
  const res = $("#res", main), inp = $("#q", main);
  const draw = () => {
    q = inp.value.trim();
    if (q.length < 2) { res.innerHTML = `<div class="empty">Введите хотя бы 2 буквы</div>`; return; }
    const L = q.toLowerCase(), has = (...v) => v.some((x) => String(x || "").toLowerCase().includes(L));
    const hl = (s) => esc(s).replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), (m) => `<mark>${m}</mark>`);
    const T = rows("pb_tasks").filter((t) => has(t.title, t.note)).slice(0, 30), I = rows("pb_ideas").filter((i) => has(i.text)).slice(0, 30), G = rows("pb_goals").filter((g) => has(g.title, g.why));
    const D = rows("pb_days").filter((d) => has(d.intention, d.note, d.win)).slice(0, 30), E = rows("pb_expenses").filter((e) => has(e.title, e.note, e.category)).slice(0, 40);
    res.innerHTML = [
      G.length && `<div class="cap">Цели</div><div class="card flat">${G.map((g) => `<a class="li" href="#/goal/${g.id}" style="color:inherit"><span class="ic">🎯</span><div class="tx">${hl(g.title)}</div></a>`).join("")}</div>`,
      T.length && `<div class="cap">Задачи · ${T.length}</div><div class="card flat">${T.map((t) => `<div class="li" data-t="${t.id}"><span class="ic">${t.done_at ? "✓" : "○"}</span><div class="tx"><div>${hl(t.title)}</div><div class="s">${t.day ? dShort(t.day) : "без срока"}</div></div></div>`).join("")}</div>`,
      I.length && `<div class="cap">Идеи · ${I.length}</div><div class="card flat">${I.map((i) => `<div class="li" data-i="${i.id}"><span class="ic">💡</span><div class="tx">${hl(i.text.slice(0, 160))}</div></div>`).join("")}</div>`,
      D.length && `<div class="cap">Дневник · ${D.length}</div><div class="card flat">${D.map((d) => `<a class="li" href="#/evening/${d.day}" style="color:inherit"><span class="ic">📓</span><div class="tx"><div>${hl([d.intention, d.win, d.note].filter(Boolean).join(" · ").slice(0, 200))}</div><div class="s">${dShort(d.day)}</div></div></a>`).join("")}</div>`,
      E.length && `<div class="cap">Траты · ${rub(E.reduce((a, e) => a + +e.amount, 0))}</div><div class="card flat">${E.map((e) => `<div class="li" data-e="${e.id}"><div class="tx"><div>${hl(e.title || e.category)}</div><div class="s">${hl(e.category)} · ${dShort(e.day)}</div></div><span class="amount">${rub(e.amount)}</span></div>`).join("")}</div>`,
    ].filter(Boolean).join("") || `<div class="empty">Ничего не нашлось</div>`;
    $$("[data-t]", res).forEach((r) => (r.onclick = () => taskSheet(rows("pb_tasks").find((t) => t.id === r.dataset.t), draw)));
    $$("[data-i]", res).forEach((r) => (r.onclick = () => ideaSheet(rows("pb_ideas").find((i) => i.id === r.dataset.i), draw)));
    $$("[data-e]", res).forEach((r) => (r.onclick = () => expenseSheet(rows("pb_expenses").find((e) => e.id === r.dataset.e), draw)));
  };
  inp.oninput = draw; draw(); if (!q) inp.focus();
}
