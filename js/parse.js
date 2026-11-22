// Разбор фразы: тип (задача / трата / идея / привычка / событие), сумма, категория, дата, время, важность.
// Работает без интернета и без Claude. Если не уверен — confident = false (тогда фраза идёт во «Входящие»).
const today = () => new Date().toLocaleDateString("en-CA");
const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };

const NUM = { "ноль": 0, "один": 1, "одна": 1, "одну": 1, "два": 2, "две": 2, "три": 3, "четыре": 4, "пять": 5, "шесть": 6, "семь": 7, "восемь": 8, "девять": 9, "десять": 10, "одиннадцать": 11, "двенадцать": 12, "тринадцать": 13, "четырнадцать": 14, "пятнадцать": 15, "шестнадцать": 16, "семнадцать": 17, "восемнадцать": 18, "девятнадцать": 19, "двадцать": 20, "тридцать": 30, "сорок": 40, "пятьдесят": 50, "шестьдесят": 60, "семьдесят": 70, "восемьдесят": 80, "девяносто": 90, "сто": 100, "двести": 200, "триста": 300, "четыреста": 400, "пятьсот": 500, "шестьсот": 600, "семьсот": 700, "восемьсот": 800, "девятьсот": 900, "полторы": 1.5, "полтора": 1.5 };
const MUL = { "тысяча": 1e3, "тысячи": 1e3, "тысяч": 1e3, "тыс": 1e3, "косарь": 1e3, "косаря": 1e3, "миллион": 1e6, "миллиона": 1e6, "миллионов": 1e6, "млн": 1e6 };

/** «сорок пять тысяч» → 45000, «4 500» → 4500, «четыре с половиной» → 4.5 (×1000 если «тысяч»). */
export function findAmount(text) {
  const t = " " + text.toLowerCase().replace(/ё/g, "е") + " ";
  const dig = t.match(/(\d[\d\s]*(?:[.,]\d+)?)\s*(к|тыс\.?|тысяч[аи]?|косар[ья]|млн|миллион[аов]*)?(?=[\s₽р.,]|руб)/);
  if (dig) { let n = +dig[1].replace(/\s/g, "").replace(",", "."); const m = dig[2]; if (m) n *= /млн|миллион/.test(m) ? 1e6 : 1e3; return { amount: n, match: dig[0] }; }
  const words = t.split(/[\s,]+/).filter(Boolean);
  let total = 0, cur = 0, used = [], seen = false, half = false, preMul = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w in MUL && !seen && words[i + 1] in NUM) { preMul = MUL[w]; used.push(w); continue; }
    if (w in NUM) { cur += NUM[w]; used.push(w); seen = true; }
    else if (w in MUL && seen) { total += (cur || 1) * MUL[w] * (half ? 1 : 1); cur = 0; used.push(w); }
    else if (seen && (w === "с" && words[i + 1] === "половиной")) { cur += 0.5; used.push(w, words[i + 1]); i++; half = true; }
    else if (seen) break;
  }
  total += cur;
  if (!seen) return null;
  if (preMul) total *= preMul;
  else if (half && total < 100) total *= 1000; // «четыре с половиной» — это 4 500
  return { amount: total, match: used.join(" ") };
}

const CAT_WORDS = [
  ["Еда", /продукт|еда|магазин|пятерочк|перекрест|ашан|вкусвилл|обед|ужин|завтрак|кофе|кафе|ресторан|доставк|пицц|суши/],
  ["Дорога", /такси|метро|бензин|заправк|парковк|автобус|поезд|электричк|каршер|самол|билет/],
  ["Жильё", /аренд|квартир|коммунал|жкх|свет|газ|ипотек|ремонт/],
  ["Связь и подписки", /связь|телефон|интернет|подписк|мобильн|яндекс плюс|icloud|spotify|netflix/],
  ["Здоровье и спорт", /спорт|зал|фитнес|трениров|врач|аптек|лекарств|анализ|стоматолог|массаж/],
  ["Покупки", /купил|покупк|одежд|обувь|техник|ozon|озон|wildberries|вайлдберриз/],
  ["Отдых", /кино|театр|концерт|отдых|бар|клуб|игр|отпуск/],
  ["Образование", /курс|книг|обучени|урок|английск|школ|репетитор/],
  ["Подарки", /подар|цвет/],
  ["В бизнес", /бизнес|tropos|тропос|реклам|сайт|домен|хостинг/],
];
export function guessCategory(text, cats = []) {
  const t = text.toLowerCase().replace(/ё/g, "е");
  const direct = cats.find((c) => t.includes(c.toLowerCase().replace(/ё/g, "е")));
  if (direct) return direct;
  const hit = CAT_WORDS.find(([, re]) => re.test(t));
  return hit && (!cats.length || cats.includes(hit[0])) ? hit[0] : "Прочее";
}

