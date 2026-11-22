// Голосовой ввод: кнопка в центре панели. Диктуете (микрофон клавиатуры iPhone) — Кайрос раскладывает фразу.
// Уверен — сохраняет сам; не уверен — во «Входящие».
import { add, rows } from "./store.js";
import { today } from "./db.js";
import { $, $$, esc, toast, sheet, rub, dRel } from "./ui.js";
import { parse, TYPE_LABEL } from "./parse.js";
import { cats, remindAt, QUAD, quad } from "./model.js";

/** Создать запись по разбору. Возвращает подпись для подтверждения. */
export function commit(p, type = p.type) {
  const td = today();
  if (type === "expense") {
    if (!(p.amount > 0)) throw new Error("Не нашёл сумму — скажите, например, «такси 800»");
    add("pb_expenses", { amount: p.amount, category: p.category || "Прочее", kind: p.kind || "личное", day: p.day || td, note: "", title: p.title, planned: !!p.planned, goal_id: null });
    return `${p.planned ? "Платёж запланирован" : "Расход записан"}: ${rub(p.amount)} · ${p.category || "Прочее"}`;
  }
  if (type === "idea") { add("pb_ideas", { text: p.title || p.text, area: p.kind === "рабочее" ? "работа" : "личное" }); return "Идея сохранена"; }
  if (type === "habit") { add("pb_habits", { title: p.title, active: true, days: p.habitDays, time: p.time || "", sort: rows("pb_habits").length }); return "Привычка добавлена"; }
  if (type === "event") {
    add("pb_events", { title: p.title, day: p.day || td, time: p.time || "", remind_at: p.time ? remindAt(p.day || td, p.time, "15") : null });
    return `Событие: ${dRel(p.day || td, td)}${p.time ? " в " + p.time : ""}${p.time ? " · напомню за 15 минут" : ""}`;
  }
  const remind = p.remind || p.time ? remindAt(p.day || td, p.time, p.time ? "0" : "m10") : null;
  const t = add("pb_tasks", { title: p.title, note: "", day: p.deadline ? p.day : p.day || td, time: p.time || "", important: !!p.important, urgent: !!p.urgent, area: p.kind === "рабочее" ? "работа" : "личное", remind_at: remind, in_plan: false, moves: 0 });
  return `Задача: ${QUAD[quad(t, td)].t.toLowerCase()}${t.day ? " · " + dRel(t.day, td) : ""}${t.time ? " " + t.time : ""}${remind ? " · напомню" : ""}`;
}

export function toInbox(p) { add("pb_inbox", { text: p.text, guess: p }); }

export function guessText(p) {
  if (p.type === "expense") return `${p.why === "похоже на трату" || !p.confident ? "Похоже на расход" : "Расход"} ${rub(p.amount)} · ${p.category}`;
  if (p.type === "task" && p.amount) return `Похоже на задачу с бюджетом ${rub(p.amount)}`;
  if (p.type === "habit") return `Похоже на привычку · ${p.habitDays.length === 7 ? "каждый день" : "по будням"}${p.time ? " " + p.time : ""}`;
  if (p.type === "idea") return p.why ? "Идея или задача?" : "Идея";
  if (p.type === "event") return `Событие ${dRel(p.day, today())}${p.time ? " в " + p.time : ""}`;
  return `Задача${p.day ? " · " + dRel(p.day, today()) : ""}${p.time ? " в " + p.time : ""}`;
}

export function openVoice(onDone) {
  let chosen = null;
  const s = sheet(`<div class="row" style="justify-content:space-between"><button class="btn ghost" data-close>Отмена</button><span class="cap" style="margin:0">Запись</span><span style="width:60px"></span></div>
    <div class="rec-orb"><img src="icons/icon-192.png" alt=""></div>
    <div class="cap center" style="margin:6px 0">Слушаю</div>
    <textarea id="vt" placeholder="Нажмите 🎤 на клавиатуре и говорите: «завтра оплатить аренду сорок пять тысяч»" style="font:italic 17px/1.35 var(--serif);text-align:center;min-height:90px;background:transparent;border:1px solid var(--line2)"></textarea>
    <div class="pv" id="pv"></div>
    <div class="chips" id="vtype" style="justify-content:center"></div>
    <button class="btn pri wide" id="vs" style="margin-top:12px">Сохранить</button>
    <p class="hint center">Не уверен — положу во «Входящие», там выберете тип одним касанием.</p>`, { onClose: () => onDone && onDone() });
  const el = s.el, ta = $("#vt", el);
  ta.focus(); // в том же касании — iPhone откроет клавиатуру
  const draw = () => {
    const v = ta.value.trim();
    if (!v) { $("#pv", el).innerHTML = ""; $("#vtype", el).innerHTML = ""; return; }
    const p = parse(v, cats()), type = chosen || p.type;
    const bits = [`<span class="tag ${type === "expense" ? "terra" : "gold"}">${TYPE_LABEL[type]}</span>`];
    if (type === "expense" && p.amount) bits.push(`<span class="chip">${rub(p.amount)}</span>`, `<span class="chip">${esc(p.category)}</span>`);
    if (p.day && type !== "idea" && type !== "habit") bits.push(`<span class="chip">${dRel(p.day, today())}</span>`);
    if (p.time) bits.push(`<span class="chip">${p.time}</span>`);
    if (type === "task" && (p.important || p.urgent)) bits.push(`<span class="chip">${p.urgent ? "срочно" : ""}${p.urgent && p.important ? " · " : ""}${p.important ? "важно" : ""}</span>`);
    if (!p.confident && !chosen) bits.push(`<span class="chip" style="border-style:dashed">не уверен</span>`);
    $("#pv", el).innerHTML = bits.join("");
    $("#vtype", el).innerHTML = Object.entries(TYPE_LABEL).map(([k, l]) => `<button class="chip${k === type ? " on" : ""}" data-t="${k}">${k === type ? l : "Это " + l.toLowerCase()}</button>`).join("");
    $$("#vtype .chip", el).forEach((b) => (b.onclick = () => { chosen = b.dataset.t; draw(); }));
  };
  ta.oninput = draw;
  $("#vs", el).onclick = () => {
    const v = ta.value.trim(); if (!v) return toast("Скажите или напишите что-нибудь", true);
    const p = parse(v, cats());
    try {
      if (!chosen && !p.confident) { toInbox(p); toast("Положил во «Входящие» — разберёте одним касанием"); }
      else toast(commit(p, chosen || p.type));
      s.close();
    } catch (e) { toast(e.message, true); }
  };
}
