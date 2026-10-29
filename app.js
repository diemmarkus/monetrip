import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, signInAnonymously, updateProfile, linkWithPopup }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, collection, query, where, onSnapshot, getDoc, setDoc, updateDoc, deleteDoc, arrayUnion, deleteField, FieldPath }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js?v=54";
import { settle, balances } from "./settle.js?v=54";
import { autoIcon, PICKS } from "./icons.js?v=54";
import { t as tr, lang, setLang, locale, decimalSep } from "./i18n.js?v=54";
import { legalDoc } from "./legal.js?v=54";

const CURRENCIES = ["EUR","USD","GBP","CHF","CZK","HUF","PLN","TRY","SEK","NOK","DKK","JPY","CAD","AUD","THB"];
const $ = (s, r = document) => r.querySelector(s);
const app = $("#app");

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
// Keep a copy of trips and expenses on the device, so reopening the app shows them instantly
// while it checks for updates in the background. Falls back to memory-only where storage is blocked.
const db = (() => {
  try { return initializeFirestore(fbApp, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); }
  catch { return getFirestore(fbApp); }
})();

let me = null;            // Firebase user
let trips = [], unsubTrips = null, tripsLoaded = false;
let cur = { id: null, trip: null, expenses: [], unsubs: [] };
let ui = { joinPick: false };
const legalHash = () => (location.hash.match(/^#(imprint|privacy)$/) || [])[1] || null;
ui.legal = legalHash();
let guestName = null;   // first name typed on the guest form, used once to join
let fx = null;            // {date, rates: {EUR:1, USD:..}}

/* ---------- helpers ---------- */
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) { if (k == null || k === false) continue; e.append(k instanceof Node ? k : document.createTextNode(String(k))); }
  return e;
}
function toast(msg, action) {
  const t = $("#toast"); t.replaceChildren(document.createTextNode(msg)); t.hidden = false; clearTimeout(toast.t);
  if (action) t.append(h("button", { class: "toast-act", onclick: () => { t.hidden = true; action.run(); } }, action.label));
  toast.t = setTimeout(() => t.hidden = true, action ? 5000 : 2400);
}
function rid(n = 12) { const a = "abcdefghijkmnpqrstuvwxyz23456789"; let s = ""; for (const x of crypto.getRandomValues(new Uint8Array(n))) s += a[x % a.length]; return s; }
function refCode() { const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = ""; for (const x of crypto.getRandomValues(new Uint8Array(6))) s += a[x % a.length]; return s; }
const fmt = (v, c) => { try { return new Intl.NumberFormat(locale(), { style: "currency", currency: c }).format(v); } catch { return v + " " + c; } };
const money = (cents, c) => fmt(cents / 100, c);
// Accepts "12,50", "12.50", "1.234,50" and "1,234.50": when both marks appear, the last one is the decimal point.
const parseNum = s => {
  let v = String(s).replace(/[\s'’]/g, ""); const c = v.lastIndexOf(","), d = v.lastIndexOf(".");
  v = c > -1 && d > -1 ? (c > d ? v.replace(/\./g, "").replace(",", ".") : v.replace(/,/g, "")) : v.replace(",", ".");
  return parseFloat(v);
};
const toInput = n => String(n).replace(".", decimalSep());
const numPh = () => "0" + decimalSep() + "00";
const isoDay = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const dayKey = e => e.date || isoDay(e.at || Date.now());
function dayLabel(key) {
  const today = isoDay(Date.now()), yest = isoDay(Date.now() - 864e5);
  if (key === today) return tr("today");
  if (key === yest) return tr("yesterday");
  const [y, m, d] = key.split("-").map(Number), dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(locale(), { weekday: "short", day: "numeric", month: "short", ...(y !== new Date().getFullYear() ? { year: "numeric" } : {}) });
}
const inviteLink = code => location.origin + location.pathname + "#join-" + code;

/* ---------- exchange rates (ECB via Frankfurter) ---------- */
async function loadRates() {
  try { const c = JSON.parse(localStorage.getItem("mt-fx") || "null"); if (c && Date.now() - c.fetched < 6 * 3600e3) { fx = c; return; } } catch {}
  for (const url of ["https://api.frankfurter.dev/v1/latest?base=EUR", "https://api.frankfurter.app/latest?from=EUR"]) {
    try {
      const r = await fetch(url); if (!r.ok) continue; const j = await r.json();
      fx = { date: j.date, rates: { ...j.rates, EUR: 1 }, fetched: Date.now() };
      try { localStorage.setItem("mt-fx", JSON.stringify(fx)); } catch {}
      return;
    } catch {}
  }
}
function autoRate(from, to) { const r = fx?.rates; if (!r || !r[from] || !r[to]) return null; return +(r[to] / r[from]).toPrecision(6); }

/* ---------- data ---------- */
function myMemberId(trip) { if (!trip || !me) return null; for (const [id, m] of Object.entries(trip.members || {})) if (m.uid === me.uid) return id; return null; }
const memberName = (trip, id) => trip.members?.[id]?.name || tr("someone");

function watchTrips() {
  unsubTrips?.();
  unsubTrips = onSnapshot(query(collection(db, "trips"), where("memberUids", "array-contains", me.uid)), { includeMetadataChanges: true }, s => {
    trips = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    // An empty answer from the device cache may just mean "not synced yet", so wait for the server before saying "no trips".
    if (trips.length || !s.metadata?.fromCache) tripsLoaded = true;
    if (!cur.id) render();
  }, () => toast(tr("err.loadTrips")));
}
function openTrip(id) {
  closeTrip(); cur.id = id; location.hash = "trip-" + id;
  cur.unsubs.push(onSnapshot(doc(db, "trips", id), s => { cur.trip = s.exists() ? { id: s.id, ...s.data() } : null; if (!cur.trip) cur.missing = true; render(); },
    () => { cur.missing = true; render(); }));
  cur.unsubs.push(onSnapshot(collection(db, "trips", id, "expenses"), s => {
    cur.expenses = s.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => dayKey(b).localeCompare(dayKey(a)) || (b.at || 0) - (a.at || 0)); render();
  }, () => {}));
  render();
}
function closeTrip() { ui.sheetOpen = false; ui.editing = null; document.documentElement.classList.remove("sheet-open"); cur.unsubs.forEach(u => u()); cur = { id: null, trip: null, expenses: [], unsubs: [] }; ui.joinPick = false; }
function goHome() { closeTrip(); history.replaceState(null, "", location.pathname); render(); }

async function createTrip(name, ccy, local, nick) {
  let code = refCode();
  for (let i = 0; i < 5 && (await getDoc(doc(db, "codes", code))).exists(); i++) code = refCode();
  const id = rid(20), mid = rid(8);
  await setDoc(doc(db, "trips", id), { name, currency: ccy, localCurrency: local, code, createdBy: me.uid, createdAt: Date.now(),
    members: { [mid]: { name: nick, uid: me.uid } }, memberUids: [me.uid], settlement: null, paid: {} });
  await setDoc(doc(db, "codes", code), { tripId: id });
  openTrip(id);
}
async function joinByCode(code) {
  code = code.toUpperCase().trim();
  const c = await getDoc(doc(db, "codes", code));
  if (!c.exists()) throw Object.assign(new Error(tr("err.noCode")), { known: true });
  const tripId = c.data().tripId;
  if (!trips.some(t => t.id === tripId)) {
    try { await updateDoc(doc(db, "trips", tripId), { memberUids: arrayUnion(me.uid) }); }
    catch { throw Object.assign(new Error(tr("err.noCodeDeleted")), { known: true }); }
  }
  openTrip(tripId);
}
async function deleteTrip(t) {
  const exps = cur.expenses.slice();
  for (const e of exps) await deleteDoc(doc(db, "trips", t.id, "expenses", e.id));
  const id = t.id; closeTrip();
  await deleteDoc(doc(db, "trips", id));
}
async function claimMember(mid) {
  const prev = myMemberId(cur.trip), upd = { [`members.${mid}.uid`]: me.uid };
  if (prev && prev !== mid) upd[`members.${prev}.uid`] = null; // switching person: free the old spot
  await updateDoc(doc(db, "trips", cur.trip.id), upd); ui.joinPick = false; render();
}
async function addMember(name, withMe) {
  const mid = rid(8);
  const prev = withMe ? myMemberId(cur.trip) : null, upd = { [`members.${mid}`]: { name, uid: withMe ? me.uid : null } };
  if (prev) upd[`members.${prev}.uid`] = null;
  await updateDoc(doc(db, "trips", cur.trip.id), upd);
  if (withMe) { ui.joinPick = false; render(); }
}

/* ---------- settle up: record a payment ---------- */
async function markPaid(t, x, btn) {
  btn.disabled = true;
  const id = rid(), now = Date.now();
  const payment = { kind: "payment", desc: "Payment", amount: x.amount / 100, currency: t.settlement.currency || t.currency, rate: 1,
    paidBy: x.from, split: [x.to], at: now, date: isoDay(now), by: myMemberId(t) };
  try {
    ui.justAdded = { id, t0: now };
    await setDoc(doc(db, "trips", t.id, "expenses", id), payment);
    // The rest of the plan still settles the remaining balances exactly, so just drop this transfer.
    const before = t.settlement;
    const rest = before.transfers.filter(y => !(y.from === x.from && y.to === x.to));
    const count = cur.expenses.filter(e => e.id !== id).length + 1;
    await updateDoc(doc(db, "trips", t.id), { settlement: rest.length ? { ...before, transfers: rest, at: Date.now(), count } : null, paid: {} });
    toast(rest.length ? tr("pay.recorded") : tr("pay.allSettled"), { label: tr("undo"), run: async () => {
      try {
        await deleteDoc(doc(db, "trips", t.id, "expenses", id));
        await updateDoc(doc(db, "trips", t.id), { settlement: { ...before, at: Date.now(), count: Math.max(0, count - 1) }, paid: {} });
        toast(tr("pay.undone"));
      } catch { toast(tr("pay.undoFailed")); }
    } });
  } catch { btn.disabled = false; toast(tr("pay.failed")); }
}

/* ---------- expense list: swipe & delete ---------- */
async function deleteExpense(t, e) {
  const { id, ...data } = e;
  if (ui.editing === id) { ui.editing = null; }
  try {
    await deleteDoc(doc(db, "trips", t.id, "expenses", id));
    toast(tr("x.deleted"), { label: tr("undo"), run: () => setDoc(doc(db, "trips", t.id, "expenses", id), data).then(() => toast(tr("x.restored"))).catch(() => toast(tr("x.restoreFailed"))) });
  } catch { toast(tr("x.deleteFailed")); render(); }
}
function attachSwipe(row, fg, { left, right }) {
  let x0 = 0, y0 = 0, dx = 0, lock = null, pid = null;
  const reset = () => { fg.style.transform = ""; row.dataset.dir = ""; };
  fg.addEventListener("pointerdown", e => { if (e.button > 0) return; x0 = e.clientX; y0 = e.clientY; dx = 0; lock = null; pid = e.pointerId; });
  fg.addEventListener("pointermove", e => {
    if (e.pointerId !== pid) return;
    const mx = e.clientX - x0, my = e.clientY - y0;
    if (!lock) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      lock = Math.abs(mx) > Math.abs(my) ? "x" : "y";
      if (lock === "x") { fg.setPointerCapture(pid); fg.classList.add("dragging"); }
    }
    if (lock !== "x") return;
    dx = mx;
    if ((dx < 0 && !left) || (dx > 0 && !right)) dx = Math.sign(dx) * Math.min(24, Math.abs(dx) / 4); // resist
    row.dataset.dir = dx < 0 ? "left" : "right";
    const th = Math.min(110, row.offsetWidth * 0.33);
    row.classList.toggle("armed", Math.abs(dx) >= th && (dx < 0 ? !!left : !!right));
    fg.style.transform = `translateX(${dx}px)`;
  });
  const end = e => {
    if (e.pointerId !== pid) return; pid = null; fg.classList.remove("dragging");
    if (lock === "x") {
      const th = Math.min(110, row.offsetWidth * 0.33);
      row.classList.remove("armed");
      if (dx <= -th && left) { fg.style.transform = `translateX(${-row.offsetWidth}px)`; row.classList.add("leaving"); setTimeout(left, 160); }
      else if (dx >= th && right) { reset(); right(); }
      else reset();
    }
    lock = null;
  };
  fg.addEventListener("pointerup", end);
  fg.addEventListener("pointercancel", e => { if (e.pointerId === pid) { pid = null; lock = null; fg.classList.remove("dragging"); row.classList.remove("armed"); reset(); } });
}

