// Кайрос — точка входа: вход, нижняя панель с голосом, переходы. Все экраны загружены заранее и рисуются из памяти.
import { session, allowed, logout, MOCK } from "./db.js";
import { $, $$, esc, toast, icon } from "./ui.js";
import { loginScreen } from "./login.js";
import * as store from "./store.js";
import * as today from "./today.js";
import * as tasks from "./tasks.js";
import * as goals from "./goals.js";
import * as money from "./money.js";
import * as inbox from "./inbox.js";
import * as calendar from "./calendar.js";
import * as habits from "./habits.js";
import * as ideas from "./ideas.js";
import * as review from "./review.js";
import * as evening from "./evening.js";
import * as more from "./more.js";
import * as settings from "./settings.js";
import * as ask from "./ask.js";
import * as search from "./search.js";
import * as siri from "./siri.js";
import * as journal from "./journal.js";
import { openVoice } from "./voice.js";

export const S = { uid: null, get set() { return store.settings(); } };
export const VERSION = "2.0";

const PAGES = { today, tasks, goals, goal: goals, money, inbox, calendar, habits, ideas, review, evening, more, settings, ask, search, siri, journal };
const TAB = { goal: "goals" };
const TABS = [["today", "Сегодня"], ["tasks", "Задачи"], ["mic", ""], ["goals", "Цели"], ["money", "Финансы"]];
const app = $("#app");

function shell() {
  app.innerHTML = `<main id="main"></main><span class="sync" id="sync"></span>
    <nav class="tabs">${TABS.map(([k, l]) => (k === "mic" ? `<button class="mic" id="mic" aria-label="Голосовой ввод">${icon("mic")}</button>` : `<a href="#/${k}" data-tab="${k}">${icon(k)}${l}</a>`)).join("")}</nav>`;
  $("#mic").onclick = () => openVoice(() => route(true));
}

let current = "";
function route(keepScroll) {
  if (!S.uid) return;
  if (location.hash.startsWith("#/add?")) { import("./quick.js").then(({ handleQuick }) => { const to = handleQuick(); location.hash = "#/" + (to || "today"); }); return; }
  const [name = "today", arg] = location.hash.replace(/^#\/?/, "").split("/");
  const page = PAGES[name] ? name : "today";
  $$(".tabs a").forEach((a) => a.classList.toggle("on", a.dataset.tab === (TAB[page] || page)));
  const main = $("#main"), key = page + "/" + (arg || "");
  const y = keepScroll === true && key === current ? window.scrollY : 0;
  current = key;
  try { PAGES[page].render(main, arg ? decodeURIComponent(arg) : undefined); }
  catch (e) { console.error(e); main.innerHTML = `<div class="card"><h2>Что-то пошло не так</h2><p class="muted">${esc(e.message)}</p><button class="btn wide" onclick="location.reload()">Обновить</button></div>`; }
  window.scrollTo(0, y);
}
export const refresh = () => route(true);

function syncBadge() { const n = store.pending(); const el = $("#sync"); if (el) el.textContent = n ? (navigator.onLine ? "↻ " + n : "нет сети · " + n) : ""; }

async function boot() {
  if ("serviceWorker" in navigator && !MOCK) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (!reloaded && !document.querySelector(".sheet-wrap")) { reloaded = true; location.reload(); } });
    navigator.serviceWorker.addEventListener("message", (e) => { if (e.data?.url) location.href = e.data.url; });
  }
  let s = null;
  try { s = await session(); } catch (e) { s = null; }
  if (!s) return loginScreen(app, boot);
  // проверка доступа — в фоне, если на устройстве уже есть данные
  const cached = (() => { try { return localStorage.getItem("pb_cache_" + s.user.id); } catch (e) { return null; } })();
  if (!cached && !(await allowed())) {
    app.innerHTML = `<div class="login"><div class="logo"><img src="icons/icon-192.png" alt="">КАЙРОС</div><div class="card"><h2>Нет доступа</h2><p class="muted">Кайрос — только для владельца. Вы вошли как ${esc(s.user?.email || "")}.</p><button class="btn wide" id="out">Выйти</button></div></div>`;
    $("#out").onclick = logout; return;
  }
  S.uid = s.user.id;
  if (!cached) app.innerHTML = `<div class="boot">Собираю ваши записи…</div>`;
  await store.init(S.uid);
  shell();
  if (!location.hash || location.hash === "#/") location.hash = "#/" + (new Date().getHours() >= 20 ? "evening" : "today");
  route();
  store.onChange((kind) => { syncBadge(); if (kind === "remote" && !document.querySelector(".sheet-wrap") && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) route(true); });
  syncBadge(); addEventListener("online", syncBadge); addEventListener("offline", syncBadge);
}

window.addEventListener("hashchange", () => route());
boot();
