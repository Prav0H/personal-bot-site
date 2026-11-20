// «Идеи»: записать (можно голосом), оценить самому и с Claude, превратить в задачу.
import { list, ins, upd, del, fn } from "./db.js";
import { $, $$, esc, toast, sheet, confirmBox, dShort, scale, bindScale, busy, aiHtml, DICT } from "./ui.js";

const ST = { new: ["Новая", ""], work: ["В работе", "hot"], later: ["Позже", ""], done: ["Сделано", "good"], dropped: ["Отброшена", "bad"] };
const score = (i) => (i.value && i.feasibility && i.effort ? Math.round(((i.value * i.feasibility) / i.effort) * 10) / 10 : null);
let filter = "active", sortBy = "new";

export async function render(main) {
  const all = await list("pb_ideas", [], "created_at desc");
  let rows = filter === "active" ? all.filter((i) => ["new", "work"].includes(i.status)) : filter === "later" ? all.filter((i) => i.status === "later") : all;
  if (sortBy === "score") rows = [...rows].sort((a, b) => (score(b) ?? -1) - (score(a) ?? -1));
  main.innerHTML = `<div class="top"><div><h1>Идеи</h1><div class="sub">${all.length ? `${all.length} всего` : "Записывайте всё, что приходит в голову"}</div></div></div>
    <div class="card"><textarea id="it" placeholder="Новая идея… Можно надиктовать" style="min-height:70px"></textarea>${DICT}
      <div class="row" style="margin-top:10px"><div class="seg grow" id="ia"><button data-a="личное" class="on">Личное</button><button data-a="работа">Работа</button></div><button class="btn pri" id="is">Сохранить</button></div></div>
    <div class="row" style="margin-bottom:10px"><div class="seg grow" id="if">${[["active", "Активные"], ["later", "Позже"], ["all", "Все"]].map(([k, l]) => `<button data-f="${k}" class="${filter === k ? "on" : ""}">${l}</button>`).join("")}</div>
      <button class="btn sm" id="sort">${sortBy === "score" ? "⭐ по оценке" : "🕒 новые"}</button></div>
    <div id="il">${rows.map((i) => {
      const sc = score(i);
      return `<div class="card" data-i="${i.id}" style="cursor:pointer"><div style="white-space:pre-wrap;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden">${esc(i.text)}</div>
        <div class="row small muted" style="margin-top:8px;flex-wrap:wrap"><span class="tag ${ST[i.status][1]}">${ST[i.status][0]}</span>${i.area === "работа" ? `<span class="tag work">работа</span>` : ""}
        ${sc !== null ? `<span>⭐ ${sc}</span><span>польза ${i.value} · реально ${i.feasibility} · сложно ${i.effort}</span>` : ""}${i.ai_review ? `<span>✨ разбор Claude</span>` : ""}<span style="margin-left:auto">${dShort(i.created_at.slice(0, 10))}</span></div></div>`;
    }).join("") || `<div class="empty">${filter === "active" ? "Активных идей нет" : "Пусто"}</div>`}</div>
    <p class="hint center">⭐ оценка = польза × реальность ÷ сложность</p>`;

  const re = () => render(main);
  let area = "личное";
  $$("#ia button", main).forEach((b) => (b.onclick = () => { area = b.dataset.a; $$("#ia button", main).forEach((x) => x.classList.toggle("on", x === b)); }));
  $("#is", main).onclick = async () => {
    const text = $("#it", main).value.trim(); if (!text) return toast("Напишите идею", true);
    try { const i = await ins("pb_ideas", { text, area }); toast("Идея сохранена 💡"); await re(); ideaSheet(i, re); } catch (e) { toast(e.message, true); }
  };
  $$("#if button", main).forEach((b) => (b.onclick = () => { filter = b.dataset.f; re(); }));
  $("#sort", main).onclick = () => { sortBy = sortBy === "score" ? "new" : "score"; re(); };
  $$("[data-i]", main).forEach((c) => (c.onclick = () => ideaSheet(all.find((i) => i.id === c.dataset.i), re)));
}

export function ideaSheet(i, onChange) {
  const v = { value: i.value, feasibility: i.feasibility, effort: i.effort };
  let status = i.status;
  const s = sheet(`<h2>Идея</h2><textarea id="tx" style="min-height:90px">${esc(i.text)}</textarea>
    <label class="f">Статус</label><div class="chips" id="st">${Object.entries(ST).map(([k, [l]]) => `<button class="chip${k === status ? " on" : ""}" data-s="${k}">${l}</button>`).join("")}</div>
    <label class="f">Польза — что даст</label>${scale("value", i.value)}
    <label class="f">Реально ли сделать</label>${scale("feasibility", i.feasibility)}
    <label class="f">Сложность — сколько сил</label>${scale("effort", i.effort)}
    <label class="f">Как проверить малыми силами</label><textarea id="cp" placeholder="Эксперимент на 1–2 недели и как понять, что сработало">${esc(i.check_plan)}</textarea>
    <button class="btn pri wide" id="sv" style="margin-top:14px">Сохранить</button>
    <h3>Разбор Claude</h3><div id="ai">${i.ai_review ? `<div class="ai"><div class="who">Claude · ${dShort(String(i.ai_at || i.created_at).slice(0, 10))}</div>${aiHtml(i.ai_review)}</div>` : `<p class="muted small">Claude оценит пользу, реальность и сложность, предложит, как проверить идею, и первый шаг.</p>`}</div>
    <button class="btn wide blue" id="ask">✨ ${i.ai_review ? "Оценить заново" : "Оценить с Claude"}</button>
    <div class="row2"><button class="btn" id="tk">→ В задачи</button><button class="btn" id="dl" style="color:var(--bad)">Удалить</button></div>`);
  const el = s.el;
  bindScale(el, (k, val) => (v[k] = val));
  $$("#st .chip", el).forEach((b) => (b.onclick = () => { status = b.dataset.s; $$("#st .chip", el).forEach((x) => x.classList.toggle("on", x === b)); }));
  const save = async () => { await upd("pb_ideas", [["eq", "id", i.id]], { text: $("#tx", el).value.trim() || i.text, status, ...v, check_plan: $("#cp", el).value.trim(), updated_at: new Date().toISOString() }); };
  $("#sv", el).onclick = async () => { try { await save(); s.close(); toast("Сохранено"); onChange && onChange(); } catch (e) { toast(e.message, true); } };
  $("#ask", el).onclick = (ev) => busy(ev.currentTarget, async () => {
    await save();
    const j = await fn({ action: "ai", kind: "idea", id: i.id });
    $("#ai", el).innerHTML = `<div class="ai"><div class="who">Claude · сейчас</div>${aiHtml(j.answer)}</div>`;
    i.ai_review = j.answer; onChange && onChange();
  });
  $("#tk", el).onclick = async () => {
    const title = ($("#tx", el).value.trim() || i.text).split("\n")[0].slice(0, 140);
    try { await ins("pb_tasks", { title, note: "Из идеи: " + i.text.slice(0, 500), day: null, area: i.area === "работа" ? "работа" : "личное" }); await upd("pb_ideas", [["eq", "id", i.id]], { status: "work" }); s.close(); toast("Добавлено в задачи «когда-нибудь»"); onChange && onChange(); }
    catch (e) { toast(e.message, true); }
  };
  $("#dl", el).onclick = async () => { if (!(await confirmBox("Удалить идею?", "Удалить"))) return; await del("pb_ideas", [["eq", "id", i.id]]); s.close(); onChange && onChange(); };
}
