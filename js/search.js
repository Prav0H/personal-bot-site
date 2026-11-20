// «Поиск»: задачи, идеи, дневник, траты.
import { list } from "./db.js";
import { $, $$, esc, rub, dShort } from "./ui.js";
import { taskSheet } from "./tasks.js";
import { ideaSheet } from "./ideas.js";
import { expenseSheet } from "./money.js";

let q = "";
export async function render(main) {
  main.innerHTML = `<div class="top"><div><a href="#/more" class="small">← Ещё</a><h1>Поиск</h1></div></div>
    <input id="q" type="search" placeholder="Слово из задачи, идеи, заметки или траты" value="${esc(q)}" autocomplete="off" enterkeyhint="search">
    <div id="res" style="margin-top:12px"></div>`;
  const [tasks, ideas, days, exp] = await Promise.all([list("pb_tasks", [], "created_at desc", 1000), list("pb_ideas", [], "created_at desc", 1000), list("pb_days", [], "day desc", 400), list("pb_expenses", [], "day desc", 2000)]);
  const res = $("#res", main), inp = $("#q", main);
  const hl = (s) => esc(s).replace(new RegExp(esc(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), (m) => `<mark>${m}</mark>`);
  const draw = () => {
    q = inp.value.trim();
    if (q.length < 2) { res.innerHTML = `<div class="empty">Введите хотя бы 2 буквы</div>`; return; }
    const L = q.toLowerCase(), has = (...v) => v.some((x) => String(x || "").toLowerCase().includes(L));
    const T = tasks.filter((t) => has(t.title, t.note)).slice(0, 30), I = ideas.filter((i) => has(i.text, i.check_plan)).slice(0, 30);
    const D = days.filter((d) => has(d.intention, d.note, d.win)).slice(0, 30), E = exp.filter((e) => has(e.note, e.category)).slice(0, 40);
    res.innerHTML = [
      T.length && `<h3>Задачи · ${T.length}</h3><div class="card flat">${T.map((t) => `<div class="li" data-t="${t.id}"><span class="ic">${t.done_at ? "✅" : "▫️"}</span><div class="tx"><div>${hl(t.title)}</div><div class="s">${t.day ? dShort(t.day) : "без срока"}</div></div></div>`).join("")}</div>`,
      I.length && `<h3>Идеи · ${I.length}</h3><div class="card flat">${I.map((i) => `<div class="li" data-i="${i.id}"><span class="ic">💡</span><div class="tx"><div>${hl(i.text.slice(0, 160))}</div><div class="s">${dShort(i.created_at.slice(0, 10))}</div></div></div>`).join("")}</div>`,
      D.length && `<h3>Дневник · ${D.length}</h3><div class="card flat">${D.map((d) => `<a class="li" href="#/evening/${d.day}" style="color:inherit"><span class="ic">📓</span><div class="tx"><div>${hl([d.intention, d.win, d.note].filter(Boolean).join(" · ").slice(0, 200))}</div><div class="s">${dShort(d.day)}</div></div></a>`).join("")}</div>`,
      E.length && `<h3>Траты · ${E.length} · ${rub(E.reduce((a, e) => a + +e.amount, 0))}</h3><div class="card flat">${E.map((e) => `<div class="li" data-e="${e.id}"><div class="tx"><div>${hl(e.category)}${e.note ? " · " + hl(e.note) : ""}</div><div class="s">${dShort(e.day)}</div></div><span class="amount">${rub(e.amount)}</span></div>`).join("")}</div>`,
    ].filter(Boolean).join("") || `<div class="empty">Ничего не нашлось</div>`;
    $$("[data-t]", res).forEach((r) => (r.onclick = () => taskSheet(tasks.find((t) => t.id === r.dataset.t), () => render(main))));
    $$("[data-i]", res).forEach((r) => (r.onclick = () => ideaSheet(ideas.find((i) => i.id === r.dataset.i), () => render(main))));
    $$("[data-e]", res).forEach((r) => (r.onclick = () => expenseSheet(exp.find((e) => e.id === r.dataset.e), () => render(main))));
  };
  inp.oninput = draw; draw(); if (!q) inp.focus();
}
