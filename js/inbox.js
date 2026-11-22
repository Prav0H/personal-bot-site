// «Входящие»: то, в чём Кайрос не уверен. Его вариант уже выбран — согласиться или нажать другой тип.
import { rows, remove } from "./store.js";
import { $, $$, esc, toast } from "./ui.js";
import { TYPE_LABEL, parse } from "./parse.js";
import { commit, guessText } from "./voice.js";
import { cats } from "./model.js";
import { learnType } from "./assistant.js";

const ORDER = { task: ["task", "expense", "idea"], expense: ["expense", "task"], idea: ["idea", "habit", "task"], habit: ["habit", "task", "idea"], event: ["event", "task"] };

export function render(main) {
  const items = [...rows("pb_inbox")].sort((a, b) => String(b.created_at).localeCompare(a.created_at));
  const sel = {};
  main.innerHTML = `<a class="back" href="#/today">‹ Сегодня</a><div class="cap" style="margin-top:2px">Входящие · ${items.length}</div>
    <h1>${items.length ? "Разбери, что я не понял" : "Всё разобрано"}</h1><p class="voice">${items.length ? "Остальное разложил сам. Выбери тип — или поправь мой вариант." : "Когда я не уверен, что вы сказали, фраза попадает сюда."}</p>
    ${items.map((it) => {
      const g = it.guess && it.guess.type ? it.guess : parse(it.text, cats());
      const types = ORDER[g.type] || ["task", "idea", "expense"];
      if (g.amount && !types.includes("expense")) types.push("expense");
      sel[it.id] = types[0];
      return `<div class="card" data-i="${it.id}"><div class="quote">«${esc(it.text)}»</div><div class="small muted" style="margin:4px 0 8px">${esc(guessText(g))}</div>
        <div class="row" style="justify-content:space-between"><div class="chips">${types.map((t, i) => `<button class="chip${i === 0 ? " on" : ""}" data-t="${t}">${TYPE_LABEL[t]}</button>`).join("")}</div><button class="btn ghost sm" data-x>✕</button></div></div>`;
    }).join("")}
    ${items.length ? `<button class="btn pri wide" id="all">Разобрать всё</button><p class="hint center">Нажатие на тип сразу сохраняет запись. «Разобрать всё» — принять мои варианты.</p>` : ""}`;
  const re = () => render(main);
  const apply = (it, type) => {
    const g = it.guess && it.guess.type ? it.guess : parse(it.text, cats());
    try { const msg = commit(g, type); learnType(g.title || it.text, type); remove("pb_inbox", it.id); return msg; } catch (e) { toast(e.message, true); return null; }
  };
  $$("[data-i]", main).forEach((c) => {
    const it = items.find((x) => x.id === c.dataset.i);
    $$("[data-t]", c).forEach((b) => (b.onclick = () => { const m = apply(it, b.dataset.t); if (m) { toast(m); re(); } }));
    $("[data-x]", c).onclick = () => { remove("pb_inbox", it.id); re(); };
  });
  $("#all", main) && ($("#all", main).onclick = () => { let n = 0; items.forEach((it) => apply(it, sel[it.id]) && n++); toast(`Разобрано: ${n}`); re(); });
}
