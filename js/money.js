// «Деньги»: быстрый ввод трат, итоги за период, категории, сравнение, бюджет, объяснение от Claude.
import { list, ins, upd, del, today, addDays, dayDiff, fn } from "./db.js";
import { $, $$, esc, toast, sheet, confirmBox, rub, dShort, dLong, wd, busy, aiHtml, DICT } from "./ui.js";
import { S } from "./main.js";

const cats = () => (S.set?.categories?.length ? S.set.categories : ["Еда", "Кафе", "Транспорт", "Дом", "Здоровье", "Другое"]);
const ICON = { "Еда": "🛒", "Кафе": "☕", "Транспорт": "🚕", "Дом": "🏠", "Здоровье": "💊", "Одежда": "👕", "Связь": "📱", "Подписки": "🔁", "Подарки": "🎁", "Развлечения": "🎬", "Работа": "💼", "Другое": "•" };
export const icon = (c) => ICON[c] || "•";

export function expenseSheet(e, onDone) {
  const td = today();
  let cat = e?.category || cats()[0], kind = e?.kind || "личное";
  const s = sheet(`<h2>${e ? "Трата" : "Новая трата"}</h2>
    <input id="am" inputmode="decimal" placeholder="0 ₽" value="${e ? +e.amount : ""}" style="font-size:34px;font-weight:700;text-align:center;padding:14px" autocomplete="off">
    <label class="f">Категория</label><div class="chips" id="ec">${cats().map((c) => `<button class="chip${c === cat ? " on" : ""}" data-c="${esc(c)}">${icon(c)} ${esc(c)}</button>`).join("")}</div>
    <label class="f">Чья трата</label><div class="seg" id="ek"><button data-k="личное" class="${kind === "личное" ? "on" : ""}">Личная</button><button data-k="рабочее" class="${kind === "рабочее" ? "on" : ""}">Рабочая</button></div>
    <div class="row" style="margin-top:10px"><input type="date" id="ed" value="${e?.day || td}" class="grow"><input id="en" placeholder="Комментарий" value="${esc(e?.note || "")}" class="grow"></div>
    <button class="btn pri wide" id="es" style="margin-top:14px">${e ? "Сохранить" : "Записать"}</button>
    ${e ? `<button class="btn wide" id="ex" style="margin-top:8px;color:var(--bad)">Удалить</button>` : ""}`);
  const el = s.el;
  setTimeout(() => !e && $("#am", el).focus(), 250);
  $$("#ec .chip", el).forEach((b) => (b.onclick = () => { cat = b.dataset.c; $$("#ec .chip", el).forEach((x) => x.classList.toggle("on", x === b)); }));
  $$("#ek button", el).forEach((b) => (b.onclick = () => { kind = b.dataset.k; $$("#ek button", el).forEach((x) => x.classList.toggle("on", x === b)); }));
  $("#es", el).onclick = async () => {
    const amount = +String($("#am", el).value).replace(/\s/g, "").replace(",", ".");
    if (!(amount > 0)) return toast("Введите сумму", true);
    const row = { amount, category: cat, kind, day: $("#ed", el).value || td, note: $("#en", el).value.trim() };
    try { if (e) await upd("pb_expenses", [["eq", "id", e.id]], row); else await ins("pb_expenses", row); s.close(); toast(e ? "Сохранено" : `Записано: ${rub(amount)}`); onDone && onDone(); }
    catch (err) { toast(err.message, true); }
  };
  if (e) $("#ex", el).onclick = async () => { if (!(await confirmBox("Удалить трату?", "Удалить"))) return; await del("pb_expenses", [["eq", "id", e.id]]); s.close(); onDone && onDone(); };
}

let per = "month", custom = null, catF = null, kindF = "all";
function range() {
  const td = today();
  if (per === "week") return [addDays(td, -6), td];
  if (per === "month") return [td.slice(0, 8) + "01", td];
  if (per === "prev") { const first = td.slice(0, 8) + "01", end = addDays(first, -1); return [end.slice(0, 8) + "01", end]; }
  return custom || [addDays(td, -29), td];
}

