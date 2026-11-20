// «Ещё»: остальные разделы.
import { esc } from "./ui.js";
import { S, VERSION } from "./main.js";

const ITEMS = [
  ["week", "📊", "Неделя", "Цифры недели и разбор Claude"],
  ["search", "🔎", "Поиск", "По задачам, идеям, дневнику и тратам"],
  ["ask", "✨", "Спросить Claude", "Любой вопрос — с учётом ваших записей"],
  ["journal", "📓", "Дневник", "Все дни: главное, самочувствие, заметки"],
  ["tasks", "✅", "Все задачи", "Открытые, без срока, сделанные"],
  ["habits", "🔁", "Привычки", "Что отмечать каждый день"],
  ["siri", "🎙️", "Siri и быстрый ввод", "«Привет, Siri, запиши трату» — без открытия приложения"],
  ["settings", "⚙️", "Настройки", "Уведомления, категории, бюджет, Claude"],
];

export async function render(main) {
  main.innerHTML = `<div class="top"><div><h1>Ещё</h1></div></div>
    <div class="card flat">${ITEMS.map(([k, i, t, s]) => `<a class="li" href="#/${k}" style="color:inherit"><span class="ic">${i}</span><div class="tx"><div>${t}</div><div class="s">${esc(s)}</div></div><span class="ar">›</span></a>`).join("")}</div>
    <p class="hint center">Личный помощник · версия ${VERSION}${S.set?.push_on ? "" : " · уведомления выключены"}</p>`;
}
