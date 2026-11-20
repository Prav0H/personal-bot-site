// Быстрый ввод по ссылке — для Siri и «Быстрых команд» iPhone:
//   #/add?t=task&text=Купить молоко          → задача на сегодня («завтра …» — на завтра)
//   #/add?t=idea&text=…                      → идея
//   #/add?t=expense&text=кафе 450 обед       → трата: сумма, категория по первому слову, остальное — комментарий
import { ins, today, addDays } from "./db.js";
import { toast } from "./ui.js";
import { S } from "./main.js";

export function parseExpense(text, cats) {
  const m = String(text).replace(",", ".").match(/(\d[\d\s]*(?:\.\d+)?)/);
  const amount = m ? +m[1].replace(/\s/g, "") : 0;
  const rest = String(text).replace(m ? m[0] : "", " ").replace(/\s*(руб(лей|ля|ль)?|р\.?|₽)\s*/gi, " ").replace(/\s+/g, " ").trim();
  const low = rest.toLowerCase();
  const cat = cats.find((c) => low.startsWith(c.toLowerCase().slice(0, 4))) || cats.find((c) => low.includes(c.toLowerCase())) || "Другое";
  const note = cat !== "Другое" ? rest.replace(new RegExp("^\\S*" + cat.slice(0, 4), "i"), "").trim() : rest;
  const kind = /работ|tropos|тропос|клиент/i.test(rest) ? "рабочее" : "личное";
  return { amount, category: cat, note: note.replace(/^[-—:,.\s]+/, ""), kind };
}

/** Обработать ссылку быстрого ввода. Возвращает экран, на который перейти, или null. */
export async function handleQuick() {
  const m = location.hash.match(/^#\/add\?(.*)$/);
  if (!m) return null;
  const q = new URLSearchParams(m[1]);
  const t = q.get("t") || "task", text = (q.get("text") || "").trim();
  history.replaceState(null, "", location.pathname + location.search);
  if (!text) { toast("Пустой текст — нечего записать", true); return "today"; }
  try {
    if (t === "idea") { await ins("pb_ideas", { text }); toast("💡 Идея записана"); return "ideas"; }
    if (t === "expense") {
      const e = parseExpense(text, S.set?.categories || []);
      if (!(e.amount > 0)) { toast("Не нашёл сумму в «" + text + "»", true); return "money"; }
      await ins("pb_expenses", { ...e, day: today() });
      toast(`💸 ${Math.round(e.amount).toLocaleString("ru-RU")} ₽ · ${e.category}`); return "money";
    }
    const tomorrow = /^завтра[\s,:-]+/i.test(text);
    const title = text.replace(/^(сегодня|завтра)[\s,:-]+/i, "");
    await ins("pb_tasks", { title: title.charAt(0).toUpperCase() + title.slice(1), day: tomorrow ? addDays(today(), 1) : today() });
    toast(tomorrow ? "✅ Задача на завтра" : "✅ Задача на сегодня"); return "today";
  } catch (e) { toast(e.message, true); return "today"; }
}