/* ---------- expense icons ---------- */
// An icon picked by hand is remembered for that description: on the trip (shared with
// everyone on it) and on this device (so it carries over to your next trip).
const iconKey = d => String(d || "").trim().toLowerCase().replace(/\s+/g, " ");
const LOCAL_ICONS = "monetrip.icons";
function localIcons() { try { return JSON.parse(localStorage.getItem(LOCAL_ICONS)) || {}; } catch { return {}; } }
function rememberIcon(t, desc, icon) {
  const k = iconKey(desc); if (!k) return;
  try { const m = localIcons(); if (icon) m[k] = icon; else delete m[k]; localStorage.setItem(LOCAL_ICONS, JSON.stringify(m)); } catch {}
  if ((t.iconMemory || {})[k] !== (icon || undefined))
    updateDoc(doc(db, "trips", t.id), new FieldPath("iconMemory", k), icon || deleteField()).catch(() => {});
}
const suggestIcon = (t, desc) => { const k = iconKey(desc); return (t?.iconMemory || {})[k] || localIcons()[k] || autoIcon(desc); };
const iconFor = (t, e) => e.icon || suggestIcon(t, e.desc);

/* ---------- expense form helpers ---------- */
function resetExpenseForm() {
  const f = app.querySelector(".xform"); if (!f) return;
  f.reset(); f.xrate.value = ""; f.xicon.value = ""; delete f.dataset.dirty;
  ui.forOpen = false; f.querySelector("#forlist").hidden = true; f.querySelector("#forbtn").setAttribute("aria-expanded", "false");
  f._resync?.(); f._syncIcon?.();
}
function openSheet() {
  ui.sheetOpen = true; syncSheet();
  const w = $("#sheet"); w?.classList.add("anim"); setTimeout(() => w?.classList.remove("anim"), 350);
  const f = app.querySelector(".xform");
  setTimeout(() => (ui.editing ? f?.xamt : f?.xdesc)?.focus({ preventScroll: true }), 60);
}
function closeSheet() {
  const wasEditing = !!ui.editing;
  ui.sheetOpen = false; ui.editing = null;
  if (wasEditing) render(); else syncSheet();
  resetExpenseForm();
  $("#fab")?.focus({ preventScroll: true });
}
function syncSheet() {
  const on = !!(ui.sheetOpen && cur.id);
  const w = $("#sheet"); if (w) w.hidden = !on;
  const fab = $("#fab"); if (fab) fab.hidden = on;
  document.documentElement.classList.toggle("sheet-open", on);
}
document.addEventListener("keydown", e => { if (e.key === "Escape" && ui.sheetOpen) closeSheet(); });

