// «Siri»: «Привет, Siri, Кайрос» → говорите → запись сразу в Кайрос, без открытия приложения.
// Команда в приложении «Команды»: продиктовать → закодировать → открыть ссылку с ключом → произнести ответ.
import { $, $$, esc, toast, confirmBox } from "./ui.js";
import { settings, setSettings } from "./store.js";
import { SB_URL } from "./db.js";

const FN = SB_URL + "/functions/v1/pb";
const link = (token) => `${FN}?action=siri&format=text&token=${encodeURIComponent(token)}&text=`;
const sha = async (t) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t))), (b) => b.toString(16).padStart(2, "0")).join("");
const newToken = () => "kairos_" + Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
const copy = async (t) => { try { await navigator.clipboard.writeText(t); toast("Скопировано"); } catch (e) { prompt("Скопируйте:", t); } };
let token = null; // ключ виден только сейчас, на этом экране; в базе — лишь его отпечаток

export function render(main) {
  const has = !!settings().siri_hash;
  main.innerHTML = `<a class="back" href="#/more">‹ Ещё</a><h1>Siri</h1>
    <p class="voice">«Привет, Siri, Кайрос» → Siri слушает → «расход такси восемьсот» → Siri отвечает: «Записал расход 800 рублей, Дорога». Приложение открывать не нужно.</p>
    <div class="card hl"><b>Шаг 1. Ссылка с вашим ключом</b>
      ${token ? `<p class="small muted" style="margin:6px 0">Готовая ссылка — скопируйте её, она понадобится в шаге 2 (третье действие):</p>
        <code style="display:block;padding:8px;font-size:11px">${esc(link(token))}</code>
        <button class="btn pri wide" id="cpl" style="margin-top:8px">Скопировать ссылку</button>`
      : `<p class="small muted" style="margin:6px 0 10px">${has ? "Ключ уже создан. Если старая команда не работает — создайте новый: ссылка появится здесь." : "Ключ — длинный пароль внутри ссылки. Без него никто посторонний ничего не запишет."}</p>
        <button class="btn ${has ? "" : "pri"} wide" id="mk">${has ? "Создать новый ключ и ссылку" : "Создать ключ и ссылку"}</button>
        <details style="margin-top:8px"><summary class="small muted">У меня уже есть ключ (kairos_…)</summary><div class="row" style="margin-top:6px"><input id="ek" placeholder="kairos_…" autocomplete="off"><button class="btn sm" id="ekb">Собрать ссылку</button></div></details>`}</div>
    <div class="card"><b>Шаг 2. Команда «Кайрос» — 4 действия</b>
      <p class="small muted" style="margin-top:4px">Если команда уже есть — удалите в ней всё и соберите заново по шагам.</p>
      <ol class="steps small" style="margin-top:8px">
        <li><b>«Продиктовать текст»</b> — Язык: Русский, Конец диктовки: После паузы.</li>
        <li><b>«Закодировать URL»</b> (поиск: «закодировать»). Оно само возьмёт «Продиктованный текст».</li>
        <li><b>«Получить содержимое URL»</b>. Нажмите на синее поле адреса → <b>Вставить</b> ссылку из шага 1 (она заканчивается на <code>&text=</code>) → сразу после неё, не ставя пробел, нажмите над клавиатурой переменную <b>«Закодированный URL»</b>. Больше ничего не меняйте — метод GET, без полей.</li>
        <li><b>«Произнести текст»</b> → в поле выберите <b>«Содержимое URL»</b>.</li>
        <li>Вверху нажмите на название команды → <b>Переименовать</b> → «Кайрос».</li></ol>
      <p class="small muted">Проверка: нажмите ▶ внизу и скажите «расход такси восемьсот» — iPhone должен ответить голосом. Затем: «Привет, Siri, Кайрос».</p></div>
    <div class="card"><b>Ещё быстрее</b><p class="small muted" style="margin-top:6px">• Кнопка действия (iPhone 15 Pro и новее): Настройки → Кнопка действия → Быстрая команда → «Кайрос».<br>• Двойное касание задней крышки: Настройки → Универсальный доступ → Касание → Касание задней панели → «Кайрос».</p></div>
    <div class="card"><b>Как говорить</b><p class="small muted" style="margin-top:6px">С ключевым словом — точно: <b>«расход</b> такси 800», <b>«задача</b> позвонить маме», <b>«идея</b> …», <b>«привычка</b> читать каждый день», <b>«встреча</b> с риелтором в пятницу в 15». Без него Кайрос догадается сам, а если не уверен — положит во «Входящие».</p></div>`;
  $("#cpl", main) && ($("#cpl", main).onclick = () => copy(link(token)));
  $("#ekb", main) && ($("#ekb", main).onclick = () => { const v = $("#ek", main).value.trim(); if (!/^kairos_[0-9a-f]{20,}$/.test(v)) return toast("Ключ начинается с kairos_ и состоит из букв a–f и цифр", true); token = v; render(main); });
  $("#mk", main) && ($("#mk", main).onclick = async () => {
    if (has && !(await confirmBox("Создать новый ключ? Старая команда Siri перестанет работать, пока не вставите новую ссылку.", "Создать"))) return;
    const t = newToken(); setSettings({ siri_hash: await sha(t) }); token = t; render(main);
  });
}
