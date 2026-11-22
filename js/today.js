// «Сегодня»: план дня по времени из задач, событий и привычек; «самое время» для главного дела.
import { rows, day, setDay, toggleHabit, habitDone, patch, settings } from "./store.js";
import { today, addDays } from "./db.js";
import { $, $$, esc, toast, dLong, plural, rub } from "./ui.js";
import { toggleDone, taskSheet, moveSheet, deadline } from "./tasks.js";
import { QUAD, quad, byDeadline, scheduled, scheduleText, goalName, sum } from "./model.js";
import { eventSheet } from "./calendar.js";
import { S } from "./main.js";

const hello = () => { const h = new Date().getHours(); return h < 5 ? "Доброй ночи" : h < 12 ? "Доброе утро" : h < 18 ? "Добрый день" : "Добрый вечер"; };
const hm = (t) => { const [h, m] = (t || "0:0").split(":"); return +h * 60 + +m; };
const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const TROPOS = "https://prav0h.github.io/tropos-site/#/tasks";

export function render(main) {
  const td = today(), now = new Date(), nowM = now.getHours() * 60 + now.getMinutes();
  const tasks = rows("pb_tasks").filter((t) => (t.day === td) || (!t.done_at && t.day && t.day < td) || (t.done_at && new Date(t.done_at).toLocaleDateString("en-CA") === td && t.day && t.day <= td));
  const events = rows("pb_events").filter((e) => e.day === td);
  const habits = rows("pb_habits").filter((h) => h.active !== false && scheduled(h, td));
  const items = [
    ...tasks.filter((t) => t.time && t.day === td).map((t) => ({ k: "task", at: t.time, t })),
    ...events.map((e) => ({ k: "event", at: e.time || "", e })),
    ...habits.filter((h) => h.time).map((h) => ({ k: "habit", at: h.time, h })),
  ];
  const untimed = tasks.filter((t) => !t.time || t.day !== td).sort((a, b) => quad(a, td) - quad(b, td) || byDeadline(a, b));
  // «Самое время»: главное открытое дело без времени — в ближайшее свободное окно
  const best = untimed.find((t) => !t.done_at && quad(t, td) <= 2);
  let slot = null;
  if (best) {
    const busy = items.filter((i) => i.at).map((i) => hm(i.at));
    for (let m = Math.max(8 * 60, Math.ceil((nowM + 10) / 60) * 60); m <= 21 * 60; m += 60) if (!busy.some((b) => Math.abs(b - m) < 60)) { slot = m; break; }
    if (slot != null) items.push({ k: "best", at: fmt(slot), t: best });
  }
  items.sort((a, b) => (a.at || "99").localeCompare(b.at || "99"));
  const openN = tasks.filter((t) => !t.done_at).length, habN = habits.length;
  const name = (() => { try { return (localStorage.getItem("pb_name") || "").split(" ")[0]; } catch (e) { return ""; } })();
  const d = day(td);
  const inboxN = rows("pb_inbox").length;
  const spent = sum(rows("pb_expenses").filter((e) => e.day === td && !e.planned));
  const say = `${openN ? `${openN} ${plural(openN, "дело", "дела", "дел")}` : "Дел нет"}${habN ? ` и ${habN} ${plural(habN, "привычка", "привычки", "привычек")}` : ""}.` +
    (best && slot != null ? ` Окно для «${esc(best.title)}» — с ${fmt(slot)} до ${fmt(slot + 60)}, я его придержал.` : best ? ` Главное сейчас — «${esc(best.title)}».` : "");

  const row = (i) => {
    if (i.k === "habit") { const on = habitDone(i.h.id, td); return `<div class="tli${on ? " done" : ""}"><div class="tm">${i.at}</div><button class="dot${on ? " on" : ""}" data-h="${i.h.id}"></button><div class="body" data-h2="${i.h.id}"><div class="tt">${esc(i.h.title)}</div><div class="s">привычка${i.h.minutes ? " · " + i.h.minutes + " минут" : ""}</div></div></div>`; }
    if (i.k === "event") return `<div class="tli"><div class="tm">${i.at || "весь день"}</div><button class="dot ev" data-e="${i.e.id}"></button><div class="body" data-e="${i.e.id}"><div class="tt">${esc(i.e.title)}</div><div class="s">событие${i.e.remind_at ? " · напомню" : ""}${i.e.note ? " · " + esc(i.e.note.slice(0, 40)) : ""}</div></div></div>`;
    const t = i.t, q = quad(t, td), on = !!t.done_at;
    const tags = `${i.k === "best" ? '<span class="tag time">◆ самое время</span>' : ""}${q <= 3 && q !== 2 || q === 2 ? `<span class="tag ${q === 1 ? "gold" : q === 3 ? "terra" : ""}">${QUAD[q].t.toLowerCase()}</span>` : ""}`;
    const sub = [i.k === "best" ? `${i.at}–${fmt(hm(i.at) + 60)}` : "", t.day && t.day !== td ? deadline(t, td) : "", t.goal_id ? "цель: " + esc(goalName(t.goal_id).toLowerCase()) : "", t.note && /^https?:/.test(t.note) ? `<a href="${esc(t.note.split(/\s/)[0])}" target="_blank" rel="noopener">ссылка ↗</a>` : ""].filter(Boolean).join(" · ");
    return `<div class="tli${on ? " done" : ""}"><div class="tm">${i.at}</div><button class="dot${on ? " on" : ""}" data-t="${t.id}"></button><div class="body${i.k === "best" ? " box" : ""}" data-t2="${t.id}">${tags ? `<div class="s" style="margin:0 0 4px">${tags}</div>` : ""}<div class="tt">${esc(t.title)}</div>${sub ? `<div class="s">${sub}</div>` : ""}</div></div>`;
  };
  const restRows = untimed.filter((t) => !(best && slot != null && t.id === best.id));

  main.innerHTML = `<div class="brand"><img src="icons/icon-192.png" alt="">КАЙРОС</div>
    <div class="chips scroll" style="margin-bottom:12px"><a class="chip" href="#/inbox">Входящие${inboxN ? ` <span class="n">${inboxN}</span>` : ""}</a><a class="chip" href="#/calendar">Календарь</a><a class="chip" href="#/habits">Привычки</a><a class="chip" href="#/ideas">Идеи</a><a class="chip" href="#/review">Обзор</a><a class="chip" href="#/evening">Итоги дня</a><a class="chip" href="#/more">Ещё</a></div>
    <div class="cap" style="margin:0">${dLong(td).replace(/^(\d+) (\S+), (\S+)$/, "$3 · $1 $2")}</div>
    <h1>${hello()}${name ? ", " + esc(name) : ""}.</h1><p class="voice">${say}</p>
    ${d.intention ? `<div class="card" style="padding:9px 12px"><span class="small muted">🎯 Главное:</span> ${esc(d.intention)}</div>` : ""}
    <div class="row" style="justify-content:space-between;margin-top:14px"><div class="cap" style="margin:0">План на день</div><a class="small" href="#/calendar">в календаре →</a></div>
    ${items.length ? `<div class="tl">${items.map(row).join("")}</div>` : `<div class="empty">Ничего не запланировано по времени</div>`}
    ${restRows.length ? `<div class="cap">Без времени · ${restRows.filter((t) => !t.done_at).length}</div><div class="tl">${restRows.map((t) => row({ k: "task", at: "", t })).join("")}</div>` : ""}
    <div class="row" style="margin-top:10px"><button class="btn sm" id="nt">＋ Задача</button><button class="btn sm" id="ne">＋ Событие</button><button class="btn sm" id="ni">🎯 Главное</button></div>
    <div id="work"></div>
    <div class="card row" style="justify-content:space-between;margin-top:14px"><div><div class="small muted">Потрачено сегодня</div><b>${spent ? rub(spent) : "—"}</b></div><a class="btn sm" href="#/money">Финансы →</a></div>`;

  const re = () => render(main);
  $$("[data-t]", main).forEach((b) => (b.onclick = () => { const t = rows("pb_tasks").find((x) => x.id === b.dataset.t); if (t) { toggleDone(t); re(); } }));
  $$("[data-t2]", main).forEach((b) => (b.onclick = (e) => { if (e.target.closest("a")) return; const t = rows("pb_tasks").find((x) => x.id === b.dataset.t2); if (!t) return; if (t.day && t.day < td && !t.done_at) moveSheet(t, re, "Просрочено — что делаем?"); else taskSheet(t, re); }));
  $$("[data-h]", main).forEach((b) => (b.onclick = () => { toggleHabit(b.dataset.h, td); re(); }));
  $$("[data-h2]", main).forEach((b) => (b.onclick = () => (location.hash = "#/habits")));
  $$("[data-e]", main).forEach((b) => (b.onclick = () => eventSheet(rows("pb_events").find((x) => x.id === b.dataset.e), re)));
  $("#nt", main).onclick = () => taskSheet({ day: td }, re);
  $("#ne", main).onclick = () => eventSheet({ day: td }, re);
  $("#ni", main).onclick = () => { const v = prompt("Одна вещь, которая сделает день удачным:", d.intention || ""); if (v != null) { setDay(td, { intention: v.trim() }); re(); } };
  // Рабочие задачи из Tropos (только чтение)
  workTasks(td).then((w) => {
    const box = $("#work", main); if (!box || !w.length) return;
    box.innerHTML = `<div class="cap">Работа в Tropos · ${w.length}</div><div class="card flat">${w.slice(0, 10).map((t) => { const dd = new Date(t.due_at).toLocaleDateString("en-CA"); return `<a class="li" href="${TROPOS}" target="_blank" rel="noopener" style="color:inherit"><span class="bar-l${dd < td ? " t" : ""}"></span><div class="tx"><div>${esc(t.title)}</div><div class="s">${dd < td ? "просрочено" : "сегодня"}</div></div><span class="ar">↗</span></a>`; }).join("")}</div>`;
  });
}

let workCache = null, workAt = 0;
async function workTasks(td) {
  if (workCache && Date.now() - workAt < 120e3) return workCache;
  try {
    const { sb, MOCK } = await import("./db.js");
    if (MOCK) return [];
    const { data: me } = await sb.from("profiles").select("person_id").eq("id", S.uid).maybeSingle();
    if (!me?.person_id) return [];
    const { data } = await sb.from("tasks").select("id,title,due_at,status").eq("assignee", me.person_id).neq("status", "done").lte("due_at", new Date(td + "T23:59:59").toISOString()).order("due_at");
    workCache = data || []; workAt = Date.now(); return workCache;
  } catch (e) { return []; }
}
