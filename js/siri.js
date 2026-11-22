// «Siri»: только ключ и ссылка для команды «Кайрос» (инструкция — у Левона в чате).
// Команда отправляет продиктованную фразу на эту ссылку (POST, текст запроса — сама фраза), сервер отвечает текстом.
import { $, esc, toast, confirmBox } from "./ui.js";
import { settings, setSettings } from "./store.js";
import { SB_URL } from "./db.js";

const link = (token) => `${SB_URL}/functions/v1/pb?action=siri&format=text&token=${encodeURIComponent(token)}`;
const sha = async (t) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t))), (b) => b.toString(16).padStart(2, "0")).join("");
const newToken = () => "kairos_" + Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
const copy = async (t) => { try { await navigator.clipboard.writeText(t); toast("Ссылка скопирована"); } catch (e) { prompt("Скопируйте:", t); } };
let token = null; // ключ виден только сейчас, на этом экране; в базе — лишь его отпечаток

export function render(main) {
  const has = !!settings().siri_hash;
  main.innerHTML = `<a class="back" href="#/more">‹ Ещё</a><h1>Siri</h1>
    <div class="card hl"><b>Ссылка для команды «Кайрос»</b>
      ${token ? `<code style="display:block;margin-top:8px;padding:8px;font-size:11px">${esc(link(token))}</code>
        <button class="btn pri wide" id="cpl" style="margin-top:8px">Скопировать ссылку</button>
        <p class="hint">Ссылка показывается один раз. Потеряли — создайте новую (старая перестанет работать).</p>`
      : `<p class="small muted" style="margin:6px 0 10px">${has ? "Ссылка уже создана. Чтобы получить её снова, создайте новую — старая перестанет работать." : "В ссылке — ваш личный ключ: без него никто посторонний ничего не запишет."}</p>
        <button class="btn ${has ? "" : "pri"} wide" id="mk">${has ? "Создать новую ссылку" : "Создать ссылку"}</button>`}</div>`;
  $("#cpl", main) && ($("#cpl", main).onclick = () => copy(link(token)));
  $("#mk", main) && ($("#mk", main).onclick = async () => {
    if (has && !(await confirmBox("Создать новую ссылку? Старая команда Siri перестанет работать, пока не вставите новую.", "Создать"))) return;
    const t = newToken(); setSettings({ siri_hash: await sha(t) }); token = t; render(main);
  });
}
