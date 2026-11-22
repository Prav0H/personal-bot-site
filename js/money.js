// «Финансы»: остаток на счёте, траты месяца против бюджета, прогноз с учётом платежей, категории, операции.
import { rows, add, patch, remove, settings, setSettings } from "./store.js";
import { today, addDays, dayDiff, fn } from "./db.js";
import { $, $$, esc, toast, sheet, confirmBox, rub, dShort, dRel, busy, aiHtml } from "./ui.js";
import { cats, sum, balanceNow } from "./model.js";
import { learnCategory } from "./assistant.js";

const MONTH = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];

export function expenseSheet(e0, onChange) {
  const isNew = !e0?.id, td = today();
  const e = { amount: "", category: cats()[0], kind: "личное", day: td, note: "", title: "", planned: false, goal_id: null, ...e0 };
  let cat = e.category, kind = e.kind;
  const goals = rows("pb_goals").filter((g) => g.status !== "done");
  const s = sheet(`<h2>${isNew ? "Новая операция" : "Операция"}</h2>
    <input id="am" inputmode="decimal" placeholder="0 ₽" value="${e.amount ? +e.amount : ""}" style="font:400 32px var(--serif);text-align:center;padding:12px">
    <input id="ti" placeholder="Что это: продукты, аренда, билеты…" value="${esc(e.title || e.note)}" style="margin-top:8px">
    <label class="f">Категория</label><div class="chips" id="ec">${cats().map((c) => `<button class="chip${c === cat ? " on" : ""}" data-c="${esc(c)}">${esc(c)}</button>`).join("")}</div>
    <div id="gwrap" style="${cat === "Целевые" ? "" : "display:none"}"><label class="f">На какую цель</label><select id="eg"><option value="">— выберите цель —</option>${goals.map((g) => `<option value="${g.id}" ${e.goal_id === g.id ? "selected" : ""}>${esc(g.title)}</option>`).join("")}</select></div>
    <div class="row2"><div><label class="f">Дата</label><input type="date" id="ed" value="${e.day}"></div><div><label class="f">Чья</label><select id="ek"><option ${kind === "личное" ? "selected" : ""}>личное</option><option ${kind === "рабочее" ? "selected" : ""}>рабочее</option></select></div></div>
    <label class="chk row" style="margin-top:12px;gap:8px"><input type="checkbox" id="ep" ${e.planned ? "checked" : ""}> <span>Запланированный платёж (ещё не оплачен)</span></label>
    <button class="btn pri wide" id="es" style="margin-top:12px">${isNew ? "Записать" : "Сохранить"}</button>
    ${isNew ? "" : `<div class="row2">${e.planned ? `<button class="btn" id="paid">✓ Оплачено</button>` : "<span></span>"}<button class="btn danger" id="ex">Удалить</button></div>`}`);
  const el = s.el;
  if (isNew && !e.amount) setTimeout(() => $("#am", el).focus(), 50);
  $("#ed", el).onchange = () => { if ($("#ed", el).value > td) $("#ep", el).checked = true; };
  $$("#ec .chip", el).forEach((b) => (b.onclick = () => { cat = b.dataset.c; $$("#ec .chip", el).forEach((x) => x.classList.toggle("on", x === b)); $("#gwrap", el).style.display = cat === "Целевые" ? "" : "none"; }));
  $("#es", el).onclick = () => {
    const amount = +String($("#am", el).value).replace(/\s/g, "").replace(",", ".");
    if (!(amount > 0)) return toast("Введите сумму", true);
    const row = { amount, title: $("#ti", el).value.trim(), note: "", category: cat, kind: $("#ek", el).value, day: $("#ed", el).value || td, planned: $("#ep", el).checked, goal_id: cat === "Целевые" ? $("#eg", el).value || null : null };
    if (isNew) add("pb_expenses", row); else patch("pb_expenses", e.id, row);
    if (!isNew && e.category && row.category !== e.category && row.title) learnCategory(row.title, row.category); // исправили категорию — запомнить
    s.close(); toast(row.planned ? `Платёж запланирован: ${rub(amount)}` : `Записано: ${rub(amount)}`); onChange && onChange();
  };
  if (!isNew) {
    $("#paid", el) && ($("#paid", el).onclick = () => { patch("pb_expenses", e.id, { planned: false, day: e.day > td ? td : e.day }); s.close(); toast("Отмечено как оплаченное"); onChange && onChange(); });
    $("#ex", el).onclick = async () => { if (!(await confirmBox("Удалить операцию?", "Удалить"))) return; remove("pb_expenses", e.id); s.close(); onChange && onChange(); };
  }
}

function balanceSheet(onChange) {
  const s = settings();
  const sh = sheet(`<h2>Сколько на счёте</h2><p class="muted small">Впишите остаток сейчас. Траты, записанные со следующего дня, будут вычитаться сами.</p>
    <input id="bl" inputmode="decimal" value="${balanceNow() != null ? Math.round(balanceNow()) : ""}" placeholder="0 ₽" style="font:400 30px var(--serif);text-align:center">
    <label class="f">Бюджет трат на месяц, ₽</label><input id="bd" inputmode="decimal" value="${s.budget ? +s.budget : ""}" placeholder="не задан">
    <button class="btn pri wide" id="bs" style="margin-top:12px">Сохранить</button>`);
  $("#bs", sh.el).onclick = () => {
    const b = String($("#bl", sh.el).value).trim(), bd = +String($("#bd", sh.el).value).replace(/\s/g, "").replace(",", ".") || null;
    setSettings({ balance: b === "" ? null : +b.replace(/\s/g, "").replace(",", "."), balance_at: today(), budget: bd });
    sh.close(); onChange && onChange();
  };
}