const WD = { "понедельник": 1, "вторник": 2, "среду": 3, "среда": 3, "четверг": 4, "пятницу": 5, "пятница": 5, "субботу": 6, "суббота": 6, "воскресенье": 0 };
const MON = ["январ", "феврал", "март", "апрел", "ма", "июн", "июл", "август", "сентябр", "октябр", "ноябр", "декабр"];
export function findDate(text, td = today()) {
  const t = text.toLowerCase().replace(/ё/g, "е");
  if (/послезавтра/.test(t)) return { day: addDays(td, 2), match: "послезавтра" };
  if (/завтра/.test(t)) return { day: addDays(td, 1), match: "завтра" };
  if (/сегодня|сейчас/.test(t)) return { day: td, match: "сегодня" };
  const m = t.match(/(?:до |к )?(\d{1,2})\s+(январ|феврал|марта?|апрел|мая|июн|июл|август|сентябр|октябр|ноябр|декабр)[а-я]*/);
  if (m) {
    const mi = MON.findIndex((x) => m[2].startsWith(x));
    const y = +td.slice(0, 4); let d = new Date(y, mi, +m[1]).toLocaleDateString("en-CA");
    if (d < td) d = new Date(y + 1, mi, +m[1]).toLocaleDateString("en-CA");
    return { day: d, match: m[0], deadline: /^(до|к) /.test(m[0]) };
  }
  const w = t.match(/(?:в|во|до|к) (понедельник|вторник|среду|четверг|пятницу|субботу|воскресенье)/);
  if (w) { const target = WD[w[1]]; let d = td; for (let i = 1; i <= 7; i++) { d = addDays(td, i); if (new Date(d + "T12:00:00").getDay() === target) break; } return { day: d, match: w[0] }; }
  if (/через неделю/.test(t)) return { day: addDays(td, 7), match: "через неделю" };
  if (/на этой неделе|до конца недели/.test(t)) { let d = td; while (new Date(d + "T12:00:00").getDay() !== 0) d = addDays(d, 1); return { day: d, match: "до конца недели", deadline: true }; }
  return null;
}
export function findTime(text) {
  const t = text.toLowerCase();
  const m = t.match(/(?:^|\s)в (\d{1,2})(?:[:.](\d{2}))?(?:\s*(утра|вечера|дня|часов|час|ч))?(?=\s|$|,)/);
  if (m) { let h = +m[1]; if ((m[3] === "вечера" || m[3] === "дня") && h < 12) h += 12; if (h > 23) return null; return { time: `${String(h).padStart(2, "0")}:${m[2] || "00"}`, match: m[0].trim() }; }
  const w = t.match(/в (один|два|три|четыре|пять|шесть|семь|восемь|девять|десять|одиннадцать|двенадцать)(?: (утра|вечера|дня))?/);
  if (w) { let h = NUM[w[1]]; if ((w[2] === "вечера" || w[2] === "дня") && h < 12) h += 12; return { time: `${String(h).padStart(2, "0")}:00`, match: w[0] }; }
  return null;
}

const HABIT = /кажд(ый|ое|ую) (день|утро|вечер)|ежедневно|по будням|по утрам|по вечерам|привычк|вставать в|не (есть|пить|курить)/;
const IDEA = /^(иде[яю]|мысль|а что если|можно бы|было бы круто|хочу когда-нибудь)/;
const SPEND = /потратил|заплатил|оплатил|купил|стоил|расход|трата|чек|₽|руб/;
const TASK = /^(позвонить|написать|сделать|купить|оплатить|отправить|подготовить|найти|выбрать|забрать|записаться|посчитать|собрать|встретиться|проверить|ответить|созвониться|заказать|сходить|съездить|починить|закрыть|отдать|узнать|обсудить)/;
const EVENT = /встреча|созвон|звонок|приём|прием|день рождения|свадьба|концерт|вылет|рейс/;

const KW_TYPE = { "расход|трат|потратил|заплатил|оплатил|купил": "expense", "задач|дело|надо|нужно|не забыть": "task", "иде[яю]|мысль": "idea", "привычк": "habit", "встреч|событи|созвон": "event" };
const KEYWORD = new RegExp("^(" + Object.keys(KW_TYPE).join("|") + ")[а-яё]*", "i");

/** Выученное из исправлений: слово фразы → тип или категория (пополняется, когда вы меняете тип/категорию). */
const words = (low) => low.split(/[^а-яёa-z0-9]+/).filter((w) => w.length >= 3);
function learnedType(low, hints) { if (!hints?.types) return null; for (const w of words(low)) if (hints.types[w]) return hints.types[w]; return null; }
function learnedCategory(low, hints) { if (!hints?.cats) return null; for (const w of words(low)) if (hints.cats[w]) return hints.cats[w]; return null; }

