// «Идеи»: пока не обязательства. Фильтр «Все / Тропос / Личное», «в задачу», «в цель», оценка с Claude.
import { rows, add, patch, remove } from "./store.js";
import { fn } from "./db.js";
import { $, $$, esc, toast, sheet, confirmBox, dShort, dRel, scale, bindScale, busy, aiHtml, DICT } from "./ui.js";
import { today } from "./db.js";

let filter = "all";
const toTask = (i) => { add("pb_tasks", { title: i.text.split("\n")[0].slice(0, 140), note: i.text.length > 140 ? i.text : "", day: null, important: true, urgent: false, area: i.area === "работа" ? "работа" : "личное", in_plan: false, moves: 0 }); patch("pb_ideas", i.id, { status: "work" }); toast("Задача в матрице: важное несрочное"); };
const toGoal = (i) => { const g = add("pb_goals", { title: i.text.split("\n")[0].slice(0, 80), why: i.text, status: "active", milestones: [], sort: rows("pb_goals").length }); patch("pb_ideas", i.id, { status: "work" }); toast("Цель создана"); location.hash = "#/goal/" + g.id; };

export function render(main) {
  const all = [...rows("pb_ideas")].filter((i) => !["done", "dropped"].includes(i.status)).sort((a, b) => String(b.created_at).localeCompare(a.created_at));
  const list = all.filter((i) => filter === "all" || (filter === "tropos" ? i.area === "работа" : i.area !== "работа"));
  main.innerHTML = `<a class="back" href="#/today">‹ Сегодня</a><div class="cap" style="margin-top:2px">Идеи</div><h1>Пока не обязательства</h1>
    <p class="voice">Созреет — одной кнопкой сделаю задачей или целью.</p>
    <div class="row" style="margin-bottom:10px"><div class="chips">${[["all", "Все"], ["tropos", "Тропос"], ["me", "Личное"]].map(([k, l]) => `<button class="chip${filter === k ? " on" : ""}" data-f="${k}">${l}</button>`).join("")}</div><button class="btn sm" id="ni" style="margin-left:auto">＋ Идея</button></div>
    ${list.map((i) => `<div class="card" data-i="${i.id}"><div class="quote" data-open style="cursor:pointer">«${esc(i.text)}»</div>
      <div class="row" style="justify-content:space-between;margin-top:8px"><span class="small muted">${dRel(String(i.created_at).slice(0, 10), today())} · ${i.area === "работа" ? "тропос" : "личное"}${i.ai_review ? " · ✨" : ""}${i.status === "work" ? " · в работе" : ""}</span>
      <div class="row"><button class="chip" data-t>в задачу</button><button class="chip" data-g>в цель</button></div></div></div>`).join("") || `<div class="empty">Идей нет. Нажмите 🎙 и скажите «идея …».</div>`}`;
  const re = () => render(main);
  $$("[data-f]", main).forEach((b) => (b.onclick = () => { filter = b.dataset.f; re(); }));
  $("#ni", main).onclick = () => ideaSheet({}, re);
  $$("[data-i]", main).forEach((c) => {
    const i = all.find((x) => x.id === c.dataset.i);
    $("[data-open]", c).onclick = () => ideaSheet(i, re);
    $("[data-t]", c).onclick = () => { toTask(i); re(); };
    $("[data-g]", c).onclick = () => toGoal(i);
  });
}

export function ideaSheet(i0, onChange) {
  const isNew = !i0?.id, i = { text: "", area: "личное", value: null, feasibility: null, effort: null, check_plan: "", ai_review: "", ...i0 };
  const v = { value: i.value, feasibility: i.feasibility, effort: i.effort };
  const s = sheet(`<h2>${isNew ? "Новая идея" : "Идея"}</h2><textarea id="tx" style="min-height:80px;font:italic 15px/1.35 var(--serif)" placeholder="Дословно, как пришла в голову">${esc(i.text)}</textarea>${DICT}
    <div class="seg" id="ar" style="margin-top:8px"><button data-a="личное" class="${i.area !== "работа" ? "on" : ""}">Личное</button><button data-a="работа" class="${i.area === "работа" ? "on" : ""}">Тропос</button></div>
    ${isNew ? "" : `<label class="f">Польза</label>${scale("value", i.value)}<label class="f">Реально сделать</label>${scale("feasibility", i.feasibility)}<label class="f">Сложность</label>${scale("effort", i.effort)}
    <label class="f">Как проверить малыми силами</label><textarea id="cp">${esc(i.check_plan)}</textarea>`}
    <button class="btn pri wide" id="sv" style="margin-top:12px">${isNew ? "Сохранить идею" : "Сохранить"}</button>
    ${isNew ? "" : `<div class="cap">Разбор Claude</div><div id="ai">${i.ai_review ? `<div class="ai">${aiHtml(i.ai_review)}</div>` : `<p class="muted small">Польза, реальность, сложность, как проверить и первый шаг.</p>`}</div>
    <button class="btn wide blue" id="ask">✨ ${i.ai_review ? "Оценить заново" : "Оценить с Claude"}</button>
    <div class="row2"><button class="btn" id="tk">→ В задачу</button><button class="btn" id="tg">→ В цель</button></div>
    <div class="row2"><button class="btn" id="dn">Отложить / сделано</button><button class="btn danger" id="dl">Удалить</button></div>`}`);
  const el = s.el;
  let area = i.area;
  $$("#ar button", el).forEach((b) => (b.onclick = () => { area = b.dataset.a; $$("#ar button", el).forEach((x) => x.classList.toggle("on", x === b)); }));
  if (isNew) setTimeout(() => $("#tx", el).focus(), 50); else bindScale(el, (k, val) => (v[k] = val));
  const save = () => { const text = $("#tx", el).value.trim(); if (!text) { toast("Напишите идею", true); return null; } return isNew ? add("pb_ideas", { text, area }) : patch("pb_ideas", i.id, { text, area, ...v, check_plan: $("#cp", el)?.value.trim() || "", updated_at: new Date().toISOString() }); };
  $("#sv", el).onclick = () => { if (save()) { s.close(); toast(isNew ? "Идея сохранена 💡" : "Сохранено"); onChange && onChange(); } };
  if (isNew) return;
  $("#ask", el).onclick = (ev) => busy(ev.currentTarget, async () => { save(); const j = await fn({ action: "ai", kind: "idea", id: i.id }); patch("pb_ideas", i.id, { ai_review: j.answer, ai_at: new Date().toISOString() }); $("#ai", el).innerHTML = `<div class="ai">${aiHtml(j.answer)}</div>`; });
  $("#tk", el).onclick = () => { save(); toTask({ ...i, text: $("#tx", el).value.trim(), area }); s.close(); onChange && onChange(); };
  $("#tg", el).onclick = () => { save(); s.close(); toGoal({ ...i, text: $("#tx", el).value.trim() }); };
  $("#dn", el).onclick = () => { patch("pb_ideas", i.id, { status: "done" }); s.close(); onChange && onChange(); };
  $("#dl", el).onclick = async () => { if (await confirmBox("Удалить идею?", "Удалить")) { remove("pb_ideas", i.id); s.close(); onChange && onChange(); } };
}
