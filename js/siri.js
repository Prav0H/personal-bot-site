// «Siri»: «Привет, Siri, Кайрос» → говорите → запись сразу в Кайрос, без открытия приложения.
// Команда в приложении «Команды» отправляет фразу на сервер Кайроса с личным ключом (в базе — только его отпечаток).
import { $, $$, esc, toast, confirmBox } from "./ui.js";
import { settings, setSettings } from "./store.js";
import { SB_URL } from "./db.js";

const FN = SB_URL + "/functions/v1/pb";
const sha = async (t) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t))), (b) => b.toString(16).padStart(2, "0")).join("");
const newToken = () => "kairos_" + Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
const copy = async (t) => { try { await navigator.clipboard.writeText(t); toast("Скопировано"); } catch (e) { prompt("Скопируйте:", t); } };
let shown = null; // ключ показываем один раз — сразу после создания

export function render(main) {
  const has = !!settings().siri_hash;
  main.innerHTML = `<a class="back" href="#/more">‹ Ещё</a><h1>Siri</h1>
    <p class="voice">«Привет, Siri, Кайрос» — Siri спросит «Что записать?», вы говорите «завтра оплатить аренду» — и Кайрос записывает сам, приложение открывать не нужно. Работает и на заблокированном экране.</p>
    <div class="card hl"><b>Шаг 1. Ключ для команды</b>
      <p class="small muted" style="margin:6px 0 10px">Ключ — длинный пароль, который знает только ваша команда Siri. Без него никто посторонний ничего не запишет. Новый ключ отменяет старый.</p>
      ${shown ? `<div class="small muted">Ваш ключ (показывается один раз — скопируйте в команду):</div><code style="display:block;margin:6px 0;padding:8px;font-size:12px">${esc(shown)}</code><button class="btn sm pri" id="cpk">Скопировать ключ</button>`
        : `<button class="btn sm ${has ? "" : "pri"}" id="mk">${has ? "Создать новый ключ" : "Создать ключ"}</button>${has ? `<span class="small muted" style="margin-left:8px">ключ уже создан</span>` : ""}`}</div>
    <div class="card"><b>Шаг 2. Команда «Кайрос» в приложении «Команды»</b>
      <ol class="steps small" style="margin-top:8px">
        <li>Откройте приложение <b>«Команды»</b> → <b>＋</b> вверху.</li>
        <li><b>Добавить действие</b> → найдите <b>«Продиктовать текст»</b>. Язык — <b>Русский</b>, «Прекратить прослушивание» — <b>После паузы</b>.</li>
        <li>Добавьте действие <b>«Получить содержимое URL»</b>. В поле адреса вставьте:<br><code>${esc(FN)}</code> <button class="btn sm" data-c="${esc(FN)}">Скопировать</button><br>
          Нажмите <b>«Показать больше»</b>: Метод — <b>POST</b>; Заголовки — добавить: <code>Content-Type</code> = <code>application/json</code>; Текст запроса — <b>JSON</b>, добавить три поля (тип «Текст»):<br>
          • <code>action</code> = <code>siri</code><br>• <code>token</code> = ваш ключ из шага 1<br>• <code>text</code> = переменная <b>«Продиктованный текст»</b> (нажмите на поле значения → выберите её над клавиатурой)</li>
        <li>Добавьте действие <b>«Получить значение из словаря»</b>: ключ <code>say</code>.</li>
        <li>Добавьте действие <b>«Произнести текст»</b> (оно возьмёт значение словаря).</li>
        <li>Вверху нажмите на название и назовите команду <b>«Кайрос»</b> → Готово.</li></ol>
      <p class="small muted">Проверка: «Привет, Siri, Кайрос» → «такси восемьсот». Siri ответит: «Записал расход 800 рублей, Дорога».</p></div>
    <div class="card"><b>Ещё быстрее</b><p class="small muted" style="margin-top:6px">• Кнопка действия (iPhone 15 Pro и новее): Настройки → Кнопка действия → Быстрая команда → «Кайрос».<br>• Двойное касание задней крышки: Настройки → Универсальный доступ → Касание → Касание задней панели → «Кайрос».</p></div>
    <div class="card"><b>Как говорить</b><p class="small muted" style="margin-top:6px">Ключевое слово в начале — Кайрос поймёт точно: <b>«расход</b> такси 800», <b>«задача</b> позвонить маме», <b>«идея</b> …», <b>«привычка</b> читать каждый день», <b>«встреча</b> с риелтором в пятницу в 15». Без ключевого слова Кайрос догадается сам, а если не уверен — положит во «Входящие».</p></div>`;
  $$("[data-c]", main).forEach((b) => (b.onclick = () => copy(b.dataset.c)));
  $("#cpk", main) && ($("#cpk", main).onclick = () => copy(shown));
  $("#mk", main) && ($("#mk", main).onclick = async () => {
    if (has && !(await confirmBox("Создать новый ключ? Старая команда Siri перестанет работать, пока не вставите новый ключ.", "Создать"))) return;
    const t = newToken(); setSettings({ siri_hash: await sha(t) }); shown = t; render(main);
  });
}
