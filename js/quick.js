// Быстрый ввод по ссылке (Siri, «Команды»): #/add?text=… — Кайрос сам разбирает фразу; t=task|idea|expense — подсказка типа.
import { toast } from "./ui.js";
import { parse } from "./parse.js";
import { commit, toInbox } from "./voice.js";
import { cats } from "./model.js";
import { hints } from "./assistant.js";

export function handleQuick() {
  const m = location.hash.match(/^#\/add\?(.*)$/);
  if (!m) return null;
  const q = new URLSearchParams(m[1]);
  const text = (q.get("text") || "").trim(), hint = q.get("t");
  history.replaceState(null, "", location.pathname + location.search);
  if (!text) { toast("Пустой текст — нечего записать", true); return "today"; }
  const p = parse(text, cats(), hints());
  const type = hint === "idea" ? "idea" : hint === "expense" ? "expense" : hint === "task" && p.type !== "expense" ? "task" : null;
  try {
    if (!type && !p.confident) { toInbox(p); toast("Во «Входящих» — разберёте одним касанием"); return "inbox"; }
    toast(commit(p, type || p.type));
    return { expense: "money", idea: "ideas", habit: "habits", event: "calendar" }[type || p.type] || "today";
  } catch (e) { toast(e.message, true); return "today"; }
}
