// «Спросить Claude»: вопрос с учётом записей за 14 дней; история ответов.
import { list, fn } from "./db.js";
import { $, esc, busy, aiHtml, dShort, DICT } from "./ui.js";

const KIND = { week: "Разбор недели", idea: "Идея", money: "Траты", ask: "Вопрос" };
const SUGGEST = ["На что я трачу больше всего времени и сил?", "Почему я переношу задачи?", "Что мне стоит изменить на следующей неделе?", "Как связаны моё самочувствие и продуктивность?"];

export async function render(main) {
  const hist = await list("pb_ai", [], "created_at desc", 20);
  main.innerHTML = `<div class="top"><div><a href="#/more" class="small">← Ещё</a><h1>Спросить Claude</h1><div class="sub">Claude видит ваши задачи, переносы, дневник и траты за 14 дней</div></div></div>
    <div class="card"><textarea id="q" placeholder="Ваш вопрос…"></textarea>${DICT}
      <div class="chips" style="margin-top:10px">${SUGGEST.map((s) => `<button class="chip" data-s="${esc(s)}">${esc(s)}</button>`).join("")}</div>
      <button class="btn blue wide" id="go" style="margin-top:12px">✨ Спросить</button></div>
    <div id="out"></div>
    ${hist.length ? `<h3>История</h3>${hist.map((a) => `<details class="card"><summary><b>${KIND[a.kind] || a.kind}</b> · <span class="muted small">${dShort(a.created_at.slice(0, 10))}</span><div class="small">${esc(a.question.slice(0, 120))}</div></summary><div class="ai" style="margin:10px 0 0">${aiHtml(a.answer)}</div></details>`).join("")}` : ""}`;
  main.querySelectorAll("[data-s]").forEach((b) => (b.onclick = () => ($("#q", main).value = b.dataset.s)));
  $("#go", main).onclick = (ev) => busy(ev.currentTarget, async () => {
    const q = $("#q", main).value.trim(); if (!q) throw new Error("Напишите вопрос");
    const j = await fn({ action: "ai", kind: "ask", question: q });
    $("#out", main).innerHTML = `<div class="ai"><div class="who">Claude</div>${aiHtml(j.answer)}</div>`;
  });
}
