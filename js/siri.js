// «Siri и быстрый ввод»: как сделать команды «Запиши трату / задачу / идею» в приложении «Команды».
import { $$, esc, toast } from "./ui.js";

const BASE = location.origin + location.pathname;
const CMDS = [
  ["expense", "💸", "Запиши трату", "кафе 450 обед", "Сумма и категория первым словом: «такси 380», «продукты 2 150 на неделю». Слово «работа» или «клиент» — трата станет рабочей."],
  ["task", "✅", "Запиши задачу", "позвонить Стасу", "Попадёт на сегодня. Начните со слова «завтра» — попадёт на завтра."],
  ["idea", "💡", "Запиши идею", "сделать бота для стоматологий", "Сохранится в «Идеи» — потом оцените её с Claude."],
];

export async function render(main) {
  main.innerHTML = `<div class="top"><div><a href="#/more" class="small">← Ещё</a><h1>Siri и быстрый ввод</h1><div class="sub">Скажите «Привет, Siri, запиши трату» — и продиктуйте</div></div></div>
    <div class="card"><b>Как настроить (один раз, 3 минуты на команду)</b>
      <ol class="steps small"><li>Откройте приложение <b>«Команды»</b> на iPhone → <b>＋</b> (новая команда).</li>
      <li><b>Добавить действие</b> → найдите <b>«Продиктовать текст»</b> → язык: русский.</li>
      <li>Добавьте действие <b>«Закодировать URL»</b> (оно само возьмёт продиктованный текст).</li>
      <li>Добавьте действие <b>«Открыть URL»</b>. В поле адреса вставьте ссылку из карточки ниже (кнопка «Скопировать») и сразу после неё — переменную <b>«Закодированный URL»</b>.</li>
      <li>Нажмите на название вверху и назовите команду, например <b>«Запиши трату»</b> → Готово.</li></ol>
      <p class="small muted">Команда откроет помощника в Safari. Один раз войдите там тем же кодом — дальше вход запомнится.</p></div>
    ${CMDS.map(([t, i, name, ex, hint]) => `<div class="card"><div class="row" style="justify-content:space-between"><b>${i} «${name}»</b><button class="btn sm" data-copy="${esc(BASE + "#/add?t=" + t + "&text=")}">Скопировать</button></div>
      <div class="small" style="margin-top:6px"><code>${esc(BASE)}#/add?t=${t}&amp;text=</code> + продиктованный текст</div>
      <div class="small muted" style="margin-top:6px">Пример: «${esc(ex)}». ${esc(hint)}</div>
      <a class="btn sm" style="margin-top:8px" href="#/add?t=${t}&text=${encodeURIComponent(ex)}">Попробовать: «${esc(ex)}»</a></div>`).join("")}
    <p class="hint center">Эти же ссылки можно поставить в виджет «Команды» на экран «Домой».</p>`;
  $$("[data-copy]", main).forEach((b) => (b.onclick = async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); toast("Ссылка скопирована"); }
    catch (e) { prompt("Скопируйте ссылку:", b.dataset.copy); }
  }));
}
