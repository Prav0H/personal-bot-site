// Вход: тот же аккаунт, что в Tropos — по коду из 4 цифр или по почте и паролю.
import { sb, tg } from "./db.js";
import { $, $$, esc } from "./ui.js";

const pref = (k, v) => { try { if (v === undefined) return localStorage.getItem("pb_" + k); localStorage.setItem("pb_" + k, v); } catch (e) { return null; } };

export async function loginScreen(app, onDone, msg = "") {
  app.innerHTML = `<div class="login"><div class="logo"><i></i>Личный помощник</div><div id="lb"><div class="boot">Загрузка…</div></div>
    <button class="btn ghost" id="byMail" style="margin-top:14px">Войти по почте и паролю</button></div>`;
  $("#byMail").onclick = () => mailForm(app, onDone);
  let people = [];
  try { people = JSON.parse(pref("people") || "[]"); } catch (e) { people = []; }
  const fresh = tg({ login: "people" }).then((j) => { pref("people", JSON.stringify(j.people || [])); return j.people || []; });
  if (!people.length) { try { people = await fresh; } catch (e) { return mailForm(app, onDone, e.message); } } else fresh.catch(() => {});
  if (!people.length) return mailForm(app, onDone, "Код для входа ещё не задан — войдите по почте и паролю или задайте код в Tropos (Профиль).");
  const lb = $("#lb");
  const chooser = () => {
    lb.innerHTML = `<h2>Кто входит?</h2>${msg ? `<p class="pin-err">${esc(msg)}</p>` : ""}<div class="who">${people.map((p) => `<button data-p="${p.id}"><span class="ava">${esc(p.name.split(" ").map((x) => x[0]).join("").slice(0, 2))}</span>${esc(p.name)}</button>`).join("")}</div>
      <p class="hint">Тот же код, что для входа в Tropos.</p>`;
    $$("[data-p]", lb).forEach((b) => (b.onclick = () => keypad(people.find((p) => p.id === b.dataset.p))));
  };
  const keypad = (p, err = "") => {
    pref("last", p.id);
    let code = "";
    lb.innerHTML = `${people.length > 1 ? `<button class="btn ghost" id="back">← Другой человек</button>` : ""}<h2 class="center">${esc(p.name)}</h2><p class="muted center small">Код из 4 цифр — как в Tropos</p>
      <div class="pin-dots">${"<i></i>".repeat(4)}</div><div class="pin-err">${esc(err)}</div>
      <div class="pin-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map((k) => (k === "" ? "<span></span>" : `<button data-k="${k}">${k}</button>`)).join("")}</div>`;
    $("#back", lb) && ($("#back", lb).onclick = chooser);
    const dots = () => $$(".pin-dots i", lb).forEach((x, i) => x.classList.toggle("on", i < code.length));
    const go = async () => {
      lb.style.opacity = ".5";
      try {
        const j = await tg({ login: "pin", person_id: p.id, pin: code });
        const { error } = await sb.auth.verifyOtp({ token_hash: j.token_hash, type: "magiclink" });
        if (error) throw new Error(error.message);
        onDone();
      } catch (e) { lb.style.opacity = ""; keypad(p, e.message); $(".pin-dots", lb).classList.add("shake"); }
    };
    $$("[data-k]", lb).forEach((b) => (b.onclick = () => {
      const k = b.dataset.k;
      if (k === "⌫") code = code.slice(0, -1); else if (code.length < 4) code += k;
      dots(); if (code.length === 4) go();
    }));
  };
  const last = people.find((p) => p.id === pref("last"));
  if (people.length === 1) keypad(people[0], msg); else if (last && !msg) keypad(last); else chooser();
}

function mailForm(app, onDone, msg = "") {
  app.innerHTML = `<div class="login"><div class="logo"><i></i>Личный помощник</div>
    <form id="lf" class="card"><h2>Вход</h2>${msg ? `<p class="pin-err" style="text-align:left">${esc(msg)}</p>` : ""}
    <label class="f">Почта</label><input name="email" type="email" autocomplete="username" autocapitalize="none" required>
    <label class="f">Пароль</label><input name="password" type="password" autocomplete="current-password" required>
    <button class="btn pri wide" style="margin-top:14px">Войти</button>
    <p class="hint">Почта и пароль — те же, что в программе Tropos.</p></form>
    <button class="btn ghost" id="byPin">Войти по коду</button></div>`;
  $("#byPin").onclick = () => loginScreen(app, onDone);
  $("#lf").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target, b = $("button", f);
    b.disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim().toLowerCase(), password: f.password.value });
    b.disabled = false;
    if (error) return mailForm(app, onDone, /invalid/i.test(error.message) ? "Неверная почта или пароль" : error.message);
    onDone();
  };
}
