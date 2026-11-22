// «Siri и быстрые команды»: одна команда «Скажи Кайросу» — фраза разбирается так же, как кнопка голоса.
import { $$, esc, toast } from "./ui.js";

const BASE = location.origin + location.pathname;
const EX = ["такси восемьсот", "завтра в 10 позвонить риелтору", "идея рассылка для клиентов Тропоса", "оплатить аренду 1 декабря сорок пять тысяч"];

export function render(main) {
  const url = BASE + "#/add?text=";
  main.innerHTML = `<a class="back" href="#/more">‹ Ещё</a><h1>Siri и быстрые команды</h1>
    <p class="voice">«Привет, Siri, скажи Кайросу» — и диктуете. Кайрос разберёт фразу сам: задача, расход, идея, привычка или событие.</p>
    <div class="card"><b>Настройка — один раз, 3 минуты</b><ol class="steps small"><li>Приложение <b>«Команды»</b> → <b>＋</b>.</li><li><b>Добавить действие</b> → «<b>Продиктовать текст</b>» (язык — русский).</li><li>Действие «<b>Закодировать URL</b>».</li>
      <li>Действие «<b>Открыть URL</b>»: вставьте ссылку ниже и сразу после неё — переменную «Закодированный URL».</li><li>Назовите команду «<b>Скажи Кайросу</b>» → Готово.</li></ol>
      <div class="row" style="justify-content:space-between;margin-top:6px"><code>${esc(url)}</code><button class="btn sm" id="cp">Скопировать</button></div>
      <p class="hint">Команда откроет Кайрос в Safari — один раз войдите там тем же кодом.</p></div>
    <div class="cap">Попробовать</div><div class="chips">${EX.map((e) => `<a class="chip" href="#/add?text=${encodeURIComponent(e)}">«${esc(e)}»</a>`).join("")}</div>`;
  $$("#cp", main).forEach((b) => (b.onclick = async () => { try { await navigator.clipboard.writeText(url); toast("Ссылка скопирована"); } catch (e) { prompt("Скопируйте ссылку:", url); } }));
}
