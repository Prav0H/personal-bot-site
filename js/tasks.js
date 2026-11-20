// Задачи: строка задачи, карточка, перенос с причиной; экран «Все задачи».
import { list, ins, upd, del, today, addDays } from "./db.js";
import { $, $$, esc, toast, sheet, confirmBox, dRel, dShort, DICT } from "./ui.js";

const PRIO = ["", "❗", "🔥"];
export const REPEAT = [["", "Нет"], ["daily", "Каждый день"], ["weekdays", "По будням"], ["weekly", "Раз в неделю"], ["monthly", "Раз в месяц"]];
/** Следующая дата повторяющейся задачи. */
export function nextDay(day, repeat) {
  const d = new Date(day + "T12:00:00");
  if (repeat === "daily") d.setDate(d.getDate() + 1);
  else if (repeat === "weekly") d.setDate(d.getDate() + 7);
  else if (repeat === "monthly") d.setMonth(d.getMonth() + 1);
  else if (repeat === "weekdays") { do d.setDate(d.getDate() + 1); while (d.getDay() === 0 || d.getDay() === 6); }
  else return null;
  return d.toLocaleDateString("en-CA");
}

export function taskRow(t, td = today()) {
  const late = !t.done_at && t.day && t.day < td;
  const meta = [
    t.area === "работа" ? `<span class="tag work">работа</span>` : "",
    t.day && t.day !== td ? `<span class="${late ? "tag bad" : ""}">${late ? "просрочено · " : ""}${dRel(t.day, td)}</span>` : "",
    t.moves ? `<span>↪ перенос ×${t.moves}</span>` : "",
    t.repeat ? `<span>🔁 ${REPEAT.find((r) => r[0] === t.repeat)?.[1].toLowerCase() || ""}</span>` : "",
    t.note ? `<span>📝</span>` : "",
  ].filter(Boolean).join("");
  return `<div class="task${t.done_at ? " done" : ""}" data-id="${t.id}"><button class="ck${t.done_at ? " on" : ""}" aria-label="Готово"></button>
    <div class="t"><div class="tt">${t.priority ? `<span class="prio">${PRIO[t.priority]}</span> ` : ""}${esc(t.title)}</div>${meta ? `<div class="meta">${meta}</div>` : ""}</div></div>`;
}

/** Навесить обработчики на строки задач. */
export function bindTasks(root, tasks, onChange) {
  $$(".task", root).forEach((row) => {
    const t = tasks.find((x) => x.id === row.dataset.id);
    if (!t) return;
    $(".ck", row).onclick = async (e) => {
      e.stopPropagation();
      const done = !t.done_at;
      row.classList.toggle("done", done); $(".ck", row).classList.toggle("on", done);
      if (done && navigator.vibrate) navigator.vibrate(15);
      try {
        await upd("pb_tasks", [["eq", "id", t.id]], { done_at: done ? new Date().toISOString() : null });
        t.done_at = done ? 1 : null;
        if (done && t.repeat) {
          const nd = nextDay(t.day || today(), t.repeat);
          const exists = (await list("pb_tasks", [["eq", "title", t.title], ["eq", "day", nd], ["is", "done_at", null]])).length;
          if (nd && !exists) await ins("pb_tasks", { title: t.title, note: t.note, day: nd, area: t.area, priority: t.priority, repeat: t.repeat });
          toast(`Готово ✓ Следующий раз — ${dRel(nd, today())}`);
        } else if (done) toast("Готово ✓");
        onChange && onChange();
      }
      catch (err) { toast(err.message, true); }
    };
    $(".t", row).onclick = () => taskSheet(t, onChange);
  });
}

export function quickAdd(defaults, onAdded, ph = "Новая задача…") {
  const id = "qa" + Math.random().toString(36).slice(2, 7);
  setTimeout(() => {
    const f = document.getElementById(id); if (!f) return;
    f.onsubmit = async (e) => {
      e.preventDefault();
      const inp = $("input", f), title = inp.value.trim();
      if (!title) return;
      inp.value = "";
      try { await ins("pb_tasks", { title, ...defaults(), priority: /^!/.test(title) ? 1 : 0 }); onAdded && onAdded(); }
      catch (err) { inp.value = title; toast(err.message, true); }
    };
  });
  return `<form class="add" id="${id}"><input placeholder="${esc(ph)}" enterkeyhint="done" autocomplete="off"><button class="btn pri">＋</button></form>`;
}