/** Главная функция разбора. hints — выученные слова (см. assistant.js). */
export function parse(raw, cats = [], hints = null) {
  const text = raw.trim().replace(/^(кайрос|кайроса|эй|слушай)[,.!\s]+/i, "").replace(/^(кстати|так|пожалуйста)[,.\s]+/i, "")
    .replace(/^(добавь|добавить|добавьте|запиши|записать|запишите|создай|создать|поставь|поставить|внеси|внести|сохрани|сохранить|запомни|отметь|занеси|напомни|напомнить)[,.\s]+(мне\s+|пожалуйста\s+|новую\s+|новый\s+|новое\s+)?/i, "")
    .replace(/^встречу(?=\s)/i, "встреча");
  const low = text.toLowerCase().replace(/ё/g, "е");
  const date = findDate(text), time = findTime(text);
  const escRe = (m) => new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  let rest = text;
  for (const m of [date?.match, time?.match]) if (m) rest = rest.replace(escRe(m), " ");
  const amount = findAmount(rest);
  const important = /важн|главн|обязательно|приоритет/.test(low), urgent = /срочно|asap|горит/.test(low);
  const remind = /напомни/.test(raw.toLowerCase());
  let type = "task", confident = false, why = "";
  const startsVerb = TASK.test(low.replace(/^(завтра|сегодня|послезавтра) /, ""));
  // Ключевое слово в начале фразы — главный признак: «расход …», «задача …», «идея …», «привычка …», «встреча …»
  const kw = low.match(KEYWORD);
  const learned = learnedType(low, hints);
  if (kw || learned) {
    type = kw ? KW_TYPE[Object.keys(KW_TYPE).find((k) => new RegExp("^(" + k + ")").test(kw[1]))] : learned;
    confident = type !== "expense" || !!(amount && amount.amount > 0);
    if (!confident) why = "расход без суммы";
  }
  else if (IDEA.test(low)) { type = "idea"; confident = true; }
  else if (HABIT.test(low)) { type = "habit"; confident = !amount; why = "похоже на привычку"; }
  else if (amount && amount.amount > 0 && !startsVerb && (SPEND.test(low) || (guessCategory(low, cats) !== "Прочее" && rest.trim().split(/\s+/).length <= 4))) { type = "expense"; confident = true; }
  else if (amount && amount.amount > 0 && startsVerb && /оплатить|заплатить|перевести/.test(low)) { type = "expense"; confident = true; why = "платёж"; }
  else if (amount && amount.amount > 0) { type = startsVerb ? "task" : "expense"; confident = false; why = startsVerb ? "задача с бюджетом?" : "похоже на трату"; }
  else if (EVENT.test(low) && time) { type = "event"; confident = true; }
  else if (startsVerb || date || time || important || urgent) { type = "task"; confident = true; }
  else { type = low.split(" ").length >= 5 ? "idea" : "task"; confident = false; why = "задача или идея?"; }
  // Заголовок без служебных слов
  let title = text;
  for (const m of [date?.match, time?.match, type === "expense" ? amount?.match : null]) if (m) title = title.replace(new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), " ");
  if (kw && type !== "event") title = title.replace(new RegExp("^\\s*" + kw[0] + "[:,.\\s—-]*", "i"), "");
  title = title.replace(/^\s*(надо|нужно|не забыть)\s+/i, "").replace(/^\s*(на|за)\s+/i, "").replace(/\s+(на|за|в)\s*$/i, "");
  if (type === "idea") title = title.replace(/^(иде[яю]|мысль)[:,\s—-]*/i, "");
  title = title.replace(/(^|\s)(срочно|важно|обязательно)(?=\s|$|[,.])/gi, " ").replace(/\s*(руб(лей|ля|ль)?|р\.|₽)\s*/gi, " ").replace(/\s+/g, " ").replace(/^[\s,—-]+|[\s,—-]+$/g, "");
  title = title.charAt(0).toUpperCase() + title.slice(1);
  const td = today();
  const day = date?.day || (type === "expense" || type === "task" ? (type === "task" && !date ? td : td) : null);
  const soon = day && (new Date(day + "T12:00:00") - new Date(td + "T12:00:00")) / 864e5 <= 2;
  const habitDays = /по будням/.test(low) ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 6, 0];
  return {
    type, confident, why, text: raw.trim(), title: title || raw.trim(),
    amount: amount?.amount || null, category: type === "expense" ? learnedCategory(low, hints) || guessCategory(low, cats) : null,
    planned: type === "expense" && date && date.day > td,
    day: date ? date.day : type === "task" ? td : type === "expense" ? td : null, deadline: !!date?.deadline,
    time: time?.time || "", important, urgent: urgent || (type === "task" && !!date && soon), remind,
    habitDays, kind: /работ|tropos|тропос|клиент/.test(low) ? "рабочее" : "личное",
  };
}

export const TYPE_LABEL = { task: "Задача", expense: "Расход", idea: "Идея", habit: "Привычка", event: "Событие" };
