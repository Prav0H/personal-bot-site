// «Спросить Claude»: вопрос с учётом записей за 14 дней; история ответов.
import { rows } from "./store.js";
import { fn } from "./db.js";
import { $, $$, esc, busy, aiHtml, dShort, DICT } from "./ui.js";

const KIND = { week: "Разбор", idea: "Идея", money: "Траты", ask: "Вопрос" };
const SUGGEST = ["Почему я переношу задачи?", "Что изменить на следующей неделе?", "Как связаны самочувствие и продуктивность?", "Где я трачу лишнее?"];
export function render(main) {
  const hist = [...rows("pb_ai")].sort((a, b) => String(b.created_at).localeCompare(a.created_at)).slice(0, 20);
  main.innerHTML = `<a class="back" href="#/more">‹ Ещё</a><h1>Спросить Claude</h1><p class="voice">Claude видит ваши задачи, переносы, дневник и траты за 14 дней.</p>
    <div class="card"><textarea id="q" placeholder="Ваш вопрос…"></textarea>${DICT}<div class="chips" style="margin-top:8px">${SUGGEST.map((s) => `<button class="chip" data-s="${esc(s)}">${esc(s)}</button>`).join("")}</div>
      <button class="btn pri wide" id="go" style="margin-top:10px">✨ Спросить</button></div><div id="out"></div>
    ${hist.length ? `<div class="cap">История</div>${hist.map((a) => `<details class="card"><summary><b>${KIND[a.kind] || a.kind}</b> · <span class="muted small">${dShort(String(a.created_at).slice(0, 10))}</span><div class="small">${esc(a.question.slice(0, 120))}</div></summary><div class="ai" style="margin:10px 0 0">${aiHtml(a.answer)}</div></details>`).join("")}` : ""}`;
  $$("[data-s]", main).forEach((b) => (b.onclick = () => ($("#q", main).value = b.dataset.s)));
  $("#go", main).onclick = (ev) => busy(ev.currentTarget, async () => { const q = $("#q", main).value.trim(); if (!q) throw new Error("Напишите вопрос"); const j = await fn({ action: "ai", kind: "ask", question: q }); $("#out", main).innerHTML = `<div class="ai"><div class="who">Кайрос · Claude</div>${aiHtml(j.answer)}</div>`; });
}
