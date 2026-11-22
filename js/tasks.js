// Задачи: матрица Эйзенхауэра (по сроку внутри квадранта), карточка задачи, перенос с причиной, отметка «готово».
import { rows, add, patch, remove } from "./store.js";
import { today, addDays } from "./db.js";
import { $, $$, esc, toast, sheet, confirmBox, dRel, dShort, DICT } from "./ui.js";
import { QUAD, quad, quadFlags, byDeadline, isUrgent, REPEAT, nextDay, REMIND, remindAt, remindLabel, goalName } from "./model.js";

export function deadline(t, td = today()) {
  if (!t.day) return "когда-нибудь";
  const late = t.day < td && !t.done_at;
  return (late ? "просрочено · " : t.day > addDays(td, 2) ? "до " : "") + dRel(t.day, td) + (t.time ? " · " + t.time : "");
}

/** Отметить выполненной (с повтором — создаёт следующую). */
export function toggleDone(t) {
  const done = !t.done_at;
  patch("pb_tasks", t.id, { done_at: done ? new Date().toISOString() : null });
  if (done && navigator.vibrate) navigator.vibrate(12);
  if (done && t.repeat) {
    const nd = nextDay(t.day || today(), t.repeat);
    if (nd && !rows("pb_tasks").some((x) => x.title === t.title && x.day === nd && !x.done_at)) {
      add("pb_tasks", { title: t.title, note: t.note || "", day: nd, time: t.time || "", area: t.area || "личное", important: !!t.important, urgent: false, repeat: t.repeat, goal_id: t.goal_id || null, remind_at: t.remind_at ? remindAt(nd, t.time, guessRemind(t)) : null });
      toast(`Готово ✓ Следующий раз — ${dRel(nd, today())}`); return;
    }
  }
  if (done) toast("Готово ✓");
}
function guessRemind(t) {
  if (!t.remind_at || !t.day) return "";
  const r = new Date(t.remind_at), base = new Date(t.day + "T" + (t.time || "09:00") + ":00");
  const m = Math.round((base - r) / 6e4);
  return ["0", "15", "60"].includes(String(m)) ? String(m) : r.getHours() === 18 ? "1440" : r.getHours() === 10 ? "m10" : "0";
}

export function taskRow(t, td = today()) {
  const q = quad(t, td), late = t.day && t.day < td && !t.done_at;
  const meta = [
    `<span class="tag ${q === 1 ? "gold" : q === 3 ? "terra" : ""}">${QUAD[q].t.toLowerCase()}</span>`,
    t.day !== td || t.time ? `<span${late ? ' style="color:var(--bad)"' : ""}>${esc(deadline(t, td))}</span>` : "",
    t.goal_id ? `<span>цель: ${esc(goalName(t.goal_id).toLowerCase())}</span>` : "",
    t.repeat ? "<span>🔁</span>" : "", t.remind_at && !t.reminded ? "<span>🔔</span>" : "", t.moves ? `<span>↪×${t.moves}</span>` : "",
  ].filter(Boolean).join("");
  return `<div class="task${t.done_at ? " done" : ""}" data-id="${t.id}"><button class="ck${t.done_at ? " on" : ""}" aria-label="Готово"></button>
    <div class="t"><div class="tt">${esc(t.title)}</div><div class="meta">${meta}</div></div></div>`;
}
export function bindTasks(root, onChange) {
  $$(".task", root).forEach((row) => {
    const t = () => rows("pb_tasks").find((x) => x.id === row.dataset.id);
    $(".ck", row).onclick = (e) => { e.stopPropagation(); const x = t(); if (x) { toggleDone(x); onChange && onChange(); } };
    $(".t", row).onclick = () => { const x = t(); if (x) taskSheet(x, onChange); };
  });
}

