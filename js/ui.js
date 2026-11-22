// Мелкие помощники интерфейса.
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const rub = (n) => (Math.round(+n || 0)).toLocaleString("ru-RU") + " ₽";
export const plural = (n, a, b, c) => { const m = Math.abs(n) % 100, k = m % 10; return m > 10 && m < 20 ? c : k > 1 && k < 5 ? b : k === 1 ? a : c; };

const MON = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const WD = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
const WD2 = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
export const dt = (iso) => new Date(iso + "T12:00:00");
export const dLong = (iso) => { const d = dt(iso); return `${d.getDate()} ${MON[d.getMonth()]}, ${WD[d.getDay()]}`; };
export const dShort = (iso) => { const d = dt(iso); return `${d.getDate()} ${MON[d.getMonth()].slice(0, 3)}`; };
export const wd = (iso) => WD2[dt(iso).getDay()];
export const dRel = (iso, t) => {
  if (!iso) return "когда-нибудь";
  const n = Math.round((dt(iso) - dt(t)) / 864e5);
  return n === 0 ? "сегодня" : n === 1 ? "завтра" : n === -1 ? "вчера" : n === 2 ? "послезавтра" : dShort(iso);
};

let toastTimer;
export function toast(msg, bad = false) {
  let t = $("#toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.append(t); }
  t.textContent = msg; t.className = "show" + (bad ? " bad" : "");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.className = ""), bad ? 4500 : 2200);
}

/** Нижняя шторка. Возвращает {el, close}. */
export function sheet(html, { onClose } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "sheet-wrap";
  wrap.innerHTML = `<div class="sheet" role="dialog"><button class="x" aria-label="Закрыть" data-close>✕</button><div class="grip"></div>${html}</div>`;
  document.body.append(wrap);
  requestAnimationFrame(() => wrap.classList.add("open"));
  let closed = false;
  // Шторка всегда в видимой части экрана: когда открыта клавиатура iPhone — над ней, а не под ней
  const vv = window.visualViewport;
  const fit = () => { if (!vv) return; wrap.style.top = vv.offsetTop + "px"; wrap.style.height = vv.height + "px"; wrap.style.bottom = "auto"; wrap.classList.toggle("kb", vv.height < window.innerHeight - 120); };
  if (vv) { vv.addEventListener("resize", fit); vv.addEventListener("scroll", fit); fit(); }
  const close = () => { if (closed) return; closed = true; document.activeElement?.blur?.(); if (vv) { vv.removeEventListener("resize", fit); vv.removeEventListener("scroll", fit); } wrap.classList.remove("open"); setTimeout(() => wrap.remove(), 220); onClose && onClose(); };
  wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
  // смахнуть вниз за верхнюю часть шторки — закрыть
  const sh = wrap.firstElementChild; let y0 = null, dy = 0;
  sh.addEventListener("touchstart", (e) => { y0 = sh.scrollTop <= 0 && e.touches[0].clientY - sh.getBoundingClientRect().top < 70 ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
  sh.addEventListener("touchmove", (e) => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); sh.style.transform = `translateY(${dy}px)`; }, { passive: true });
  sh.addEventListener("touchend", () => { if (y0 == null) return; sh.style.transform = ""; if (dy > 80) close(); y0 = null; });
  const esc = (e) => { if (e.key === "Escape") { close(); removeEventListener("keydown", esc); } };
  addEventListener("keydown", esc);
  $$("[data-close]", wrap).forEach((b) => (b.onclick = close));
  return { el: $(".sheet", wrap), close };
}

export function confirmBox(text, yes = "Да") {
  return new Promise((res) => {
    const s = sheet(`<p class="lead">${esc(text)}</p><div class="row2"><button class="btn" data-close>Отмена</button><button class="btn danger" id="cy">${esc(yes)}</button></div>`, { onClose: () => res(false) });
    $("#cy", s.el).onclick = () => { res(true); s.close(); };
  });
}

/** Кнопка в состоянии «загрузка» на время промиса. */
export async function busy(btn, fn) {
  if (btn.disabled) return;
  const t = btn.innerHTML; btn.disabled = true; btn.classList.add("loading");
  try { return await fn(); } catch (e) { toast(e.message, true); } finally { btn.disabled = false; btn.classList.remove("loading"); btn.innerHTML = t; }
}

/** Шкала 1–5 с подписями-эмодзи. */
export function scale(name, val, marks) {
  return `<div class="scale" data-scale="${name}">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-v="${n}" class="${+val === n ? "on" : ""}">${marks ? marks[n - 1] : n}</button>`).join("")}</div>`;
}
export function bindScale(root, onChange) {
  $$("[data-scale]", root).forEach((s) => $$("button", s).forEach((b) => (b.onclick = () => {
    const was = b.classList.contains("on");
    $$("button", s).forEach((x) => x.classList.remove("on"));
    if (!was) b.classList.add("on");
    onChange(s.dataset.scale, was ? null : +b.dataset.v);
  })));
}

export const DICT = `<div class="hint">🎤 Можно надиктовать: микрофон на клавиатуре iPhone</div>`;

/** Ответ Claude: простой текст → абзацы и списки. */
export function aiHtml(text) {
  return esc(text).split(/\n{2,}/).map((p) => {
    const lines = p.split("\n");
    if (lines.every((l) => /^\s*[•\-–]\s/.test(l))) return `<ul>${lines.map((l) => `<li>${l.replace(/^\s*[•\-–]\s*/, "")}</li>`).join("")}</ul>`;
    return `<p>${lines.join("<br>")}</p>`;
  }).join("");
}

/* ---------- значки (линейные, как в дизайне) ---------- */
const P = {
  today: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/>',
  tasks: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  goals: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/>',
  money: '<path d="M9 20V4h5a4 4 0 0 1 0 8H7M7 16h8"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
};
export const icon = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${P[k] || ""}</svg>`;
