// «Дневник»: лента дней — главное, самочувствие, победы, заметки.
import { list, today } from "./db.js";
import { esc, dLong } from "./ui.js";
import { MOOD, ENERGY, LOAD } from "./evening.js";

export async function render(main) {
  const days = await list("pb_days", [["lte", "day", today()]], "day desc", 60);
  const rows = days.filter((d) => d.intention || d.note || d.win || d.mood || d.energy);
  main.innerHTML = `<div class="top"><div><a href="#/more" class="small">← Ещё</a><h1>Дневник</h1><div class="sub">Заполняется из «Сегодня» и «Вечера»</div></div></div>
    ${rows.map((d) => `<a class="card" href="#/evening/${d.day}" style="display:block;color:inherit">
      <div class="row" style="justify-content:space-between"><b>${dLong(d.day)}</b><span style="font-size:18px">${d.mood ? MOOD[d.mood - 1] : ""}${d.energy ? ENERGY[d.energy - 1] : ""}${d.load ? LOAD[d.load - 1] : ""}</span></div>
      ${d.intention ? `<div class="small muted" style="margin-top:6px">🎯 ${esc(d.intention)}</div>` : ""}
      ${d.win ? `<div style="margin-top:6px">🏆 ${esc(d.win)}</div>` : ""}
      ${d.note ? `<div style="margin-top:6px;white-space:pre-wrap">${esc(d.note)}</div>` : ""}
      ${d.closed_at ? "" : `<div class="hint">День не закрыт — нажмите, чтобы заполнить итоги</div>`}</a>`).join("") || `<div class="empty">Пока пусто. Вечером закройте день — здесь появится запись.</div>`}`;
}