let catF = null;
export function render(main) {
  const td = today(), mStart = td.slice(0, 8) + "01";
  const mEndD = new Date(+td.slice(0, 4), +td.slice(5, 7), 0).toLocaleDateString("en-CA");
  const all = rows("pb_expenses");
  const month = all.filter((e) => !e.planned && e.day >= mStart && e.day <= td);
  const planned = all.filter((e) => e.planned).sort((a, b) => a.day.localeCompare(b.day));
  const spent = sum(month), budget = +settings().budget || 0;
  const bal = balanceNow();
  const plannedMonth = planned.filter((e) => e.day <= mEndD);
  const forecast = bal != null ? bal - sum(plannedMonth) : null;
  const next = planned.find((e) => e.day >= td);
  const byCat = {}; month.forEach((e) => (byCat[e.category] = (byCat[e.category] || 0) + +e.amount));
  const catList = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const max = catList[0]?.[1] || 1;
  const recent = [...planned.filter((e) => e.day >= addDays(td, -3)), ...all.filter((e) => !e.planned).sort((a, b) => String(b.day).localeCompare(a.day) || String(b.created_at).localeCompare(a.created_at))].filter((e) => !catF || e.category === catF).slice(0, catF ? 60 : 20);
  const overdue = planned.filter((e) => e.day < td);
  const say = next ? `${dRel(next.day, td).replace(/^./, (c) => c.toUpperCase())} ${esc((next.title || next.category).toLowerCase())} — ${Math.round(next.amount).toLocaleString("ru-RU")}.${forecast != null ? ` До конца месяца останется ${Math.round(forecast).toLocaleString("ru-RU")}.` : ""}`
    : bal == null ? "Впишите остаток на счёте — посчитаю прогноз до конца месяца." : budget ? `До конца месяца в бюджете осталось ${rub(Math.max(0, budget - spent))}.` : "Запланированных платежей нет.";

  main.innerHTML = `<div class="cap" style="margin-top:6px">Финансы · ${MONTH[+td.slice(5, 7) - 1]}</div>
    <div class="row" style="justify-content:space-between;align-items:flex-end"><div id="bal" style="cursor:pointer"><div class="small muted">на счёте</div><div class="big">${bal != null ? rub(bal) : "— ₽"}</div></div>
      <div class="right"><div class="small muted">потрачено</div><b>${Math.round(spent).toLocaleString("ru-RU")}</b>${budget ? `<span class="muted small"> / ${rub(budget)}</span>` : ""}</div></div>
    ${budget ? `<div class="progress" style="margin:10px 0 0"><i style="width:${Math.min(100, (spent / budget) * 100)}%"></i></div>` : ""}
    <p class="voice" style="margin-top:10px">${say}</p>
    ${overdue.length ? `<div class="card" style="border-color:var(--terra)"><b style="color:var(--terra)">Платежи с прошедшей датой: ${overdue.length}</b><div class="small muted">Отметьте «оплачено» или перенесите — нажмите на платёж ниже.</div></div>` : ""}
    ${catList.length ? `<div class="card"><div class="row" style="justify-content:space-between"><div class="cap" style="margin:0 0 8px">Категории</div><a class="small" href="#/review">анализ →</a></div><div class="bars">${catList.map(([c, v]) => `<div class="bar${c === "Целевые" ? " hot" : ""}${catF && catF !== c ? " dim" : ""}" data-c="${esc(c)}"><span>${esc(c)}</span><div class="progress"><i style="width:${(v / max) * 100}%"></i></div><span>${rub(v)}</span></div>`).join("")}</div>${catF ? `<button class="btn ghost sm" id="nocat">Все категории</button>` : ""}</div>` : ""}
    <div class="card flat"><div class="cap" style="margin:12px 13px 4px">${catF ? esc(catF) : "Последние"}</div>
      ${recent.map((e) => `<div class="li" data-e="${e.id}"><div class="tx"><div>${esc(e.title || e.note || e.category)}</div><div class="s">${esc(e.category)}${e.goal_id ? " · цель" : ""} · ${e.planned ? (e.day < td ? "просрочено · " : "") + dRel(e.day, td) + " · запланировано" : dRel(e.day, td)}${e.kind === "рабочее" ? " · рабочее" : ""}</div></div><span class="amount"${e.planned ? ' style="color:var(--terra)"' : ""}>${rub(e.amount)}</span></div>`).join("") || `<div class="empty">Операций нет. Нажмите ＋ или скажите «такси восемьсот».</div>`}</div>
    <div class="row" style="margin-top:4px"><button class="btn sm grow" id="pl">＋ Платёж на будущее</button><button class="btn sm grow blue" id="ai">✨ Объяснить траты</button></div><div id="aiout" style="margin-top:8px"></div>
    <button class="fab" id="add" aria-label="Добавить">＋</button>`;
  const re = () => render(main);
  $("#bal", main).onclick = () => balanceSheet(re);
  $("#add", main).onclick = () => expenseSheet(null, re);
  $("#pl", main).onclick = () => expenseSheet({ planned: true, day: addDays(td, 1) }, re);
  $$("[data-c]", main).forEach((b) => (b.onclick = () => { catF = catF === b.dataset.c ? null : b.dataset.c; re(); }));
  $("#nocat", main) && ($("#nocat", main).onclick = () => { catF = null; re(); });
  $$("[data-e]", main).forEach((r) => (r.onclick = () => expenseSheet(all.find((e) => e.id === r.dataset.e), re)));
  $("#ai", main).onclick = (ev) => busy(ev.currentTarget, async () => {
    const j = await fn({ action: "ai", kind: "money", from: mStart, to: td });
    $("#aiout", main).innerHTML = `<div class="ai"><div class="who">Кайрос · Claude</div>${aiHtml(j.answer)}</div>`;
  });
}
