// ИИ-помощник Кайроса, шаг 1: обучение на исправлениях.
// Когда вы меняете тип фразы (задача → расход) или категорию траты, Кайрос запоминает ключевое слово
// и в следующий раз решает так же. Память — в настройках (pb_settings.learn), общая для приложения и Siri.
import { settings, setSettings } from "./store.js";

const STOP = new Set(["завтра", "сегодня", "послезавтра", "надо", "нужно", "купить", "оплатить", "сделать", "позвонить", "рублей", "тысяч", "тысячи", "для", "что", "это", "как"]);
export const hints = () => { const l = settings().learn; return l && typeof l === "object" ? { types: l.types || {}, cats: l.cats || {} } : { types: {}, cats: {} }; };

/** Главное слово фразы: первое значимое слово заголовка. */
export function keyWord(title) {
  return (String(title || "").toLowerCase().replace(/ё/g, "е").split(/[^а-яa-z0-9]+/).find((w) => w.length >= 4 && !STOP.has(w) && !/^\d+$/.test(w))) || null;
}
function save(kind, word, value) {
  if (!word) return;
  const h = hints();
  if (h[kind][word] === value) return;
  h[kind][word] = value;
  setSettings({ learn: h });
}
export const learnType = (title, type) => save("types", keyWord(title), type);
export const learnCategory = (title, cat) => save("cats", keyWord(title), cat);
export function forget(kind, word) { const h = hints(); delete h[kind][word]; setSettings({ learn: h }); }
