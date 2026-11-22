// Голосовой ввод: кнопка в центре панели. Диктуете (микрофон клавиатуры iPhone) — Кайрос раскладывает фразу.
// Уверен — сохраняет сам; не уверен — во «Входящие».
import { add, rows } from "./store.js";
import { today } from "./db.js";
import { $, $$, esc, toast, sheet, rub, dRel } from "./ui.js";
import { parse, TYPE_LABEL } from "./parse.js";
import { hints, learnType } from "./assistant.js";
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

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let srBroken = false; // распознавание запрещено в настройках iPhone — дальше сразу микрофон клавиатуры
let active = null;    // единственная запись на всё приложение
const IOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

export function openVoice(onDone) {
  let chosen = null, rec = null, listening = false, finalText = "";
  const s = sheet(`<div class="cap center" style="margin:2px 0 0">Запись</div>
    <div class="rec-orb"><img src="icons/icon-192.png" alt=""></div>
    <div class="cap center" style="margin:6px 0" id="vlab">Слушаю</div>
    <div class="wave" id="wave">${"<i></i>".repeat(24)}</div>
    <textarea id="vt" placeholder="Говорите: «завтра оплатить аренду сорок пять тысяч»" style="font:italic 17px/1.35 var(--serif);text-align:center;min-height:84px;background:transparent;border:1px solid var(--line2)"></textarea>
    <div class="pv" id="pv"></div>
    <div class="chips" id="vtype" style="justify-content:center"></div>
    <div class="row" style="margin-top:12px"><button class="btn" data-close>Отмена</button><button class="btn grow" id="vmic">■ Готово</button><button class="btn pri grow" id="vs">Сохранить</button></div>
    <p class="hint center" id="vhint">Не уверен — положу во «Входящие», там выберете тип одним касанием.</p>`, { onClose: () => { stop(); onDone && onDone(); } });
  const el = s.el, ta = $("#vt", el);
  const ui = (on) => { listening = on; el.classList.toggle("listening", on); $("#vlab", el).textContent = on ? "Слушаю" : ta.value.trim() ? "Записано" : "Нажмите «Говорить»"; $("#vmic", el).textContent = on ? "■ Готово" : "🎙 Говорить"; $("#wave", el).style.visibility = on ? "visible" : "hidden"; };
  const keyboard = (msg) => { ui(false); $("#vlab", el).textContent = "Продиктуйте клавиатурой"; $("#vhint", el).textContent = (msg ? msg + " " : "") + "Нажмите на поле выше, затем 🎤 на клавиатуре iPhone."; };
  // iPhone слушает короткими отрезками и обрывает запись на паузе. Поэтому: пока человек не нажал «Готово»,
  // запись перезапускается сама (до ~40 с), текст копится; прошлую запись всегда закрываем до новой.
  let userStop = false, restarts = 0, until = 0, gotText = false;
  function stop() { userStop = true; const r = rec; rec = null; try { r && (gotText ? r.stop() : r.abort()); } catch (e) {} if (listening) { ui(false); draw(); } }
  function launch() {
    try { active && active.abort(); } catch (e) {}
    const r = new SR(); rec = r; active = r;
    r.lang = "ru-RU"; r.interimResults = true; r.continuous = true; r.maxAlternatives = 1; // continuous: не обрывать на паузе (где поддерживается)
    let started = false, base = finalText;
    r.onstart = () => (started = true);
    r.onresult = (e) => { let fin = "", tmp = ""; for (let i = 0; i < e.results.length; i++) { const x = e.results[i]; if (x.isFinal) fin += x[0].transcript; else tmp += x[0].transcript; } finalText = (base + " " + fin).trim(); ta.value = (finalText + " " + tmp).trim(); if (ta.value) gotText = true; draw(); };
    r.onerror = (e) => {
      if ((e.error === "not-allowed" || e.error === "service-not-allowed") && restarts > 0) { userStop = true; return; } // авто-продолжение запрещено — просто заканчиваем
      if (e.error === "not-allowed" || e.error === "service-not-allowed") { userStop = true; srBroken = true; keyboard("Нет доступа к микрофону или распознаванию. Разрешите: Настройки iPhone → Конфиденциальность → Распознавание речи и Микрофон. Пока — диктуйте клавиатурой 🎤."); }
    };
    r.onend = () => {
      if (rec !== r) return;
      rec = null;
      if (!userStop && Date.now() < until && restarts < 12) { restarts++; setTimeout(() => { if (!userStop) launch(); }, 120); return; } // пауза — слушаем дальше
      if (listening) { ui(false); draw(); if (!gotText) $("#vhint", el).textContent = "Не расслышал. Нажмите «Говорить» и скажите ещё раз — или продиктуйте клавиатурой 🎤."; }
    };
    r.start();
    setTimeout(() => { if (!started && rec === r && !gotText) { try { r.abort(); } catch (e) {} rec = null; if (!userStop) keyboard("Распознавание не запустилось — нажмите «Говорить» ещё раз или продиктуйте клавиатурой."); } }, 3500);
  }
  function start() {
    if (!SR) return keyboard();
    if (srBroken) return keyboard("Распознавание iPhone недоступно — диктуйте микрофоном клавиатуры 🎤.");
    userStop = false; restarts = 0; until = Date.now() + 40e3;
    finalText = ta.value.trim();
    try { ui(true); launch(); } catch (e) { keyboard(); }
  }
  const draw = () => {
    const v = ta.value.trim();
    if (!v) { $("#pv", el).innerHTML = ""; $("#vtype", el).innerHTML = ""; return; }
    const p = parse(v, cats(), hints()), type = chosen || p.type;
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
  ta.onfocus = () => { if (listening) stop(); };
  $("#vmic", el).onclick = () => (listening ? stop() : start());
  $("#vs", el).onclick = () => {
    stop();
    const v = ta.value.trim(); if (!v) return toast("Скажите или напишите что-нибудь", true);
    const p = parse(v, cats(), hints());
    try {
      if (!chosen && !p.confident) { toInbox(p); toast("Положил во «Входящие» — разберёте одним касанием"); }
      else { if (chosen && chosen !== p.type) learnType(p.title, chosen); toast(commit(p, chosen || p.type)); }
      s.close();
    } catch (e) { toast(e.message, true); }
  };
  start(); // в том же касании, что и кнопка 🎙, — так iPhone разрешает запись
}