/* Keep the sheet above the on-screen keyboard: size it to the visible part of the screen. */
const vv = window.visualViewport;
function syncViewport() {
  if (!vv) return;
  const r = document.documentElement.style;
  r.setProperty("--vvh", vv.height + "px");
  r.setProperty("--vvtop", vv.offsetTop + "px");
}
vv?.addEventListener("resize", syncViewport);
vv?.addEventListener("scroll", syncViewport);
syncViewport();
// When a field in the sheet gets focus, bring it into view once the keyboard has settled.
document.addEventListener("focusin", e => {
  const el = e.target;
  if (!el.closest?.("#sheet") || !el.matches("input,select,textarea")) return;
  setTimeout(() => { if (document.activeElement === el) el.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, 320);
});
function startEdit(e) {
  ui.editing = e.id; ui.sheetOpen = true; render();
  const f = app.querySelector(".xform"); if (!f) return;
  f.xdesc.value = e.desc; f.xamt.value = toInput(e.amount);
  f.xccy.value = e.currency; f.xrate.value = toInput(e.rate || 1);
  f.xpaid.value = e.paidBy; f.xdate.value = dayKey(e); f.xicon.value = e.icon || ""; f._syncIcon?.();
  for (const cb of f.querySelectorAll("input[name=xsplit]")) cb.checked = (e.split || []).includes(cb.value);
  f.dataset.dirty = "1"; f._resync?.();
  openSheet();
}

/* ---------- views ---------- */
const firstName = () => guestName || (me?.displayName || "").split(" ")[0];
function googleSignIn() {
  const p = new GoogleAuthProvider();
  return signInWithPopup(auth, p).catch(e => { if (e.code === "auth/popup-blocked") signInWithRedirect(auth, p); else if (e.code !== "auth/popup-closed-by-user") toast(tr("auth.signInFailed")); });
}
async function saveWithGoogle() {
  try { const r = await linkWithPopup(me, new GoogleAuthProvider()); me = r.user; toast(tr("auth.saved")); render(); }
  catch (e) {
    if (e.code === "auth/credential-already-in-use") toast(tr("auth.googleInUse"));
    else if (e.code !== "auth/popup-closed-by-user") toast(tr("auth.googleFailed"));
  }
}
function langToggle() {
  const other = lang === "de" ? "en" : "de";
  return h("button", { class: "ghost lang", lang: other, title: tr("lang.switchTitle"), "aria-label": tr("lang.switchTitle"),
    onclick: () => { setLang(other); render(); } }, tr("lang.switch"));
}
function initials(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}
function avatar(size) {
  const guest = me?.isAnonymous, name = guest ? firstName() : (me?.displayName || me?.email || "");
  if (me?.photoURL && !guest) return h("img", { class: "avatar", src: me.photoURL, alt: "", width: size, height: size, referrerpolicy: "no-referrer" });
  return h("span", { class: "avatar" + (guest ? " guest" : ""), "aria-hidden": "true", text: initials(name) });
}
/* ---------- theme: system (default), light or dark ---------- */
function getTheme() { try { return localStorage.getItem("mt-theme") || "system"; } catch { return "system"; } }
function applyTheme(v) {
  const root = document.documentElement;
  if (v === "light" || v === "dark") root.dataset.theme = v; else delete root.dataset.theme;
  const bg = getComputedStyle(document.body).backgroundColor;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg || "#34e5eb");
}
function setTheme(v) { try { v === "system" ? localStorage.removeItem("mt-theme") : localStorage.setItem("mt-theme", v); } catch {} applyTheme(v); }
function themePicker() {
  // Until you pick one, the phone's own setting decides; the switch shows which one is in use.
  const chosen = getTheme(), cur = chosen === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : chosen;
  return h("div", { class: "menu-row" }, h("span", { class: "menu-lbl", id: "themelbl", text: tr("theme.label") }),
    h("div", { class: "seg", role: "radiogroup", "aria-labelledby": "themelbl" },
      ["light", "dark"].map(v => h("button", { type: "button", role: "radio", "aria-checked": String(cur === v),
        onclick: ev => { setTheme(v); for (const b of ev.currentTarget.parentNode.children) b.setAttribute("aria-checked", String(b === ev.currentTarget)); } }, tr("theme." + v)))));
}
applyTheme(getTheme());
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => applyTheme(getTheme()));

function closeMenu() { if (!ui.menuOpen) return; ui.menuOpen = false; const m = $("#acctmenu"); if (m) m.hidden = true; $("#acctbtn")?.setAttribute("aria-expanded", "false"); }
document.addEventListener("click", e => { if (ui.menuOpen && !e.target.closest?.(".acct")) closeMenu(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && ui.menuOpen) { closeMenu(); $("#acctbtn")?.focus(); } });
function brand() {
  const guest = me?.isAnonymous;
  const other = lang === "de" ? "en" : "de";
  let right;
  if (!me) right = h("span", { class: "who" }, langToggle());
  else {
    const signOutBtn = h("button", { class: "menu-item", role: "menuitem", onclick: ev => {
      const b = ev.currentTarget;
      if (guest && !b.dataset.sure) { b.dataset.sure = "1"; b.textContent = tr("auth.signOutSure"); b.classList.add("danger-text"); return; }
      closeMenu(); closeTrip(); signOut(auth);
    } }, tr("auth.signOut"));
    const menu = h("div", { class: "menu", id: "acctmenu", role: "menu", hidden: !ui.menuOpen },
      h("div", { class: "menu-head" }, avatar(40),
        h("div", { class: "menu-who" },
          h("b", { text: guest ? (firstName() || tr("auth.guest")) : (me.displayName || "") }),
          h("span", { text: guest ? tr("auth.guest") : (me.email || "") }))),
      guest ? h("button", { class: "menu-item strong", role: "menuitem", onclick: () => { closeMenu(); saveWithGoogle(); } }, tr("auth.signInGoogle")) : null,
      h("button", { class: "menu-item", role: "menuitem", lang: other, onclick: () => { setLang(other); render(); } }, other === "de" ? "Deutsch" : "English"),
      themePicker(),
      signOutBtn);
    right = h("div", { class: "acct" },
      h("button", { class: "avatar-btn", id: "acctbtn", "aria-haspopup": "menu", "aria-controls": "acctmenu", "aria-expanded": String(!!ui.menuOpen),
        "aria-label": guest ? `${firstName() || tr("auth.guest")} (${tr("auth.guest")})` : (me.displayName || me.email || "Account"),
        onclick: () => { ui.menuOpen = !ui.menuOpen; menu.hidden = !ui.menuOpen; $("#acctbtn").setAttribute("aria-expanded", String(ui.menuOpen)); } },
        avatar(36)),
      menu);
  }
  return h("div", { class: "brand" }, h("div", { class: "top" },
    h("div", { class: "id" }, h("span", { class: "logo", "aria-hidden": "true" }),
      h("div", { class: "words" }, h("span", { class: "name", text: "MoneTrip" }),
        h("span", { class: "tag", text: tr("brand.tag") }))),
    right));
}

