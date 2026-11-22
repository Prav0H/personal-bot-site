// «Ещё»: остальные разделы.
import { esc } from "./ui.js";
import { rows, pending } from "./store.js";
import { VERSION } from "./main.js";

export function render(main) {
  const items = [
    ["inbox", "📥", "Входящие", `Что Кайрос не понял${rows("pb_inbox").length ? " · " + rows("pb_inbox").length : ""}`], ["calendar", "🗓", "Календарь", "Месяц, расписание дня, напоминания"],
    ["habits", "🔁", "Привычки", "Ритм недели и серии"], ["ideas", "💡", "Идеи", "Банк идей: в задачу или в цель"], ["review", "📊", "Обзор", "Неделя, месяц или свой период"],
    ["evening", "🌙", "Итоги дня", "План против факта, самочувствие, заметка"], ["journal", "📓", "Дневник", "Все дни подряд"], ["ask", "✨", "Спросить Claude", "С учётом ваших записей"],
    ["search", "🔎", "Поиск", "Задачи, идеи, дневник, траты"], ["siri", "🎙️", "Siri и быстрые команды", "«Привет, Siri, запиши трату»"], ["settings", "⚙️", "Настройки", "Уведомления, категории, бюджет, Claude"],
  ];
  main.innerHTML = `<a class="back" href="#/today">‹ Сегодня</a><h1>Ещё</h1>
    <div class="card flat">${items.map(([k, i, t, s]) => `<a class="li" href="#/${k}" style="color:inherit"><span class="ic">${i}</span><div class="tx"><div>${t}</div><div class="s">${esc(s)}</div></div><span class="ar">›</span></a>`).join("")}</div>
    <p class="hint center">Кайрос · версия ${VERSION}${pending() ? ` · ждут отправки: ${pending()}` : " · всё сохранено"}</p>`;
}