export async function render(main) {
  const [from, to] = range();
  const len = dayDiff(from, to) + 1;
  const pf = per === "month" ? addDays(from, -1).slice(0, 8) + "01" : addDays(from, -len), pt = per === "month" ? addDays(pf, dayDiff(from, to)) : addDays(from, -1);
  const [rows, prev, monthRows] = await Promise.all([
    list("pb_expenses", [["gte", "day", from], ["lte", "day", to]], ["day desc", "created_at desc"]),
    list("pb_expenses", [["gte", "day", pf], ["lte", "day", pt]]),
    S.set?.budget ? list("pb_expenses", [["gte", "day", today().slice(0, 8) + "01"], ["eq", "kind", "личное"]]) : Promise.resolve([]),
  ]);
  const vis = rows.filter((e) => (kindF === "all" || e.kind === kindF) && (!catF || e.category === catF));
  const sum = (r) => r.reduce((a, e) => a + +e.amount, 0);
  const all = sum(rows.filter((e) => kindF === "all" || e.kind === kindF)), prevAll = sum(prev.filter((e) => kindF === "all" || e.kind === kindF));
  const pers = sum(rows.filter((e) => e.kind === "личное")), work = sum(rows.filter((e) => e.kind === "рабочее"));
  const delta = prevAll ? Math.round(((all - prevAll) / prevAll) * 100) : null;
  const byCat = {};
  rows.filter((e) => kindF === "all" || e.kind === kindF).forEach((e) => (byCat[e.category] = (byCat[e.category] || 0) + +e.amount));
  const prevCat = {};
  prev.filter((e) => kindF === "all" || e.kind === kindF).forEach((e) => (prevCat[e.category] = (prevCat[e.category] || 0) + +e.amount));
  const catList = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const max = catList[0]?.[1] || 1;
  const days = []; for (let d = from; d <= to && days.length < 31; d = addDays(d, 1)) days.push(d);
  const perDay = Object.fromEntries(days.map((d) => [d, sum(rows.filter((e) => e.day === d && (kindF === "all" || e.kind === kindF)))]));
  const dmax = Math.max(1, ...Object.values(perDay));
  const budget = +S.set?.budget || 0, mSpent = sum(monthRows);
  const groups = {};
  vis.forEach((e) => (groups[e.day] = groups[e.day] || []).push(e));

  main.innerHTML = `<div class="top"><div><h1>Деньги</h1><div class="sub">${dShort(from)} — ${dShort(to)}</div></div></div>
    <div class="seg" id="per">${[["week", "7 дней"], ["month", "Месяц"], ["prev", "Прошлый"], ["custom", "Период"]].map(([k, l]) => `<button data-p="${k}" class="${per === k ? "on" : ""}">${l}</button>`).join("")}</div>
    ${per === "custom" ? `<div class="row" style="margin-top:8px"><input type="date" id="cf" value="${from}"><input type="date" id="ct" value="${to}"></div>` : ""}
    <div class="seg" id="kf" style="margin-top:8px">${[["all", "Все"], ["личное", "Личные"], ["рабочее", "Рабочие"]].map(([k, l]) => `<button data-k="${k}" class="${kindF === k ? "on" : ""}">${l}</button>`).join("")}</div>
    <div class="card" style="margin-top:10px"><div class="small muted">Потрачено</div><div style="font-size:34px;font-weight:800;letter-spacing:-.02em">${rub(all)}</div>
      <div class="small">${delta === null ? `<span class="muted">в прошлом периоде трат нет</span>` : `<span class="delta ${delta > 0 ? "up" : "down"}">${delta > 0 ? "▲" : "▼"} ${Math.abs(delta)}%</span> <span class="muted">к прошлому периоду (${rub(prevAll)})</span>`}</div>
      ${kindF === "all" ? `<div class="small muted" style="margin-top:6px">личные ${rub(pers)} · рабочие ${rub(work)} · в среднем ${rub(all / len)} в день</div>` : ""}</div>
    ${budget ? `<div class="card"><div class="row" style="justify-content:space-between;margin-bottom:8px"><span>Бюджет месяца (личные)</span><b>${rub(mSpent)} / ${rub(budget)}</b></div><div class="progress${mSpent > budget ? "" : " blue"}"><i style="width:${Math.min(100, (mSpent / budget) * 100)}%"></i></div>
      <div class="hint">${mSpent > budget ? `Превышение на ${rub(mSpent - budget)}` : `Осталось ${rub(budget - mSpent)}`}</div></div>` : ""}
    ${days.length > 1 && all ? `<div class="card"><div class="cols">${days.map((d) => `<div class="c"><i style="height:${(perDay[d] / dmax) * 100}%" title="${rub(perDay[d])}"></i>${days.length <= 10 ? `<span>${wd(d)}</span>` : ""}</div>`).join("")}</div></div>` : ""}
    ${catList.length ? `<h3>По категориям</h3><div class="card"><div class="bars">${catList.map(([c, v]) => {
      const p = prevCat[c] || 0, dd = p ? Math.round(((v - p) / p) * 100) : null;
      return `<div class="bar" data-c="${esc(c)}" style="cursor:pointer;${catF && catF !== c ? "opacity:.45" : ""}"><div class="bl"><span>${icon(c)} ${esc(c)}</span><span><b>${rub(v)}</b>${dd !== null ? ` <span class="small delta ${dd > 0 ? "up" : "down"}">${dd > 0 ? "+" : ""}${dd}%</span>` : ""}</span></div><div class="progress"><i style="width:${(v / max) * 100}%"></i></div></div>`;
    }).join("")}</div>${catF ? `<button class="btn ghost" id="nocat">Показать все категории</button>` : `<p class="hint">Нажмите на категорию, чтобы увидеть её траты</p>`}</div>` : ""}
    <button class="btn wide blue" id="ai">✨ Объяснить траты — Claude</button><div id="aiout" style="margin-top:10px"></div>
    <div class="row" style="justify-content:space-between;margin:22px 4px 8px"><h3 style="margin:0">Записи${catF ? " · " + esc(catF) : ""}</h3>${vis.length ? `<button class="btn sm" id="csv">⬇️ В таблицу</button>` : ""}</div>
    ${Object.entries(groups).map(([d, r]) => `<div class="small muted" style="margin:12px 4px 6px">${dLong(d)} · ${rub(sum(r))}</div><div class="card flat">${r.map((e) => `<div class="li" data-e="${e.id}"><span class="ic">${icon(e.category)}</span><div class="tx"><div>${esc(e.category)}${e.kind === "рабочее" ? ` <span class="tag work">рабочая</span>` : ""}</div>${e.note ? `<div class="s">${esc(e.note)}</div>` : ""}</div><span class="amount">${rub(e.amount)}</span></div>`).join("")}</div>`).join("") || `<div class="empty">Трат за период нет. Нажмите ＋, чтобы записать.</div>`}
    <button class="fab" id="add" aria-label="Добавить трату">＋</button>`;

  const re = () => render(main);
  $$("#per button", main).forEach((b) => (b.onclick = () => { per = b.dataset.p; if (per === "custom" && !custom) custom = [addDays(today(), -29), today()]; re(); }));
  $$("#kf button", main).forEach((b) => (b.onclick = () => { kindF = b.dataset.k; re(); }));
  if (per === "custom") { const ch = () => { custom = [$("#cf", main).value, $("#ct", main).value]; if (custom[0] && custom[1] && custom[0] <= custom[1]) re(); }; $("#cf", main).onchange = ch; $("#ct", main).onchange = ch; }
  $$("[data-c]", main).forEach((b) => b.classList.contains("bar") && (b.onclick = () => { catF = catF === b.dataset.c ? null : b.dataset.c; re(); }));
  $("#nocat", main) && ($("#nocat", main).onclick = () => { catF = null; re(); });
  $$("[data-e]", main).forEach((r) => (r.onclick = () => expenseSheet(rows.find((e) => e.id === r.dataset.e), re)));
  $("#add", main).onclick = () => expenseSheet(null, re);
  $("#csv", main) && ($("#csv", main).onclick = () => {
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = String.fromCharCode(0xfeff) + [["Дата", "Сумма", "Категория", "Чья", "Комментарий"], ...vis.map((e) => [e.day.split("-").reverse().join("."), String(+e.amount).replace(".", ","), e.category, e.kind, e.note])].map((r) => r.map(q).join(";")).join(String.fromCharCode(13, 10));
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = `траты-${from}-${to}.csv`; a.click();
  });
  $("#ai", main).onclick = (ev) => busy(ev.currentTarget, async () => {
    const j = await fn({ action: "ai", kind: "money", from, to });
    $("#aiout", main).innerHTML = `<div class="ai"><div class="who">Claude · ${dShort(from)}–${dShort(to)}</div>${aiHtml(j.answer)}</div>`;
  });
}