/* ---------- imprint & privacy ---------- */
function legalView(kind) {
  const d = legalDoc(kind, lang);
  const back = h("button", { class: "back", onclick: () => {
    if (ui.legalFromApp) history.back();
    else { history.replaceState(null, "", location.pathname); ui.legal = null; render(); }
  } }, tr("legal.back"));
  return [brand(), back, h("article", { class: "panel legal" }, h("h1", { text: d.title }),
    d.sections.flatMap(sec => [sec.h ? h("h2", { text: sec.h }) : null, ...sec.p.map(x => h("p", { text: x }))]))];
}
function legalFooter() {
  return h("footer", { class: "legal-links" },
    h("a", { href: "#imprint" }, tr("legal.imprint")), h("span", { "aria-hidden": "true", text: " · " }), h("a", { href: "#privacy" }, tr("legal.privacy")));
}
addEventListener("hashchange", () => {
  const l = legalHash();
  if (l === ui.legal) return;
  ui.legalFromApp = !!l; ui.legal = l; render(); if (l) scrollTo(0, 0);
});
function render() {
  const ae = document.activeElement?.id, saved = {}, sheetScroll = $("#sheet .xform")?.scrollTop || 0;
  // The expense form keeps its values across redraws only once someone has touched it;
  // an untouched form is rebuilt from fresh defaults (last split / payer, which depend on loaded expenses).
  const oldX = app.querySelector(".xform"), keepX = oldX?.dataset.dirty === "1";
  for (const el of app.querySelectorAll("input[id],select[id]")) if (keepX || !oldX?.contains(el)) saved[el.id] = el.type === "checkbox" ? el.checked : el.value;
  app.replaceChildren(...(ui.legal ? legalView(ui.legal) : !me ? signInView() : cur.id ? tripView() : homeView()), legalFooter());
  const sp = document.getElementById("splash");
  if (sp && !sp.classList.contains("done")) { sp.classList.add("done"); setTimeout(() => sp.remove(), 400); }
  for (const [id, v] of Object.entries(saved)) { const el = document.getElementById(id); if (!el) continue; if (el.type === "checkbox") el.checked = v; else el.value = v; }
  if (keepX) { const nx = app.querySelector(".xform"); if (nx) nx.dataset.dirty = "1"; }
  app.querySelector(".xform")?._resync?.();
  syncSheet();
  if (sheetScroll) { const sf = $("#sheet .xform"); if (sf) sf.scrollTop = sheetScroll; }
  app.querySelector(".xform")?._syncIcon?.();
  if (ae) document.getElementById(ae)?.focus();
}
function signInView() {
  const code = (location.hash.match(/^#join-([A-Za-z0-9]{6})$/) || [])[1];
  const gerr = h("p", { class: "err", hidden: true });
  const guest = h("form", { class: "panel", onsubmit: async e => {
      e.preventDefault(); const f = e.target, name = f.gfirst.value.trim(), c = (code || f.gcode.value).toUpperCase().trim();
      if (!name || c.length !== 6) { gerr.hidden = false; gerr.textContent = !name ? tr("signin.needName") : tr("signin.needCode"); return; }
      f.querySelector("button[type=submit]").disabled = true;
      guestName = name; if (!code) location.hash = "join-" + c;
      try { const r = await signInAnonymously(auth); await updateProfile(r.user, { displayName: name }); }
      catch (x) {
        guestName = null; gerr.hidden = false; f.querySelector("button[type=submit]").disabled = false;
        gerr.textContent = ["auth/operation-not-allowed", "auth/admin-restricted-operation"].includes(x.code)
          ? tr("signin.guestOff")
          : x.code === "auth/network-request-failed" ? tr("signin.offline")
          : tr("signin.guestFailed", { code: x.code || tr("signin.unknownError") });
      }
    } },
    h("h2", { text: code ? tr("signin.joinAsGuest") : tr("signin.gotCode") }),
    h("p", { class: "muted", text: tr("signin.justName") }),
    h("div", { class: "row" },
      h("label", { class: "grow" }, tr("signin.firstName"), h("input", { id: "gfirst", name: "gfirst", required: true, maxlength: 30, autocomplete: "given-name", placeholder: tr("signin.namePh") })),
      code ? null : h("label", { style: "flex:0 1 140px" }, tr("tripCode"), h("input", { id: "gcode", name: "gcode", maxlength: 6, required: true, autocapitalize: "characters", placeholder: tr("codePh"), style: "font-family:var(--mono);letter-spacing:.15em;text-transform:uppercase" })),
      h("button", { class: "primary", type: "submit" }, tr("joinTrip"))), gerr);
  const google = h("div", { class: "panel signin" },
    h("h2", { text: code ? tr("signin.orGoogle") : tr("signin.startOwn") }),
    h("p", { class: "muted", text: code ? tr("signin.anyDevice") : tr("signin.signInToCreate") }),
    h("button", { class: code ? "gbtn" : "primary gbtn", onclick: googleSignIn }, tr("auth.signInGoogle")));
  return [brand(),
    h("div", { class: "panel signin" },
      h("h1", { text: code ? tr("signin.invited") : tr("signin.headline") }),
      h("p", { class: "muted", text: tr("signin.pitch") })),
    ...(code ? [guest, google] : [google, guest])];
}
function homeView() {
  const err = h("p", { class: "err", hidden: true });
  let home = "EUR"; try { home = localStorage.getItem("mt-home") || "EUR"; } catch {}
  const ccySelect = (id, sel) => h("select", { id, name: id }, CURRENCIES.map(c => h("option", { value: c, selected: c === sel }, c)));
  const createForm = h("form", { class: "panel xform", onsubmit: async e => {
      e.preventDefault(); const f = e.target, name = f.tname.value.trim(), nick = f.tnick.value.trim(); if (!name || !nick) return;
      const btn = f.querySelector("button[type=submit]"); btn.disabled = true;
      try { localStorage.setItem("mt-home", f.thome.value); } catch {}
      try { await createTrip(name, f.thome.value, f.tlocal.value, nick); } catch { err.hidden = false; err.textContent = tr("home.createFailed"); btn.disabled = false; }
    } },
    h("h2", { text: tr("home.newTrip") }),
    h("label", {}, tr("home.tripName"), h("input", { id: "tname", name: "tname", placeholder: tr("home.tripNamePh"), required: true, maxlength: 60 })),
    h("div", { class: "pair" },
      h("label", {}, tr("home.homeCcy"), ccySelect("thome", home), h("span", { class: "hint", text: tr("home.homeCcyHint") })),
      h("label", {}, tr("home.tripCcy"), ccySelect("tlocal", home), h("span", { class: "hint", text: tr("home.tripCcyHint") }))),
    h("label", {}, tr("home.yourName"), h("input", { id: "tnick", name: "tnick", value: firstName(), required: true, maxlength: 30 })),
    err,
    h("button", { class: "primary", type: "submit" }, tr("home.create")));
  const jerr = h("p", { class: "err", hidden: true });
  const joinForm = h("form", { class: "panel", onsubmit: async e => {
      e.preventDefault();
      try { jerr.hidden = true; await joinByCode(e.target.jcode.value); } catch (x) { jerr.hidden = false; jerr.textContent = x.known ? x.message : tr("err.join"); }
    } },
    h("h2", { text: tr("home.joinTitle") }),
    h("p", { class: "muted", text: tr("home.joinHint") }),
    h("div", { class: "row" },
      h("label", { class: "grow" }, tr("tripCode"), h("input", { id: "jcode", name: "jcode", placeholder: tr("codePh"), maxlength: 6, required: true, autocapitalize: "characters", style: "font-family:var(--mono);letter-spacing:.2em;text-transform:uppercase" })),
      h("button", { type: "submit" }, tr("joinTrip"))), jerr);
  const list = trips.length ? h("div", { class: "trips" }, trips.map(t => {
      const n = Object.keys(t.members || {}).length;
      return h("button", { class: "trip", onclick: () => openTrip(t.id) },
        h("span", {}, h("strong", { text: t.name }), h("br"), h("span", { class: "muted", text: `${tr("people", { n })} · ${t.localCurrency && t.localCurrency !== t.currency ? t.localCurrency + " → " : ""}${t.currency}${t.settlement ? tr("home.settled") : ""}` })),
        h("span", { class: "code", text: t.code }));
    }))
    : h("div", { class: "empty", text: tripsLoaded ? tr("home.empty") : tr("loading") });
  const guestNote = h("div", { class: "panel" },
    h("h2", { text: tr("signin.startOwn") }),
    h("p", { class: "muted", text: tr("home.guestNote") }),
    h("button", { class: "primary", style: "align-self:flex-start", onclick: saveWithGoogle }, tr("auth.saveWithGoogle")));
  return [brand(), h("h1", { text: tr("home.yourTrips") }), list, me.isAnonymous ? guestNote : createForm, joinForm];
}

function tripView() {
  const t = cur.trip, back = h("button", { class: "back", onclick: goHome }, tr("trip.allTrips"));
  if (!t) return [brand(), back, h("div", { class: "panel" }, h("p", { class: "muted", text: cur.missing ? tr("trip.missing") : tr("trip.loading") }))];
  const mine = myMemberId(t), ccy = t.currency, ids = Object.keys(t.members || {});
  const { bal, paid, share } = balances(t.members, cur.expenses);
  const spends = cur.expenses.filter(e => e.kind !== "payment");
  const total = spends.reduce((s, e) => s + Math.round(e.amount * (e.rate || 1) * 100), 0);
  const out = [brand(), back];

  const isAdmin = t.createdBy === me.uid;
  const pencil = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  const titleBlock = isAdmin && ui.renaming === t.id
    ? h("form", { class: "rename", onsubmit: async e => {
        e.preventDefault(); const n = e.target.rname.value.trim();
        if (!n || n === t.name) { ui.renaming = null; render(); return; }
        e.target.querySelector("button").disabled = true;
        try { await updateDoc(doc(db, "trips", t.id), { name: n }); ui.renaming = null; render(); toast(tr("trip.renamed")); }
        catch { e.target.querySelector("button").disabled = false; toast(tr("trip.renameFailed")); }
      } },
        h("input", { id: "rname", name: "rname", value: t.name, maxlength: 60, required: true, "aria-label": tr("home.tripName"),
          onkeydown: e => { if (e.key === "Escape") { ui.renaming = null; render(); } } }),
        h("div", { class: "rename-actions" },
          h("button", { type: "submit", class: "on-accent" }, tr("save")),
          h("button", { type: "button", class: "ghost on-accent", onclick: () => { ui.renaming = null; render(); } }, tr("cancel"))))
    : h("div", { class: "title-row" }, h("h1", { text: t.name }),
        isAdmin ? h("button", { class: "icon-btn", title: tr("trip.rename"), "aria-label": tr("trip.rename"),
          onclick: () => { ui.renaming = t.id; render(); const i = document.getElementById("rname"); i.value = t.name; i.focus(); i.select(); } }) : null);
  if (isAdmin && ui.renaming !== t.id) titleBlock.querySelector(".icon-btn").innerHTML = pencil;

  out.push(h("div", { class: "ticket" },
    h("div", { style: "min-width:0" }, h("div", { class: "lbl", text: tr("trip.label") }), titleBlock),
    h("div", { style: "text-align:right" }, h("div", { class: "lbl", text: tr("tripCode") }), h("div", { class: "ref", text: t.code })),
    h("div", { class: "meta" }, h("span", {}, tr("trip.total"), h("b", { class: "num", text: money(total, ccy) })), h("span", {}, tr("people", { n: ids.length })), h("span", {}, tr("expenses", { n: spends.length })), h("span", {}, (t.localCurrency && t.localCurrency !== ccy ? tr("trip.payingIn", { c: t.localCurrency }) : "") + tr("trip.settlesIn", { c: ccy })))));

  if (!mine && guestName && !cur.autoJoined) {
    cur.autoJoined = true; const n = guestName;
    const match = ids.find(id => !t.members[id].uid && t.members[id].name.trim().toLowerCase() === n.toLowerCase());
    (match ? claimMember(match) : addMember(n, true)).then(() => toast(tr("trip.welcome", { name: n }))).catch(() => { cur.autoJoined = false; toast(tr("trip.addFailed")); });
    return [...out, h("div", { class: "panel" }, h("p", { class: "muted", text: tr("trip.adding") }))];
  }
  // "Which one are you?": at the top for someone not on the trip yet; inside People when switching.
  const whoPicker = () => {
    const free = ids.filter(id => !t.members[id].uid);
    const nf = h("form", { class: "row", onsubmit: async e => { e.preventDefault(); const n = e.target.jn.value.trim(); if (n) await addMember(n, true); } },
      h("label", { class: "grow" }, tr("trip.joinNew"), h("input", { id: "jn", name: "jn", value: mine ? "" : firstName(), required: true, maxlength: 30 })),
      h("button", { class: "primary", type: "submit" }, tr("trip.join")));
    return h("div", { class: mine ? "switcher" : "panel", id: "whopick" }, mine ? h("h3", { text: tr("trip.whoAreYou") }) : h("h2", { text: tr("trip.whoAreYou") }),
      free.length ? h("div", { class: "chips" }, free.map(id => h("button", { onclick: () => claimMember(id) }, tr("trip.imName", { name: t.members[id].name })))) : null, nf,
      mine ? h("button", { class: "ghost", style: "align-self:flex-start", onclick: () => { ui.joinPick = false; render(); } }, tr("cancel")) : null);
  };
  if (!mine) { out.push(whoPicker()); return out; }

  /* settlement */
  const s = t.settlement;
  if (s) {
    const stale = cur.expenses.some(e => (e.changed || e.at || 0) > s.at) || s.count !== cur.expenses.length;
    const minePay = s.transfers.filter(x => x.from === mine || x.to === mine), others = s.transfers.filter(x => !(x.from === mine || x.to === mine));
    const row = x => {
      const isMine = x.from === mine || x.to === mine;
      const label = x.from === mine ? [tr("pay.youPay"), h("b", { text: memberName(t, x.to) })] : x.to === mine ? [h("b", { text: memberName(t, x.from) }), tr("pay.paysYou")] : [h("b", { text: memberName(t, x.from) }), h("span", { class: "arrow" }, " → "), h("b", { text: memberName(t, x.to) })];
      return h("div", { class: "pay" + (isMine ? " mine" : "") }, h("span", {}, label), h("span", { class: "num", text: money(x.amount, s.currency || ccy) }),
        h("button", { onclick: ev => markPaid(t, x, ev.currentTarget) }, tr("pay.markPaid")));
    };
    out.push(h("div", { class: "panel" },
      h("div", { class: "top" }, h("h2", { text: tr("pay.title") }),
        h("span", { class: "head-right" },
          h("span", { class: "muted", text: tr("pay.left", { n: s.transfers.length }) }),
          h("button", { class: "icon-btn close-btn", title: tr("pay.close"), "aria-label": tr("pay.close"), onclick: async ev => {
            // Hide straight away and save, without a confirmation toast.
            const panel = ev.currentTarget.closest(".panel");
            panel.hidden = true;
            try { await updateDoc(doc(db, "trips", t.id), { settlement: null }); }
            catch { panel.hidden = false; toast(tr("pay.closeFailed")); }
          } }, "✕"))),
      stale ? h("p", { class: "notice", text: tr("pay.stale") }) : null,
      s.transfers.length ? h("p", { class: "muted small", text: tr("pay.howItWorks") }) : null,
      !s.transfers.length ? h("p", { class: "muted", text: tr("pay.allEven") }) : null,
      minePay.length ? h("h3", { text: tr("pay.yourList") }) : s.transfers.length ? h("p", { class: "muted", text: tr("pay.youEven") }) : null,
      minePay.map(row), others.length ? h("h3", { text: tr("pay.others") }) : null, others.map(row)));
  }

  /* balances */
  const maxAbs = Math.max(1, ...ids.map(id => Math.abs(bal[id])));
  out.push(h("div", { class: "panel" },
    h("div", { class: "top" }, tr("bal.title") ? h("h2", { text: tr("bal.title") }) : null,
      h("button", { class: "primary", disabled: !cur.expenses.length, onclick: async ev => {
        ev.target.disabled = true; const transfers = settle(bal);
        try { await updateDoc(doc(db, "trips", t.id), { settlement: { at: Date.now(), by: mine, currency: ccy, count: cur.expenses.length, transfers }, paid: {} });
          toast(transfers.length ? tr("bal.done", { n: transfers.length }) : tr("bal.alreadyEven")); }
        catch { toast(tr("bal.saveFailed")); ev.target.disabled = false; }
      } }, s ? tr("bal.settleAgain") : tr("bal.settle"))),
    h("div", { class: "list" }, [...ids].sort((a, b) => memberName(t, a).localeCompare(memberName(t, b), locale(), { sensitivity: "base" })).map(id => {
      const b = bal[id];
      return h("div", { class: "li" },
        h("span", {}, h("b", { text: memberName(t, id) }), id === mine ? h("span", { class: "muted", text: tr("youSuffix") }) : null),
        h("span", { class: "num " + (b > 0 ? "pos" : b < 0 ? "neg" : "muted"), text: (b > 0 ? "+" : "") + money(b, ccy) }),
        h("span", { class: "sub", text: tr("bal.paidShare", { paid: money(paid[id], ccy), share: money(share[id], ccy) }) }),
        h("div", { class: "bar" }, h("i", { style: `width:${Math.abs(b) / maxAbs * 100}%;background:var(${b >= 0 ? "--bar-pos" : "--bar-neg"})` })));
    }))));

  /* add expense */
  const xerr = h("p", { class: "err", hidden: true });
  const rateNote = h("span", { class: "fx-conv" });
  const manualNote = h("p", { class: "fx-info", hidden: true, text: tr("x.noRate") });
  const rateBox = h("div", { class: "fx", hidden: true },
    h("div", { class: "fx-row" },
      h("label", { class: "fx-line", for: "xrate" }, h("span", { id: "fxfrom" }), h("input", { id: "xrate", name: "xrate", inputmode: "decimal", placeholder: numPh(), "aria-label": tr("x.rate") }), h("span", { text: ccy })),
      rateNote),
    manualNote);
  const preview = f => {
    const c = f.xccy.value; if (c === ccy) return;
    const amt = parseNum(f.xamt.value), r = parseNum(f.xrate.value);
    rateNote.textContent = amt > 0 && r > 0 ? "≈ " + money(Math.round(amt * r * 100), ccy) : "";
    manualNote.hidden = !!autoRate(c, ccy);
  };
  const syncRate = f => {
    const c = f.xccy.value; rateBox.hidden = c === ccy; f.xrate.required = c !== ccy;
    $("#fxfrom", rateBox).textContent = "1 " + c + " =";
    const a = c === ccy ? null : autoRate(c, ccy);
    f.dataset.auto = a ? "1" : "";
    f.xrate.value = a ? toInput(a) : "";
    preview(f);
  };
  const editing = ui.editing ? cur.expenses.find(x => x.id === ui.editing) : null;
  // Tick the same people as in this person's own most recent expense; everyone if they haven't added one yet.
  const lastOwn = cur.expenses.filter(x => x.by === mine && x.kind !== "payment").reduce((best, x) => !best || (x.at || 0) > (best.at || 0) ? x : best, null);
  const lastSplit = (lastOwn?.split || []).filter(id => ids.includes(id));
  const defaultSplit = new Set(lastSplit.length ? lastSplit : ids);
  // Paid by: whoever paid in this person's own last expense, else themselves.
  const defaultPaid = lastOwn && ids.includes(lastOwn.paidBy) ? lastOwn.paidBy : mine;
  const byName = ids.slice().sort((a, b) => memberName(t, a).localeCompare(memberName(t, b), locale(), { sensitivity: "base" }));
  if (ui.editing && !editing && cur.expenses.length) ui.editing = null;
  const iconBtn = h("button", { type: "button", class: "icon-pick", "aria-label": tr("x.chooseIcon"), "aria-expanded": "false",
    onclick: () => { picks.hidden = !picks.hidden; iconBtn.setAttribute("aria-expanded", String(!picks.hidden)); } });
  const pick = ic => { form.xicon.value = ic; form.dataset.dirty = "1"; picks.hidden = true; iconBtn.setAttribute("aria-expanded", "false"); form._syncIcon(); };
  const firstEmoji = v => { for (const { segment } of new Intl.Segmenter().segment(v)) if (/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(segment)) return segment; return ""; };
  const picks = h("div", { class: "picks", hidden: true, role: "group", "aria-label": tr("x.icons") },
    h("input", { class: "emoji-in", placeholder: tr("x.emojiPh"), "aria-label": tr("x.emoji"), autocomplete: "off", enterkeyhint: "done",
      oninput: e => { const em = firstEmoji(e.target.value); if (em) { e.target.value = ""; pick(em); } },
      onkeydown: e => { if (e.key === "Enter") e.preventDefault(); } }),
    PICKS.map(ic => h("button", { type: "button", onclick: () => pick(ic) }, ic)),
    h("button", { type: "button", class: "auto", onclick: () => pick("") }, tr("auto")));
  const form = h("form", { class: "panel xform", oninput: e => { e.currentTarget.dataset.dirty = "1"; if (e.target.id === "xrate") e.currentTarget.dataset.auto = ""; if (e.target.id === "xdesc") form._syncIcon(); if (e.target.name === "xsplit") form._syncFor(); preview(e.currentTarget); }, onsubmit: async e => {
      e.preventDefault(); const f = e.target; xerr.hidden = true;
      const amount = parseNum(f.xamt.value), c = f.xccy.value, rate = c === ccy ? 1 : parseNum(f.xrate.value);
      const split = [...f.querySelectorAll("input[name=xsplit]:checked")].map(i => i.value);
      const bad = !f.xdesc.value.trim() ? tr("x.needDesc") : !(amount > 0) ? tr("x.needAmount") : !(rate > 0) ? tr("x.needRate", { ccy, c }) : !split.length ? tr("x.needSplit") : null;
      if (bad) { xerr.hidden = false; xerr.textContent = bad; return; }
      const btn = f.querySelector("button[type=submit]"); btn.disabled = true;
      const data = { desc: f.xdesc.value.trim(), icon: f.xicon.value, amount, currency: c, rate, paidBy: f.xpaid.value, split, date: f.xdate.value || isoDay(Date.now()) };
      if (data.icon !== (editing?.icon || "")) rememberIcon(t, data.desc, data.icon);
      try {
        if (editing) { await updateDoc(doc(db, "trips", t.id, "expenses", editing.id), { ...data, changed: Date.now() }); closeSheet(); toast(tr("x.updated")); }
        else {
          const newId = rid(); ui.justAdded = { id: newId, t0: Date.now() };
          // Hide the sheet right away so the new row's fold-in animation is visible; keep the values until the save succeeds.
          ui.sheetOpen = false; syncSheet();
          try { await setDoc(doc(db, "trips", t.id, "expenses", newId), { ...data, at: Date.now(), by: mine }); }
          catch (err) { ui.justAdded = null; openSheet(); throw err; }
          resetExpenseForm(); $("#fab")?.focus({ preventScroll: true }); toast(tr("x.added"));
        }
      }
      catch { xerr.hidden = false; xerr.textContent = tr("x.saveFailed"); toast(tr("x.saveFailed")); }
      btn.disabled = false;
    } },
    // Close, title and the save button live in the pinned header, so saving is always on screen (even above the keyboard).
    h("div", { class: "sheet-head" },
      h("button", { type: "button", class: "icon-btn close-btn", "aria-label": tr("close"), onclick: closeSheet }, "✕"),
      h("h2", { id: "sheettitle", text: editing ? tr("x.editTitle") : tr("x.addTitle") }),
      h("button", { class: "primary head-save", type: "submit" }, editing ? tr("x.saveShort") : tr("x.addShort"))),
    xerr,
    h("div", { class: "field" }, h("label", { for: "xdesc", text: tr("x.whatFor") }),
      h("div", { class: "desc-row" }, iconBtn, h("input", { id: "xdesc", name: "xdesc", placeholder: tr("x.descPh"), maxlength: 80, autocomplete: "off" }),
        h("input", { type: "hidden", id: "xicon", name: "xicon", value: "" })),
      picks),
    h("label", {}, tr("x.amount"),
      h("span", { class: "money" },
        h("input", { id: "xamt", name: "xamt", inputmode: "decimal", placeholder: numPh(), autocomplete: "off" }),
        h("select", { id: "xccy", name: "xccy", "aria-label": tr("x.currency"), onchange: e => syncRate(e.target.form) }, CURRENCIES.map(c => h("option", { value: c, selected: c === (t.localCurrency || ccy) }, c))))),
    rateBox,
    h("div", { class: "pair" },
      h("label", {}, tr("x.paidBy"), h("select", { id: "xpaid", name: "xpaid" }, byName.map(id => h("option", { value: id, selected: id === defaultPaid }, memberName(t, id) + (id === mine ? tr("youSuffix") : ""))))),
      h("label", {}, tr("x.date"), h("input", { id: "xdate", name: "xdate", type: "date", value: isoDay(Date.now()), max: isoDay(Date.now() + 864e5 * 366) }))),
    h("div", { class: "forfield" },
      h("span", { class: "flabel", id: "forlbl", text: tr("x.for") }),
      h("button", { type: "button", class: "forbtn", id: "forbtn", "aria-labelledby": "forlbl forsum", "aria-controls": "forlist", "aria-expanded": String(!!ui.forOpen),
        onclick: ev => { ui.forOpen = !ui.forOpen; const b = ev.currentTarget; b.setAttribute("aria-expanded", String(ui.forOpen)); b.form.querySelector("#forlist").hidden = !ui.forOpen; } },
        h("span", { id: "forsum" }), h("span", { class: "chev", "aria-hidden": "true" })),
      h("div", { class: "checks", id: "forlist", role: "group", "aria-label": tr("x.splitBetween"), hidden: !ui.forOpen },
        byName.map(id => h("label", {}, h("input", { type: "checkbox", name: "xsplit", value: id, checked: defaultSplit.has(id), id: "xs-" + id }), memberName(t, id))))),
  );
  if (editing) form.classList.add("editing");
  form._syncIcon = () => {
    const own = form.xicon.value;
    iconBtn.textContent = own || suggestIcon(t, form.xdesc.value);
    iconBtn.classList.toggle("set", !!own);
    for (const b of picks.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.classList.contains("auto") ? !own : b.textContent === own));
  };
  form._syncIcon();
  form._syncFor = () => {
    const on = [...form.querySelectorAll("input[name=xsplit]")].filter(c => c.checked).map(c => c.value);
    const names = on.map(id => id === mine ? tr("you") : memberName(t, id));
    const list = names.length <= 3 ? names.join(", ") : names.slice(0, 2).join(", ") + ` +${names.length - 2}`;
    $("#forsum", form).textContent = !on.length ? tr("x.nobody")
      : on.length === ids.length ? (ids.length > 1 ? tr("x.everyone", { n: ids.length }) : tr("x.justYou"))
      : on[0] === mine ? list.charAt(0).toLocaleUpperCase(locale()) + list.slice(1) : list;
  };
  form._resync = () => {
    form._syncFor();
    const c = form.xccy.value; rateBox.hidden = c === ccy; form.xrate.required = c !== ccy;
    $("#fxfrom", rateBox).textContent = "1 " + c + " =";
    const a = c === ccy ? null : autoRate(c, ccy);
    if (a && !form.xrate.value) form.xrate.value = toInput(a);
    form.dataset.auto = a && parseNum(form.xrate.value) === a ? "1" : "";
    preview(form);
  };
  form.classList.add("sheet");
  out.push(h("div", { class: "sheet-wrap", id: "sheet", hidden: !ui.sheetOpen, role: "dialog", "aria-modal": "true", "aria-labelledby": "sheettitle",
      onclick: e => { if (e.target === e.currentTarget) closeSheet(); } }, form),
    h("button", { class: "fab", id: "fab", "aria-label": tr("x.add"), title: tr("x.add"), hidden: !!ui.sheetOpen, onclick: openSheet }, h("span", { "aria-hidden": "true", text: "+" })));

  /* expenses */
  const hasOwn = cur.expenses.some(e => e.by === mine && e.kind !== "payment");
  out.push(h("div", { class: "panel" },
    h("div", { class: "top" }, h("h2", { text: tr("list.title") }),
      cur.expenses.length ? h("span", { class: "hint", text: hasOwn ? tr("list.swipeBoth") : tr("list.swipeDel") }) : null),
    cur.expenses.length ? h("div", { class: "list" }, cur.expenses.flatMap((e, i) => {
      const base = Math.round(e.amount * (e.rate || 1) * 100), isPay = e.kind === "payment", own = e.by === mine && !isPay;
      const fg = h("div", { class: "li xp" + (isPay ? " payment" : "") + (ui.editing === e.id ? " is-editing" : ""), tabindex: 0,
          "aria-label": `${e.desc}, ${fmt(e.amount, e.currency)}. ${own ? tr("list.ariaEdit") : ""}${tr("list.ariaDel")}`,
          onkeydown: ev => { if (own && ev.key.toLowerCase() === "e") startEdit(e); else if (ev.key === "Delete") deleteExpense(t, e); } },
        h("span", { class: "xi", "aria-hidden": "true", text: isPay ? "💸" : iconFor(t, e) }),
        h("b", { text: isPay ? `${memberName(t, e.paidBy)} → ${memberName(t, e.split[0])}` : e.desc }),
        h("span", { class: "act" }, h("span", { class: "num", text: fmt(e.amount, e.currency) })),
        h("span", { class: "sub", text: isPay ? tr("list.paymentSub") : tr("list.paidSplit", { name: memberName(t, e.paidBy), n: e.split.length }) + (e.currency !== ccy ? tr("list.converted", { amount: money(base, ccy), rate: (e.rate || 1).toLocaleString(locale(), { maximumFractionDigits: 6 }) }) : "") }));
      // A just-added expense folds into the list. Live updates can redraw the list mid-animation,
      // so resume it where it was with a negative delay instead of restarting.
      const ja = ui.justAdded, age = ja && ja.id === e.id ? Date.now() - ja.t0 : Infinity;
      const row = h("div", { class: "swipe" + (age < 900 ? " entering" : ""), style: age < 900 ? `animation-delay:${-age}ms` : null },
        h("div", { class: "sw-bg sw-del", "aria-hidden": "true" }, tr("list.delete")),
        h("div", { class: "sw-bg sw-edit", "aria-hidden": "true" }, tr("list.edit")),
        fg);
      attachSwipe(row, fg, { left: () => deleteExpense(t, e), right: own ? () => startEdit(e) : null });
      const key = dayKey(e);
      if (i > 0 && dayKey(cur.expenses[i - 1]) === key) return [row];
      const dayTotal = cur.expenses.filter(x => dayKey(x) === key && x.kind !== "payment").reduce((sum, x) => sum + Math.round(x.amount * (x.rate || 1) * 100), 0);
      return [h("div", { class: "day" }, h("span", { text: dayLabel(key) }), h("span", { class: "num", text: money(dayTotal, ccy) })), row];
    })) : h("div", { class: "empty", text: tr("list.empty") })));

  /* people & invite */
  const gform = h("form", { class: "row", onsubmit: async e => { e.preventDefault(); const n = e.target.gname.value.trim(); if (!n) return; await addMember(n, false); e.target.reset(); toast(tr("ppl.added", { name: n })); } },
    h("label", { class: "grow" }, tr("ppl.addLabel"), h("input", { id: "gname", name: "gname", placeholder: tr("ppl.namePh"), maxlength: 30 })), h("button", { type: "submit" }, tr("add")));
  const link = inviteLink(t.code);
  out.push(h("div", { class: "panel" }, h("h2", { text: tr("ppl.title") }),
    h("div", { class: "chips" }, ids.map(id => h("span", { class: "chip" + (id === mine ? " you" : "") }, memberName(t, id), !t.members[id].uid ? h("small", { text: tr("ppl.notJoined") }) : null))),
    h("div", {}, h("h3", { text: tr("ppl.invite"), style: "margin-bottom:6px" }),
      h("div", { class: "linkbox" },
        h("input", { id: "invlink", readonly: true, value: link, "aria-label": tr("ppl.inviteLink"), onfocus: e => e.target.select() }),
        h("button", { type: "button", onclick: async () => {
          try { await navigator.clipboard.writeText(link); toast(tr("ppl.copied")); }
          catch { const i = document.getElementById("invlink"); i.focus(); i.select(); toast(tr("ppl.holdToCopy")); }
        } }, tr("copy"))),
      navigator.share ? h("button", { class: "primary", style: "margin-top:10px", onclick: async () => {
          try { await navigator.share({ url: link }); } catch {}
        } }, tr("share")) : null),
    gform, ui.joinPick ? whoPicker() : h("button", { class: "ghost", style: "align-self:flex-start", onclick: () => {
      ui.joinPick = true; render();
      const w = $("#whopick"); w?.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      w?.querySelector("button")?.focus({ preventScroll: true });
    } }, tr("ppl.switch"))));

  if (t.createdBy === me.uid) {
    const n = cur.expenses.length;
    out.push(ui.confirmDelete === t.id
      ? h("div", { class: "panel danger" },
          h("h2", { text: tr("del.title", { name: t.name }) }),
          h("p", { text: tr("del.body", { extra: n ? tr("del.extra", { n }) : "" }) }),
          h("div", { class: "row" },
            h("button", { class: "danger-btn", onclick: async ev => {
              ev.currentTarget.disabled = true; ev.currentTarget.textContent = tr("del.deleting");
              try { const name = t.name; await deleteTrip(t); ui.confirmDelete = null; history.replaceState(null, "", location.pathname); render(); toast(tr("del.done", { name })); }
              catch { toast(tr("del.failed")); ui.confirmDelete = null; render(); }
            } }, tr("del.button")),
            h("button", { onclick: () => { ui.confirmDelete = null; render(); } }, tr("cancel"))))
      : h("button", { class: "ghost", style: "align-self:center;color:var(--danger)", onclick: () => { ui.confirmDelete = t.id; render(); } }, tr("del.button")));
  }
  return out;
}

/* ---------- boot ---------- */
loadRates().then(() => { if (me && cur.trip) render(); });
onAuthStateChanged(auth, async user => {
  me = user; unsubTrips?.(); trips = []; tripsLoaded = false;
  if (!me) { render(); return; }
  watchTrips();
  const j = location.hash.match(/^#join-([A-Za-z0-9]{6})$/), tm = location.hash.match(/^#trip-([a-z0-9]+)$/);
  if (j) { try { await joinByCode(j[1]); } catch (e) { render(); toast(e.known ? e.message : tr("err.joinShort")); } }
  else if (tm) openTrip(tm[1]);
  else render();
});