export function taskSheet(t, onChange) {
  const td = today();
  const s = sheet(`<h2>Задача</h2>
    <textarea id="tt" rows="2" style="min-height:60px">${esc(t.title)}</textarea>
    <label class="f">Заметка</label><textarea id="tn" placeholder="Подробности, ссылки…">${esc(t.note)}</textarea>${DICT}
    <label class="f">Когда</label>
    <div class="row"><input type="date" id="td" value="${t.day || ""}" class="grow"><button class="btn sm" id="nod">Когда-нибудь</button></div>
    <label class="f">Сфера и важность</label>
    <div class="row"><div class="seg grow" id="ta"><button data-v="личное" class="${t.area !== "работа" ? "on" : ""}">Личное</button><button data-v="работа" class="${t.area === "работа" ? "on" : ""}">Работа</button></div></div>
    <label class="f">🔁 Повторять</label><select id="tr">${REPEAT.map(([v, l]) => `<option value="${v}" ${(t.repeat || "") === v ? "selected" : ""}>${l}</option>`).join("")}</select>
    <div class="seg" id="tp" style="margin-top:8px">${["Обычная", "❗ Важная", "🔥 Главная"].map((l, i) => `<button data-v="${i}" class="${t.priority === i ? "on" : ""}">${l}</button>`).join("")}</div>
    <button class="btn pri wide" id="ts" style="margin-top:16px">Сохранить</button>
    <div class="row2"><button class="btn" id="tm">↪ Перенести</button><button class="btn" id="tx" style="color:var(--bad)">Удалить</button></div>
    ${t.moves ? `<p class="hint">Переносилась ${t.moves} раз. <a href="#" id="hist">История переносов</a></p>` : ""}`);
  const el = s.el;
  let area = t.area, prio = t.priority;
  $$("#ta button", el).forEach((b) => (b.onclick = () => { area = b.dataset.v; $$("#ta button", el).forEach((x) => x.classList.toggle("on", x === b)); }));
  $$("#tp button", el).forEach((b) => (b.onclick = () => { prio = +b.dataset.v; $$("#tp button", el).forEach((x) => x.classList.toggle("on", x === b)); }));
  $("#nod", el).onclick = () => ($("#td", el).value = "");
  $("#ts", el).onclick = async () => {
    const title = $("#tt", el).value.trim(); if (!title) return toast("Пустое название", true);
    try { await upd("pb_tasks", [["eq", "id", t.id]], { title, note: $("#tn", el).value.trim(), day: $("#td", el).value || ($("#tr", el).value ? td : null), area, priority: prio, repeat: $("#tr", el).value }); s.close(); onChange && onChange(); }
    catch (e) { toast(e.message, true); }
  };
  $("#tm", el).onclick = () => { s.close(); setTimeout(() => moveSheet(t, onChange), 230); };
  $("#tx", el).onclick = async () => { if (!(await confirmBox("Удалить задачу?", "Удалить"))) return; await del("pb_tasks", [["eq", "id", t.id]]); s.close(); onChange && onChange(); };
  const h = $("#hist", el);
  if (h) h.onclick = async (e) => {
    e.preventDefault();
    const mv = await list("pb_moves", [["eq", "task_id", t.id]], "created_at");
    h.parentElement.innerHTML = mv.map((m) => `${dShort(m.created_at.slice(0, 10))}: ${m.from_day ? dShort(m.from_day) : "—"} → ${m.to_day ? dShort(m.to_day) : "когда-нибудь"}${m.reason ? ` — ${esc(m.reason)}` : ""}`).join("<br>") || "Нет записей";
  };
}

