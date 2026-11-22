// «Настройки»: уведомления и время, остаток и бюджет, категории, Claude, выгрузка данных, выход.
import { sb, fn, logout, MOCK } from "./db.js";
import { settings, setSettings, rows, TABLES, sync, pending } from "./store.js";
import { $, $$, esc, toast, busy, confirmBox, rub } from "./ui.js";
import { cats, balanceNow } from "./model.js";

const standalone = () => window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const b64 = (s) => { const p = "=".repeat((4 - (s.length % 4)) % 4); const raw = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...raw].map((c) => c.charCodeAt(0))); };
const swReady = (ms) => Promise.race([navigator.serviceWorker?.ready, new Promise((r) => setTimeout(() => r(null), ms))]);

async function subscribe() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error(ios() && !standalone() ? "Сначала добавьте Кайрос на экран «Домой» и откройте его оттуда" : "Это устройство не поддерживает уведомления");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Уведомления запрещены. Разрешите: Настройки iPhone → Уведомления → Кайрос");
  const reg = await swReady(8000); if (!reg) throw new Error("Приложение ещё не готово — закройте и откройте его снова");
  const { key } = await fn({ action: "vapid" });
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) }));
  const j = sub.toJSON();
  const { error } = await sb.from("pb_push").upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, ua: navigator.userAgent.slice(0, 200) }, { onConflict: "endpoint" });
  if (error) throw new Error(error.message);
  setSettings({ push_on: true });
}

