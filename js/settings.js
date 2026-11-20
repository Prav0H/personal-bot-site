// «Настройки»: уведомления и время, категории, бюджет, Claude, выгрузка данных, выход.
import { list, upd, del, ups, fn, logout, MOCK } from "./db.js";
import { $, $$, esc, toast, busy, confirmBox } from "./ui.js";
import { S, loadSettings } from "./main.js";

const standalone = () => window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const b64 = (s) => { const p = "=".repeat((4 - (s.length % 4)) % 4); const raw = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...raw].map((c) => c.charCodeAt(0))); };

async function subscribe() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error(ios() && !standalone() ? "Сначала добавьте приложение на экран «Домой» и откройте его оттуда" : "Это устройство не поддерживает уведомления");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Уведомления запрещены. Разрешите: Настройки iPhone → Уведомления → Личный помощник");
  const reg = await navigator.serviceWorker.ready;
  const { key } = await fn({ action: "vapid" });
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
  const j = sub.toJSON();
  await ups("pb_push", { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, ua: navigator.userAgent.slice(0, 200) }, "endpoint");
  await upd("pb_settings", [["eq", "user_id", S.uid]], { push_on: true });
}

export async function render(main) {
  const st = S.set || {};
  const subs = await list("pb_push", []);
  let mySub = null;
  try { mySub = await (await navigator.serviceWorker?.ready)?.pushManager?.getSubscription(); } catch (e) {}
  const here = mySub && subs.some((s) => s.endpoint === mySub.endpoint);
  const perm = "Notification" in window ? Notification.permission : "нет";
  main.innerHTML = `<div class="top"><div><a href="#/more" class="small">← Ещё</a><h1>Настройки</h1></div></div>
    ${ios() && !standalone() ? `<div class="card" style="background:var(--warn-soft);border-color:var(--warn)"><b>📲 Установите на iPhone</b><p class="small" style="margin-top:6px">В Safari нажмите «Поделиться» (квадрат со стрелкой) → «На экран «Домой»» → «Добавить». Затем откройте помощника с экрана «Домой» — только так работают уведомления.</p></div>` : ""}
    <h3>Уведомления</h3>
    <div class="card"><div class="row" style="justify-content:space-between"><div><b>На этом устройстве</b><div class="small muted">${here ? "✅ включены" : perm === "denied" ? "⛔ запрещены в настройках iPhone" : "выключены"} · всего устройств: ${subs.length}</div></div>
      <button class="btn ${here ? "" : "pri"} sm" id="sub">${here ? "Проверить" : "Включить"}</button></div>
      <div class="row2"><div><label class="f">☀️ Утром</label><input type="time" id="mor" value="${String(st.morning || "08:00").slice(0, 5)}"></div><div><label class="f">🌙 Вечером</label><input type="time" id="eve" value="${String(st.evening || "21:00").slice(0, 5)}"></div></div>
      <label class="chk row" style="margin-top:12px"><input type="checkbox" id="pon" ${st.push_on !== false ? "checked" : ""} style="width:22px;height:22px"> <span>Присылать утреннее и вечернее напоминание</span></label>
      <label class="f">Часовой пояс</label><select id="tz">${["Europe/Kaliningrad", "Europe/Moscow", "Europe/Samara", "Asia/Yekaterinburg", "Asia/Omsk", "Asia/Novosibirsk", "Asia/Krasnoyarsk", "Asia/Irkutsk", "Asia/Vladivostok", "Asia/Dubai", "Europe/Istanbul", "Asia/Yerevan", "Asia/Tbilisi"].map((z) => `<option ${z === (st.tz || "Europe/Moscow") ? "selected" : ""}>${z}</option>`).join("")}</select>
      <p class="hint">Утром — план и задачи на день, вечером — итоги. Приходят в пределах 5 минут от выбранного времени.</p></div>
    <h3>Траты</h3>
    <div class="card"><label class="f" style="margin-top:0">Бюджет личных трат на месяц, ₽</label><input id="bud" inputmode="decimal" value="${st.budget ? +st.budget : ""}" placeholder="Не задан">
      <label class="f">Категории</label><div class="chips" id="cats">${(st.categories || []).map((c) => `<button class="chip" data-c="${esc(c)}">${esc(c)} ✕</button>`).join("")}</div>
      <form class="row" id="catf" style="margin-top:8px"><input placeholder="Новая категория"><button class="btn sm">Добавить</button></form></div>
    <button class="btn pri wide" id="save">Сохранить настройки</button>
    <h3>Claude</h3>
    <div class="card" id="cl"><span class="muted">Проверяю…</span></div>
    <h3>Данные</h3>
    <div class="card flat"><a class="li" href="#" id="exp" style="color:inherit"><span class="ic">⬇️</span><div class="tx">Выгрузить все мои данные<div class="s">Файл JSON — на память или для переноса</div></div></a>
      <a class="li" href="#" id="out" style="color:var(--bad)"><span class="ic">🚪</span><div class="tx">Выйти</div></a></div>
    <p class="hint center">Данные хранятся в закрытом разделе базы Tropos и видны только вам.</p>`;

  $("#sub", main).onclick = (ev) => busy(ev.currentTarget, async () => {
    if (!here) { await subscribe(); toast("Уведомления включены 🔔"); }
    const j = await fn({ action: "test" }); toast(`Проверочное уведомление отправлено (${j.sent})`);
    render(main);
  });
  let cats = [...(st.categories || [])];
  const drawCats = () => { $("#cats", main).innerHTML = cats.map((c) => `<button class="chip" data-c="${esc(c)}">${esc(c)} ✕</button>`).join(""); $$("#cats .chip", main).forEach((b) => (b.onclick = () => { cats = cats.filter((x) => x !== b.dataset.c); drawCats(); })); };
  drawCats();
  $("#catf", main).onsubmit = (e) => { e.preventDefault(); const v = $("input", e.target).value.trim(); if (v && !cats.includes(v)) cats.push(v); $("input", e.target).value = ""; drawCats(); };
  $("#save", main).onclick = (ev) => busy(ev.currentTarget, async () => {
    const budget = +String($("#bud", main).value).replace(/\s/g, "").replace(",", ".") || null;
    const patch = { morning: $("#mor", main).value || "08:00", evening: $("#eve", main).value || "21:00", tz: $("#tz", main).value, push_on: $("#pon", main).checked, budget, categories: cats, updated_at: new Date().toISOString() };
    // если время перенесли на «сейчас+», разрешить сегодняшнее уведомление ещё раз
    if (patch.morning !== String(st.morning).slice(0, 5)) patch.last_morning = null;
    if (patch.evening !== String(st.evening).slice(0, 5)) patch.last_evening = null;
    await upd("pb_settings", [["eq", "user_id", S.uid]], patch);
    await loadSettings(); toast("Сохранено");
  });
  $("#exp", main).onclick = async (e) => {
    e.preventDefault();
    const out = {};
    for (const t of ["pb_tasks", "pb_moves", "pb_days", "pb_expenses", "pb_ideas", "pb_habits", "pb_habit_log", "pb_settings", "pb_ai"]) out[t] = await list(t, []);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: "application/json" }));
    a.download = `pomoshnik-${new Date().toLocaleDateString("en-CA")}.json`; a.click();
  };
  $("#out", main).onclick = async (e) => { e.preventDefault(); if (await confirmBox("Выйти из помощника на этом устройстве?", "Выйти")) logout(); };
  try {
    const s = await fn({ action: "status" });
    $("#cl", main).innerHTML = s.claude ? `<b>✅ Claude подключён</b><p class="small muted" style="margin-top:6px">Разборы: «Неделя», «Деньги», «Идеи», «Спросить Claude». Модель Claude Opus 5.5, оплата по факту использования.</p>`
      : `<b>Claude ещё не подключён</b><p class="small" style="margin-top:6px">Нужен ключ — один раз, с компьютера:</p><ol class="small" style="padding-left:18px;margin:6px 0"><li>Откройте platform.claude.com → войдите → <b>API keys</b> → <b>Create key</b>. Пополните баланс в <b>Billing</b> (хватит 5–10 $ на несколько месяцев).</li><li>Скопируйте ключ (начинается с <code>sk-ant-</code>). Никому его не пересылайте, в том числе нейросетям.</li><li>Откройте supabase.com → проект «Тропос» → <b>Edge Functions</b> → <b>Secrets</b> → <b>Add new secret</b>: имя <code>ANTHROPIC_API_KEY</code>, значение — ключ → Save.</li></ol><p class="small muted">После этого обновите эту страницу — здесь появится ✅.</p>`;
  } catch (e) { $("#cl", main).innerHTML = `<span class="muted small">${esc(MOCK ? "Тестовый режим" : e.message)}</span>`; }
}