/** Перенос с причиной. */
export function moveSheet(t, onChange, title = "Перенести задачу") {
  const td = today();
  const opts = [["Завтра", addDays(td, 1)], ["Послезавтра", addDays(td, 2)], ["Через неделю", addDays(td, 7)], ["Когда-нибудь", ""]];
  let to = opts[0][1];
  const s = sheet(`<h2>${esc(title)}</h2><p class="muted">«${esc(t.title)}»</p>
    <div class="chips" id="mo">${opts.map(([l, v], i) => `<button class="chip${i === 0 ? " on" : ""}" data-v="${v}">${l}</button>`).join("")}</div>
    <input type="date" id="md" value="${to}" style="margin-top:8px">
    <label class="f">Почему переносите?</label>
    <div class="chips" id="mr">${["Не хватило времени", "Срочное вытеснило", "Нет сил", "Жду других", "Передумал", "Не нужна сейчас"].map((r) => `<button class="chip" data-r="${r}">${r}</button>`).join("")}</div>
    <textarea id="mt" placeholder="Своими словами — это поможет в разборе недели" style="margin-top:8px"></textarea>${DICT}
    <button class="btn pri wide" id="mg" style="margin-top:14px">Перенести</button>`);
  const el = s.el;
  $$("#mo .chip", el).forEach((b) => (b.onclick = () => { $$("#mo .chip", el).forEach((x) => x.classList.toggle("on", x === b)); to = b.dataset.v; $("#md", el).value = to; }));
  $("#md", el).onchange = (e) => { to = e.target.value; $$("#mo .chip", el).forEach((x) => x.classList.toggle("on", x.dataset.v === to)); };
  $$("#mr .chip", el).forEach((b) => (b.onclick = () => { b.classList.toggle("on"); }));
  $("#mg", el).onclick = async () => {
    const chips = $$("#mr .chip.on", el).map((b) => b.dataset.r);
    const reason = [...chips, $("#mt", el).value.trim()].filter(Boolean).join(". ");
    try {
      await ins("pb_moves", { task_id: t.id, task_title: t.title, from_day: t.day, to_day: to || null, reason });
      await upd("pb_tasks", [["eq", "id", t.id]], { day: to || null, moves: (t.moves || 0) + 1 });
      s.close(); toast(to ? `Перенесено на ${dRel(to, td)}` : "Убрано в «когда-нибудь»"); onChange && onChange();
    } catch (e) { toast(e.message, true); }
  };
}

/* ====== экран «Все задачи» ====== */
let mode = "open";
export async function render(main) {
  const td = today();
  const all = await list("pb_tasks", [], ["day", "created_at"]);
  const open = all.filter((t) => !t.done_at && t.day);
  const some = all.filter((t) => !t.done_at && !t.day);
  const done = all.filter((t) => t.done_at).sort((a, b) => String(b.done_at).localeCompare(String(a.done_at))).slice(0, 100);
  const groups = (rows) => {
    const by = {};
    rows.forEach((t) => { const k = t.day < td ? "Просрочено" : dRel(t.day, td); (by[k] = by[k] || []).push(t); });
    return Object.entries(by).map(([k, r]) => `<h3>${esc(k)}</h3><div class="card flat">${r.map((t) => taskRow(t, td)).join("")}</div>`).join("");
  };
  main.innerHTML = `<div class="top"><div><a href="#/more" class="small">← Ещё</a><h1>Все задачи</h1></div></div>
    <div class="seg" id="mode"><button data-m="open">Открытые ${open.length}</button><button data-m="some">Когда-нибудь ${some.length}</button><button data-m="done">Сделано</button></div>
    <div style="height:10px"></div>
    ${quickAdd(() => ({ day: mode === "some" ? null : td }), () => render(main), mode === "some" ? "Задача без срока…" : "Задача на сегодня…")}
    <div id="tl">${mode === "open" ? groups(open) || `<div class="empty">Открытых задач нет 🎉</div>`
      : mode === "some" ? (some.length ? `<div class="card flat">${some.map((t) => taskRow(t, td)).join("")}</div>` : `<div class="empty">Здесь задачи без срока: идеи на потом</div>`)
      : (done.length ? `<div class="card flat">${done.map((t) => taskRow(t, td)).join("")}</div>` : `<div class="empty">Пока ничего не сделано</div>`)}</div>`;
  $$("#mode button", main).forEach((b) => { b.classList.toggle("on", b.dataset.m === mode); b.onclick = () => { mode = b.dataset.m; render(main); }; });
  bindTasks($("#tl", main), all, () => render(main));
}
