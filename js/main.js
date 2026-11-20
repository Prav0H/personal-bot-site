// Точка входа: вход, нижнее меню, переходы между экранами.
import { session, allowed, list, ups, logout, MOCK } from "./db.js";
import { $, $$, esc, toast } from "./ui.js";
import { loginScreen } from "./login.js";

export const S = { uid: null, set: null };
export const VERSION = "1.0";

const TABS = [["today", "☀️", "Сегодня"], ["evening", "🌙", "Вечер"], ["money", "💸", "Деньги"], ["ideas", "💡", "Идеи"], ["more", "☰", "Ещё"]];
const PAGES = {
  today: () => import("./today.js"), evening: () => import("./evening.js"), money: () => import("./money.js"),
  ideas: () => import("./ideas.js"), more: () => import("./more.js"), week: () => import("./week.js"),
  tasks: () => import("./tasks.js"), habits: () => import("./habits.js"), ask: () => import("./ask.js"),
  settings: () => import("./settings.js"), journal: () => import("./journal.js"),
};
const PARENT = { week: "more", tasks: "more", habits: "more", ask: "more", settings: "more", journal: "more" };

const app = $("#app");

export async function loadSettings() {
  const rows = await list("pb_settings", [["eq", "user_id", S.uid]]);
  S.set = rows[0] || (await ups("pb_settings", { user_id: S.uid }, "user_id"));
  if (typeof S.set.categories === "string") try { S.set.categories = JSON.parse(S.set.categories); } catch (e) { S.set.categories = []; }
  return S.set;
}

function shell() {
  app.innerHTML = `<main id="main"><div class="boot">Загрузка…</div></main>
    <nav class="tabs">${TABS.map(([k, i, l]) => `<a href="#/${k}" data-tab="${k}"><span class="i">${i}</span>${l}</a>`).join("")}</nav>`;
}

let renderId = 0;
async function route() {
  if (!S.uid) return;
  const [name = "today", arg] = location.hash.replace(/^#\/?/, "").split("/");
  const page = PAGES[name] ? name : "today";
  const tab = PARENT[page] || page;
  $$(".tabs a").forEach((a) => a.classList.toggle("on", a.dataset.tab === tab));
  const main = $("#main");
  const my = ++renderId;
  try {
    const mod = await PAGES[page]();
    if (my !== renderId) return;
    window.scrollTo(0, 0);
    await mod.render(main, arg ? decodeURIComponent(arg) : undefined);
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="card"><h2>Что-то пошло не так</h2><p class="muted">${esc(e.message)}</p><button class="btn wide" onclick="location.reload()">Обновить</button></div>`;
  }
}

/** Перерисовать текущий экран (после изменений). */
export const refresh = () => route();

async function boot() {
  if ("serviceWorker" in navigator && !MOCK) navigator.serviceWorker.register("./sw.js").catch(() => {});
  app.innerHTML = `<div class="boot">Загрузка…</div>`;
  let s = null;
  try { s = await session(); } catch (e) { s = null; }
  if (!s) return loginScreen(app, boot);
  if (!(await allowed())) {
    app.innerHTML = `<div class="login"><div class="logo"><i></i>Личный помощник</div><div class="card"><h2>Нет доступа</h2><p class="muted">Этот помощник — только для владельца. Вы вошли как ${esc(s.user?.email || "")}.</p><button class="btn wide" id="out">Выйти</button></div></div>`;
    $("#out").onclick = logout;
    return;
  }
  S.uid = s.user.id;
  try { await loadSettings(); } catch (e) { toast(e.message, true); S.set = { categories: [] }; }
  shell();
  if (!location.hash || location.hash === "#/") location.hash = "#/" + (new Date().getHours() >= 19 ? "evening" : "today");
  route();
}

window.addEventListener("hashchange", route);
navigator.serviceWorker?.addEventListener?.("message", (e) => { if (e.data?.url) location.href = e.data.url; });
boot();