/** Карточка задачи (новая — если t без id). */
export function taskSheet(t0, onChange) {
  const isNew = !t0.id, t = { title: "", note: "", day: today(), time: "", area: "личное", important: false, urgent: false, repeat: "", goal_id: null, ...t0 };
  let q = isNew && t0.important === undefined ? 2 : quad(t);
  const goals = rows("pb_goals").filter((g) => g.status !== "done");
  const s = sheet(`<h2>${isNew ? "Новая задача" : "Задача"}</h2>
    <textarea id="tt" rows="2" style="min-height:54px" placeholder="Что сделать?">${esc(t.title)}</textarea>
    <label class="f">Квадрант</label><div class="chips" id="tq">${[1, 2, 3, 4].map((k) => `<button class="chip${q === k ? " on" : ""}" data-q="${k}">${QUAD[k].t}</button>`).join("")}</div>
    <div class="row2"><div><label class="f">Срок</label><input type="date" id="td" value="${t.day || ""}"></div><div><label class="f">Время</label><input type="time" id="tm" value="${t.time || ""}"></div></div>
    <div class="row" style="margin-top:6px"><button class="btn sm" id="nod">Без срока</button><button class="btn sm" data-d="0">Сегодня</button><button class="btn sm" data-d="1">Завтра</button></div>
    <div class="row2"><div><label class="f">🔔 Напомнить</label><select id="tr">${REMIND.map(([v, l]) => `<option value="${v}" ${v === guessRemind(t) ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      <div><label class="f">🔁 Повтор</label><select id="trp">${REPEAT.map(([v, l]) => `<option value="${v}" ${(t.repeat || "") === v ? "selected" : ""}>${l}</option>`).join("")}</select></div></div>
    <div class="row2"><div><label class="f">Цель</label><select id="tg"><option value="">— без цели —</option>${goals.map((g) => `<option value="${g.id}" ${t.goal_id === g.id ? "selected" : ""}>${esc(g.title)}</option>`).join("")}</select></div>
      <div><label class="f">Сфера</label><select id="ta"><option ${t.area !== "работа" ? "selected" : ""}>личное</option><option value="работа" ${t.area === "работа" ? "selected" : ""}>Тропос / работа</option></select></div></div>
    <label class="f">Заметка или ссылка</label><textarea id="tn" placeholder="Подробности, ссылка на сайт…">${esc(t.note)}</textarea>${DICT}
    <button class="btn pri wide" id="ts" style="margin-top:12px">${isNew ? "Добавить" : "Сохранить"}</button>
    ${isNew ? "" : `<div class="row2"><button class="btn" id="tmv">↪ Перенести</button><button class="btn danger" id="tx">Удалить</button></div>
      ${t.moves ? `<p class="hint">Переносилась ${t.moves} раз. <a href="#" id="hist">История</a></p>` : ""}`}`);
  const el = s.el;
  if (isNew) setTimeout(() => $("#tt", el).focus(), 50);
  let qTouched = false;
  $$("#tq .chip", el).forEach((b) => (b.onclick = () => { q = +b.dataset.q; qTouched = true; $$("#tq .chip", el).forEach((x) => x.classList.toggle("on", x === b)); }));
  $("#nod", el).onclick = () => { $("#td", el).value = ""; $("#tm", el).value = ""; };
  $$("[data-d]", el).forEach((b) => (b.onclick = () => ($("#td", el).value = addDays(today(), +b.dataset.d))));
  $("#ts", el).onclick = () => {
    const title = $("#tt", el).value.trim(); if (!title) return toast("Напишите, что сделать", true);
    const day = $("#td", el).value || null, time = day ? $("#tm", el).value : "";
    const ro = $("#tr", el).value, ra = remindAt(day, time, ro);
    const row = { title, note: $("#tn", el).value.trim(), day, time, ...(qTouched ? quadFlags(q) : { important: q <= 2, urgent: q === 1 || q === 3 ? !!t.urgent || q === 1 && !t.day : false }), repeat: $("#trp", el).value, goal_id: $("#tg", el).value || null, area: $("#ta", el).value };
    if (ra !== (t.remind_at || null)) { row.remind_at = ra; row.reminded = false; }
    if (isNew) add("pb_tasks", { ...t0, ...row, in_plan: false, moves: 0 }); else patch("pb_tasks", t.id, row);
    s.close(); toast(isNew ? "Задача добавлена" : "Сохранено"); onChange && onChange();
  };
  if (!isNew) {
    $("#tmv", el).onclick = () => { s.close(); setTimeout(() => moveSheet(t, onChange), 220); };
    $("#tx", el).onclick = async () => { if (!(await confirmBox("Удалить задачу?", "Удалить"))) return; remove("pb_tasks", t.id); s.close(); onChange && onChange(); };
    const h = $("#hist", el);
    if (h) h.onclick = (e) => { e.preventDefault(); const mv = rows("pb_moves").filter((m) => m.task_id === t.id).sort((a, b) => String(a.created_at).localeCompare(b.created_at)); h.parentElement.innerHTML = mv.map((m) => `${dShort(String(m.created_at).slice(0, 10))}: → ${m.to_day ? dShort(m.to_day) : "когда-нибудь"}${m.reason ? ` — ${esc(m.reason)}` : ""}`).join("<br>") || "Нет записей"; };
  }
}

/** Перенос с причиной. */
export function moveSheet(t, onChange, title = "Перенести задачу") {
  const td = today();
  const opts = [["Завтра", addDays(td, 1)], ["Послезавтра", addDays(td, 2)], ["Через неделю", addDays(td, 7)], ["Когда-нибудь", ""]];
  let to = opts[0][1];
  const s = sheet(`<h2>${esc(title)}</h2><p class="quote">«${esc(t.title)}»</p>
    <div class="chips" id="mo">${opts.map(([l, v], i) => `<button class="chip${i === 0 ? " on" : ""}" data-v="${v}">${l}</button>`).join("")}</div>
    <input type="date" id="md" value="${to}" style="margin-top:8px">
    <label class="f">Почему переносите?</label>
    <div class="chips" id="mr">${["Не хватило времени", "Срочное вытеснило", "Нет сил", "Жду других", "Передумал"].map((r) => `<button class="chip" data-r="${r}">${r}</button>`).join("")}</div>
    <textarea id="mt" placeholder="Своими словами — пригодится в обзоре" style="margin-top:8px"></textarea>${DICT}
    <button class="btn pri wide" id="mg" style="margin-top:12px">Перенести</button>`);
  const el = s.el;
  $$("#mo .chip", el).forEach((b) => (b.onclick = () => { $$("#mo .chip", el).forEach((x) => x.classList.toggle("on", x === b)); to = b.dataset.v; $("#md", el).value = to; }));
  $("#md", el).onchange = (e) => { to = e.target.value; $$("#mo .chip", el).forEach((x) => x.classList.toggle("on", x.dataset.v === to)); };
  $$("#mr .chip", el).forEach((b) => (b.onclick = () => b.classList.toggle("on")));
  $("#mg", el).onclick = () => {
    const reason = [...$$("#mr .chip.on", el).map((b) => b.dataset.r), $("#mt", el).value.trim()].filter(Boolean).join(". ");
    add("pb_moves", { task_id: t.id, task_title: t.title, from_day: t.day, to_day: to || null, reason });
    patch("pb_tasks", t.id, { day: to || null, moves: (t.moves || 0) + 1, in_plan: false, remind_at: t.remind_at ? remindAt(to, t.time, guessRemind(t)) : null, reminded: false });
    s.close(); toast(to ? `Перенесено на ${dRel(to, td)}` : "Убрано в «когда-нибудь»"); onChange && onChange();
  };
}

/* ====== экран «Задачи»: матрица ====== */
let show = "matrix";
export function render(main) {
  const td = today();
  const open = rows("pb_tasks").filter((t) => !t.done_at);
  const Q = [[], [], [], [], []];
  open.forEach((t) => Q[quad(t, td)].push(t));
  Q.forEach((l) => l.sort(byDeadline));
  const n1 = Q[1].length, first = Q[1][0];
  const voice = n1 ? `${n1 === 1 ? "Срочное и важное одно" : `Срочного и важного ${n1}`}. Начни с «${esc(first.title)}»${first.day ? ` — срок ${dRel(first.day, td)}` : ""}.`
    : Q[2].length ? `Срочного нет — самое время для важного: «${esc(Q[2][0].title)}».` : open.length ? "Важного нет. Может, что-то из этого можно отпустить?" : "Задач нет. Скажи Кайросу, что нужно сделать.";
  const doneRecent = rows("pb_tasks").filter((t) => t.done_at).sort((a, b) => String(b.done_at).localeCompare(String(a.done_at))).slice(0, 30);
  main.innerHTML = `<div class="cap" style="margin-top:6px">Задачи · ${show === "matrix" ? "матрица" : show === "list" ? "список" : "сделано"}</div><h1>Что важно, что срочно</h1><p class="voice">${voice}</p>
    <div class="seg" id="sh" style="margin-bottom:10px">${[["matrix", "Матрица"], ["list", "По сроку"], ["done", "Сделано"]].map(([k, l]) => `<button data-s="${k}" class="${show === k ? "on" : ""}">${l}</button>`).join("")}</div>
    ${show === "matrix" ? `<div class="mx">${[1, 2, 3, 4].map((k) => `<div class="q ${QUAD[k].cls}" data-q="${k}"><div class="qh"><span>${QUAD[k].t}</span><b>${Q[k].length}</b></div>
      ${Q[k].map((t) => `<div class="qi" data-id="${t.id}"><button class="ck" aria-label="Готово"></button><div><div class="tt">${esc(t.title)}</div><div class="s${t.day && t.day < td ? " late" : ""}">${esc(deadline(t, td))}${t.goal_id ? " · цель: " + esc(goalName(t.goal_id).toLowerCase()) : ""}</div></div></div>`).join("") || `<div class="s dim" style="font-size:11px;padding:6px 0">${QUAD[k].s}</div>`}</div>`).join("")}</div>
      <p class="hint center">Внутри квадранта — по сроку: что наступит раньше, то выше. Удерживайте задачу и перетащите, если не согласны с квадрантом.</p>`
    : show === "list" ? `<div class="card flat">${[...open].sort(byDeadline).map((t) => taskRow(t, td)).join("") || `<div class="empty">Открытых задач нет</div>`}</div>`
    : `<div class="card flat">${doneRecent.map((t) => taskRow(t, td)).join("") || `<div class="empty">Пока ничего</div>`}</div>`}
    <button class="fab" id="add" aria-label="Новая задача">＋</button>`;
  const re = () => render(main);
  $$("#sh button", main).forEach((b) => (b.onclick = () => { show = b.dataset.s; re(); }));
  $("#add", main).onclick = () => taskSheet({}, re);
  bindTasks(main, re);
  $$(".qi", main).forEach((el) => {
    const t = () => rows("pb_tasks").find((x) => x.id === el.dataset.id);
    $(".ck", el).onclick = (e) => { e.stopPropagation(); el.style.opacity = ".4"; toggleDone(t()); setTimeout(re, 250); };
    el.onclick = () => taskSheet(t(), re);
    dragTask(el, main, (q) => { patch("pb_tasks", el.dataset.id, quadFlags(q)); toast(`→ ${QUAD[q].t}`); re(); });
  });
}

/** Перетаскивание между квадрантами: мышью и пальцем (удержать ~0,3 с). */
function dragTask(el, main, onDrop) {
  let timer, ghost, sx, sy, active = false, over = null;
  const qAt = (x, y) => document.elementFromPoint(x, y)?.closest(".q");
  const start = (x, y) => {
    active = true; el.style.opacity = ".35"; navigator.vibrate && navigator.vibrate(10);
    ghost = el.cloneNode(true); Object.assign(ghost.style, { position: "fixed", zIndex: 70, pointerEvents: "none", width: el.offsetWidth + "px", background: "var(--card2)", borderRadius: "10px", padding: "6px", boxShadow: "0 8px 24px rgba(0,0,0,.5)", left: x - 30 + "px", top: y - 20 + "px" });
    document.body.append(ghost);
  };
  const moveTo = (x, y) => { if (!active) return; ghost.style.left = x - 30 + "px"; ghost.style.top = y - 20 + "px"; const q = qAt(x, y); if (q !== over) { over?.classList.remove("drop"); over = q; over?.classList.add("drop"); } };
  const end = () => {
    clearTimeout(timer);
    if (!active) return;
    active = false; ghost?.remove(); el.style.opacity = ""; over?.classList.remove("drop");
    const q = over ? +over.dataset.q : 0; over = null;
    if (q && q !== +el.closest(".q").dataset.q) onDrop(q);
  };
  el.addEventListener("touchstart", (e) => { const p = e.touches[0]; sx = p.clientX; sy = p.clientY; timer = setTimeout(() => start(sx, sy), 320); }, { passive: true });
  el.addEventListener("touchmove", (e) => { const p = e.touches[0]; if (!active) { if (Math.hypot(p.clientX - sx, p.clientY - sy) > 8) clearTimeout(timer); return; } e.preventDefault(); moveTo(p.clientX, p.clientY); }, { passive: false });
  el.addEventListener("touchend", (e) => { if (active) e.preventDefault(); end(); });
  el.addEventListener("contextmenu", (e) => active && e.preventDefault());
  el.draggable = true;
  el.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", el.dataset.id); });
  if (!main.dataset.dnd) {
    main.dataset.dnd = 1;
    main.addEventListener("dragover", (e) => { if (e.target.closest(".q")) e.preventDefault(); });
    main.addEventListener("drop", (e) => { const q = e.target.closest(".q"); const id = e.dataTransfer.getData("text/plain"); if (q && id) { e.preventDefault(); patch("pb_tasks", id, quadFlags(+q.dataset.q)); render(main); } });
  }
}
