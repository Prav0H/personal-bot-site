// «Дневник»: лента дней — главное, самочувствие, победы, заметки.
import { rows } from "./store.js";
import { today } from "./db.js";
import { esc, dLong } from "./ui.js";
import { MOOD, ENERGY, LOAD } from "./evening.js";

export function render(main) {
  const list = rows("pb_days").filter((d) => d.day <= today() && (d.intention || d.note || d.win || d.mood || d.energy)).sort((a, b) => b.day.localeCompare(a.day)).slice(0, 90);
  main.innerHTML = `<a class="back" href="#/more">‹ Ещё</a><h1>Дневник</h1><p class="voice">Заполняется из «Сегодня» и «Итогов дня».</p>
    ${list.map((d) => `<a class="card" href="#/evening/${d.day}" style="display:block;color:inherit"><div class="row" style="justify-content:space-between"><b>${dLong(d.day)}</b><span style="font-size:16px">${d.mood ? MOOD[d.mood - 1] : ""}${d.energy ? ENERGY[d.energy - 1] : ""}${d.load ? LOAD[d.load - 1] : ""}</span></div>
      ${d.intention ? `<div class="small muted" style="margin-top:6px">🎯 ${esc(d.intention)}</div>` : ""}${d.win ? `<div style="margin-top:6px">🏆 ${esc(d.win)}</div>` : ""}${d.note ? `<div class="quote" style="margin-top:6px;font-size:14px;white-space:pre-wrap">${esc(d.note)}</div>` : ""}</a>`).join("") || `<div class="empty">Пока пусто. Вечером закройте день — здесь появится запись.</div>`}`;
}