export function render(main) {
  const st = settings();
  let list = [...cats()];
  main.innerHTML = `<a class="back" href="#/more">‹ Ещё</a><h1>Настройки</h1>
    ${ios() && !standalone() ? `<div class="card hl"><b>📲 Установите Кайрос на iPhone</b><p class="small muted" style="margin-top:6px">Safari → «Поделиться» → «На экран «Домой»» → «Добавить». Откройте с экрана «Домой» — так работают уведомления и быстрый запуск.</p></div>` : ""}
    <div class="cap">Уведомления</div>
    <div class="card"><div class="row" style="justify-content:space-between"><div><b>На этом устройстве</b><div class="small muted" id="pst">проверяю…</div></div><button class="btn sm pri" id="sub">Включить</button></div>
      <div class="row2"><div><label class="f">☀️ Утром — план дня</label><input type="time" id="mor" value="${String(st.morning || "08:00").slice(0, 5)}"></div><div><label class="f">🌙 Вечером — итоги</label><input type="time" id="eve" value="${String(st.evening || "21:00").slice(0, 5)}"></div></div>
      <label class="row" style="margin-top:12px;gap:8px"><input type="checkbox" id="pon" ${st.push_on !== false ? "checked" : ""}> <span>Утреннее и вечернее напоминание</span></label>
      <label class="row" style="margin-top:8px;gap:8px"><input type="checkbox" id="won" ${st.weekly_on !== false ? "checked" : ""}> <span>По воскресеньям — итоги недели</span></label>
      <label class="f">Часовой пояс</label><select id="tz">${["Europe/Kaliningrad", "Europe/Moscow", "Europe/Samara", "Asia/Yekaterinburg", "Asia/Novosibirsk", "Asia/Dubai", "Europe/Istanbul", "Asia/Yerevan", "Asia/Tbilisi", "Europe/Berlin", "Europe/Lisbon"].map((z) => `<option ${z === (st.tz || "Europe/Moscow") ? "selected" : ""}>${z}</option>`).join("")}</select>
      <p class="hint">Напоминания задач и событий приходят в выбранное время (с точностью до 5 минут).</p></div>
    <div class="cap">Деньги</div>
    <div class="card"><div class="row2" style="margin-top:0"><div><label class="f" style="margin-top:0">На счёте сейчас, ₽</label><input id="bal" inputmode="decimal" value="${balanceNow() != null ? Math.round(balanceNow()) : ""}" placeholder="не задан"></div><div><label class="f" style="margin-top:0">Бюджет месяца, ₽</label><input id="bud" inputmode="decimal" value="${st.budget ? +st.budget : ""}" placeholder="не задан"></div></div>
      <label class="f">Категории трат</label><div class="chips" id="cats"></div><form class="row" id="catf" style="margin-top:8px"><input placeholder="Новая категория"><button class="btn sm">Добавить</button></form></div>
    <button class="btn pri wide" id="save">Сохранить</button>
    <div class="cap">Claude</div><div class="card" id="cl"><span class="muted small">Проверяю…</span></div>
    <div class="cap">Данные</div>
    <div class="card flat"><a class="li" href="#" id="sy" style="color:inherit"><span class="ic">↻</span><div class="tx">Синхронизировать сейчас<div class="s">${pending() ? "ждут отправки: " + pending() : "всё отправлено"}</div></div></a>
      <a class="li" href="#" id="exp" style="color:inherit"><span class="ic">⬇️</span><div class="tx">Выгрузить все данные<div class="s">Файл JSON — на память или для переноса</div></div></a>
      <a class="li" href="#" id="out" style="color:var(--bad)"><span class="ic">🚪</span><div class="tx">Выйти</div></a></div>
    <p class="hint center">Записи хранятся на устройстве и в закрытом разделе базы Tropos — видны только вам. Работает и без интернета.</p>`;
  const drawCats = () => { $("#cats", main).innerHTML = list.map((c) => `<button class="chip" data-c="${esc(c)}">${esc(c)} ✕</button>`).join(""); $$("#cats .chip", main).forEach((b) => (b.onclick = () => { list = list.filter((x) => x !== b.dataset.c); drawCats(); })); };
  drawCats();
  $("#catf", main).onsubmit = (e) => { e.preventDefault(); const v = $("input", e.target).value.trim(); if (v && !list.includes(v)) list.push(v); $("input", e.target).value = ""; drawCats(); };
  $("#save", main).onclick = () => {
    const num = (id) => { const v = String($(id, main).value).replace(/\s/g, "").replace(",", "."); return v === "" ? null : +v; };
    const p = { morning: $("#mor", main).value || "08:00", evening: $("#eve", main).value || "21:00", tz: $("#tz", main).value, push_on: $("#pon", main).checked, weekly_on: $("#won", main).checked, budget: num("#bud"), categories: list };
    if (p.morning !== String(st.morning || "").slice(0, 5)) p.last_morning = null;
    if (p.evening !== String(st.evening || "").slice(0, 5)) p.last_evening = null;
    const b = num("#bal"), cur = balanceNow();
    if (b !== (cur != null ? Math.round(cur) : null)) { p.balance = b; p.balance_at = new Date().toLocaleDateString("en-CA"); }
    setSettings(p); toast("Сохранено");
  };
  $("#sy", main).onclick = async (e) => { e.preventDefault(); await sync(); toast("Синхронизировано"); render(main); };
  $("#exp", main).onclick = (e) => { e.preventDefault(); const out = {}; TABLES.forEach((t) => (out[t] = rows(t))); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: "application/json" })); a.download = `kairos-${new Date().toLocaleDateString("en-CA")}.json`; a.click(); };
  $("#out", main).onclick = async (e) => { e.preventDefault(); if (await confirmBox(pending() ? `Не отправлено изменений: ${pending()}. Всё равно выйти?` : "Выйти из Кайроса на этом устройстве?", "Выйти")) logout(); };
  $("#sub", main).onclick = (ev) => busy(ev.currentTarget, async () => { await subscribe(); const j = await fn({ action: "test" }); toast(`Проверочное уведомление отправлено (${j.sent})`); render(main); });
  (async () => {
    let here = false;
    try { const reg = await swReady(1500); const sub = await reg?.pushManager?.getSubscription(); here = !!sub; } catch (e) {}
    const perm = "Notification" in window ? Notification.permission : "";
    const el = $("#pst", main); if (!el) return;
    el.textContent = here ? "✓ включены" : perm === "denied" ? "запрещены в настройках iPhone" : "выключены";
    $("#sub", main).textContent = here ? "Проверить" : "Включить";
    try { const s = await fn({ action: "status" }); $("#cl", main).innerHTML = s.claude ? `<b>✓ Claude подключён</b><p class="small muted" style="margin-top:6px">Разборы в «Обзоре», «Финансах», «Идеях», «Спросить Claude».</p>` : claudeHelp(); }
    catch (e) { $("#cl", main).innerHTML = MOCK ? "Тестовый режим" : claudeHelp(); }
  })();
}
const claudeHelp = () => `<b>Claude ещё не подключён</b><ol class="steps small" style="margin-top:8px"><li>platform.claude.com → <b>API keys</b> → <b>Create key</b>; пополните баланс в <b>Billing</b> (5–10 $ хватит на месяцы).</li><li>Ключ (начинается с <code>sk-ant-</code>) никому не пересылайте, в том числе нейросетям.</li><li>supabase.com → проект «Тропос» → <b>Edge Functions</b> → <b>Secrets</b> → <b>Add new secret</b>: имя <code>ANTHROPIC_API_KEY</code>, значение — ключ.</li></ol>`;
