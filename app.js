import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, signInAnonymously, updateProfile, linkWithPopup }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, collection, query, where, onSnapshot, getDoc, setDoc, updateDoc, deleteDoc, arrayUnion, deleteField, FieldPath }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js?v=95";
import { settle, balances } from "./settle.js?v=95";
import { autoIcon, PICKS, categoryOf, CAT_ICON } from "./icons.js?v=95";
import { t as tr, lang, setLang, locale, decimalSep } from "./i18n.js?v=95";
import { legalDoc } from "./legal.js?v=95";

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
// Days next to today read as words everywhere (list headings, analytics, the expense sheet).
const dayOffset = n => { const d = new Date(); d.setDate(d.getDate() + n); return isoDay(d); };
const relDay = key => key === dayOffset(0) ? "today" : key === dayOffset(-1) ? "yesterday" : key === dayOffset(1) ? "tomorrow" : null;
function dayLabel(key) {
  const rel = relDay(key); if (rel) return tr(rel);
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
    if (s.empty && s.metadata?.fromCache && trips.length) return; // keep the start-up snapshot until the server answers
    trips = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    // An empty answer from the device cache may just mean "not synced yet", so wait for the server before saying "no trips".
    if (trips.length || !s.metadata?.fromCache) tripsLoaded = true;
    if (!cur.id) render();
  }, () => toast(tr("err.loadTrips")));
}
function openTrip(id, keepShown = false) {
  // keepShown: the trip is already on screen from the start-up snapshot; just attach live updates.
  if (keepShown && cur.id === id) { cur.unsubs.forEach(u => u()); cur.unsubs = []; }
  else {
    // Draw straight away from what this phone already has (trip list + last seen expenses);
    // live data replaces it when it arrives. Without saved expenses the trip shows a loading screen.
    closeTrip();
    const known = trips.find(x => x.id === id), saved = expCache[id];
    cur.trip = known || null; cur.expenses = saved ? saved.slice() : []; cur.expLoaded = !!saved; cur.openedAt = Date.now();
  }
  cur.id = id; if (location.hash !== "#trip-" + id) location.hash = "trip-" + id;
  // Still confirming the sign-in (slow network): show the trip now, attach live data once signed in.
  if (booting) { render(); return; }
  cur.unsubs.push(onSnapshot(doc(db, "trips", id), s => {
    if (!s.exists() && s.metadata?.fromCache) return; // not on this phone yet: wait for the server
    cur.trip = s.exists() ? { id: s.id, ...s.data() } : null; if (!cur.trip) cur.missing = true; render();
  }, () => { cur.missing = true; render(); }));
  cur.unsubs.push(onSnapshot(collection(db, "trips", id, "expenses"), { includeMetadataChanges: true }, s => {
    // An empty answer from the phone's cache may just mean "never synced here": keep loading until the server answers.
    if (s.empty && s.metadata?.fromCache && !cur.expLoaded) return;
    cur.expenses = s.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => dayKey(b).localeCompare(dayKey(a)) || (b.at || 0) - (a.at || 0));
    cur.expLoaded = true; rememberExpenses(id, cur.expenses); render();
  }, () => {}));
  render();
}
function closeTrip() { ui.sheetOpen = false; ui.editing = null; document.documentElement.classList.remove("sheet-open"); cur.unsubs.forEach(u => u()); cur = { id: null, trip: null, expenses: [], unsubs: [], expLoaded: false }; ui.joinPick = false; }
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
// Names must be unique within a trip ("anna" and " Anna " count as the same).
const normName = n => (n || "").normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
const memberWithName = (t, name) => Object.keys(t?.members || {}).find(id => normName(t.members[id].name) === normName(name));
function nameTakenError(name) { return Object.assign(new Error(tr("ppl.nameTaken", { name: name.trim() })), { known: true }); }
// Trip admin (the creator) removes someone. Only allowed while nobody's expenses involve them,
// so removing a person never changes anyone else's balance.
async function removeMember(t, id) {
  const m = t.members[id], uses = cur.expenses.filter(e => e.paidBy === id || (e.split || []).includes(id)).length;
  if (uses) { toast(tr("ppl.inExpenses", { name: m.name, n: uses })); return; }
  const upd = { [`members.${id}`]: deleteField() };
  if (m.uid && m.uid !== t.createdBy) upd.memberUids = (t.memberUids || []).filter(u => u !== m.uid);
  try { await updateDoc(doc(db, "trips", t.id), upd); toast(tr("ppl.removed", { name: m.name })); }
  catch { toast(tr("ppl.removeFailed")); }
}
async function addMember(name, withMe) {
  name = name.trim().replace(/\s+/g, " ");
  const clash = memberWithName(cur.trip, name);
  if (clash) throw nameTakenError(cur.trip.members[clash].name);
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
  f.reset(); f.xrate.value = ""; f.xicon.value = ""; f.xdate.value = isoDay(Date.now()); delete f.dataset.dirty;
  ui.forOpen = false; ui.fxOpen = false; f.querySelector("#forlist").hidden = true; f.querySelector("#forbtn").setAttribute("aria-expanded", "false");
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
  try {
    const r = await linkWithPopup(me, new GoogleAuthProvider()); me = r.user;
    // Linking keeps the guest's profile; take Google's name and photo.
    const g = (me.providerData || []).find(p => p?.providerId === "google.com");
    if (g && (g.photoURL || g.displayName)) await updateProfile(me, { photoURL: g.photoURL || me.photoURL, displayName: g.displayName || me.displayName }).catch(() => {});
    toast(tr("auth.saved")); render();
  }
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
// Google's photo can sit in the provider data only (accounts that started as a guest and were
// saved with Google keep the guest profile), so look there too.
const googlePhoto = () => me?.photoURL || (me?.providerData || []).find(p => p?.photoURL)?.photoURL || "";
function avatar(size) {
  const guest = me?.isAnonymous, name = guest ? firstName() : (me?.displayName || me?.email || "");
  const fallback = () => h("span", { class: "avatar" + (guest ? " guest" : ""), "aria-hidden": "true", text: initials(name) });
  const photo = guest ? "" : googlePhoto();
  if (!photo) return fallback();
  // If the photo can't load (offline, Google rate-limiting its image server), show initials instead of an empty circle.
  const img = h("img", { class: "avatar", src: photo, alt: "", width: size, height: size, referrerpolicy: "no-referrer" });
  img.addEventListener("error", () => img.replaceWith(fallback()), { once: true });
  return img;
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
/* ---------- instant start ----------
   Firebase checks the sign-in with Google's servers before it hands out any data, even data
   already stored on the phone. To avoid staring at the splash meanwhile, the last screen is kept
   in localStorage and drawn immediately; taps wait until the sign-in check is done. */
const SNAP_KEY = "mt-snap";
let booting = false, snapTimer = 0;
// Last seen expenses of the most recently opened trips, so reopening one is instant even offline.
let expCache = {}, expCacheUid = null;
const EXP_CACHE_TRIPS = 8;
function rememberExpenses(id, list) {
  delete expCache[id]; expCache[id] = list; // newest last
  const ids = Object.keys(expCache); for (const old of ids.slice(0, Math.max(0, ids.length - EXP_CACHE_TRIPS))) delete expCache[old];
}
function saveSnapshot() {
  if (booting || !me) return;
  clearTimeout(snapTimer);
  snapTimer = setTimeout(() => {
    try {
      const withTrip = cur.id && cur.trip;
      localStorage.setItem(SNAP_KEY, JSON.stringify({ uid: me.uid, name: me.displayName || "", photo: googlePhoto(), email: me.email || "", anon: !!me.isAnonymous,
        trips, tripId: withTrip ? cur.id : null, trip: withTrip ? cur.trip : null, expenses: withTrip ? cur.expenses : [], expCache }));
    } catch {}
  }, 500);
}
function clearSnapshot() { clearTimeout(snapTimer); expCache = {}; try { localStorage.removeItem(SNAP_KEY); } catch {} }
function bootFromSnapshot() {
  let snap = null; try { snap = JSON.parse(localStorage.getItem(SNAP_KEY) || "null"); } catch {}
  if (!snap?.uid) return;
  expCacheUid = snap.uid; expCache = snap.expCache || {};
  if (snap.tripId && snap.expenses && !expCache[snap.tripId]) expCache[snap.tripId] = snap.expenses;
  const tm = location.hash.match(/^#trip-([a-z0-9]+)$/);
  if (location.hash && !tm) return;          // invite links, imprint: wait for the real sign-in
  if (tm && tm[1] !== snap.tripId && !expCache[tm[1]]) return;   // a trip we have no copy of
  booting = true;
  me = { uid: snap.uid, displayName: snap.name, photoURL: snap.photo, email: snap.email, isAnonymous: snap.anon };
  trips = snap.trips || []; tripsLoaded = true;
  if (tm) {
    const id = tm[1], trip = id === snap.tripId ? snap.trip : trips.find(x => x.id === id) || null;
    cur = { id, trip, expenses: (expCache[id] || []).slice(), unsubs: [], expLoaded: true, openedAt: Date.now() };
  }
  document.documentElement.classList.add("booting");
  render();
}
async function alreadyOnTrip(code) {
  try {
    const c = await getDoc(doc(db, "codes", code.toUpperCase()));
    return c.exists() && (await getDoc(doc(db, "trips", c.data().tripId))).exists(); // readable only for members
  } catch { return false; }
}
function guestConfirmView() {
  const name = firstName() || tr("auth.guest"), code = ui.guestConfirm;
  return [brand(), h("div", { class: "panel" },
    h("h2", { text: tr("guest.confirmTitle", { name }) }),
    h("p", { class: "muted", text: tr("guest.confirmBody", { name }) }),
    h("div", { class: "row" },
      h("button", { class: "primary", onclick: async () => {
        ui.guestConfirm = null; render();
        try { await joinByCode(code); } catch (e) { render(); toast(e.known ? e.message : tr("err.joinShort")); }
      } }, tr("guest.continueAs", { name })),
      h("button", { onclick: () => { ui.guestConfirm = null; closeTrip(); signOut(auth); } }, tr("guest.someoneElse"))))];
}
function render() {
  const ae = document.activeElement?.id, saved = {}, sheetScroll = $("#sheet .xform")?.scrollTop || 0;
  // The expense form keeps its values across redraws only once someone has touched it;
  // an untouched form is rebuilt from fresh defaults (last split / payer, which depend on loaded expenses).
  const oldX = app.querySelector(".xform"), keepX = oldX?.dataset.dirty === "1";
  for (const el of app.querySelectorAll("input[id],select[id]")) {
    if (el.id.startsWith("xf")) continue; // filter fields are drawn from ui state, never restored
    if (keepX || !oldX?.contains(el)) saved[el.id] = el.type === "checkbox" ? el.checked : el.value;
  }
  app.replaceChildren(...(ui.legal ? legalView(ui.legal) : !me ? signInView() : ui.guestConfirm ? guestConfirmView() : cur.id ? tripView() : homeView()), legalFooter());
  const sp = document.getElementById("splash");
  if (sp && !sp.classList.contains("done")) { sp.classList.add("done"); setTimeout(() => sp.remove(), 400); }
  for (const [id, v] of Object.entries(saved)) { const el = document.getElementById(id); if (!el) continue; if (el.type === "checkbox") el.checked = v; else el.value = v; }
  if (keepX) { const nx = app.querySelector(".xform"); if (nx) nx.dataset.dirty = "1"; }
  app.querySelector(".xform")?._resync?.();
  syncSheet();
  if (sheetScroll) { const sf = $("#sheet .xform"); if (sf) sf.scrollTop = sheetScroll; }
  app.querySelector(".xform")?._syncIcon?.();
  if (ae) document.getElementById(ae)?.focus();
  saveSnapshot();
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

// Typing in the search box must not replace the box itself: a fresh input mid-word breaks the
// phone keyboard's composition (Gboard doubled/jumbled letters). So redraw only the expenses panel
// around the live input, keeping it (and its focus, caret and composition) untouched.
function refreshExpenses() {
  const live = document.getElementById("xpanel"), keep = document.getElementById("xfq");
  const fresh = h("div", {}, ...tripView()).querySelector("#xpanel");
  if (!live || !keep || !fresh?.querySelector("#xfq")) return render();
  (function swap(liveEl, freshEl) {
    const keepChild = [...liveEl.children].find(c => c === keep || c.contains(keep));
    const freshKids = [...freshEl.childNodes], i = freshKids.findIndex(c => c.nodeType === 1 && (c.id === "xfq" || c.querySelector("#xfq")));
    for (const c of [...liveEl.childNodes]) if (c !== keepChild) c.remove();
    keepChild.before(...freshKids.slice(0, i)); keepChild.after(...freshKids.slice(i + 1));
    if (keepChild !== keep) swap(keepChild, freshKids[i]);
  })(live, fresh);
  saveSnapshot();
}
function tripView() {
  const t = cur.trip, back = h("button", { class: "back", onclick: goHome }, tr("trip.allTrips"));
  if (cur.missing) return [brand(), back, h("div", { class: "panel" }, h("p", { class: "muted", text: tr("trip.missing") }))];
  if (!t || !cur.expLoaded) return [brand(), back, h("div", { class: "trip-loading", role: "status" },
    t ? h("h1", { text: t.name }) : null,
    h("div", { class: "sp-dots", "aria-hidden": "true" }, h("i"), h("i"), h("i")),
    h("p", { class: "muted", text: tr("trip.loading") }),
    // Appears by itself after a few seconds (CSS delay, counted from when the trip was opened).
    h("p", { class: "muted slow", style: `animation-delay:${Math.max(0, 6000 - (Date.now() - (cur.openedAt || Date.now())))}ms`, text: tr("trip.slow") }))];
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
    const same = memberWithName(t, n);
    if (same && t.members[same].uid) {
      // Someone on the trip already uses this name: let the guest pick a spot or another name.
      toast(tr("ppl.nameTaken", { name: t.members[same].name }));
    } else {
      (same ? claimMember(same) : addMember(n, true)).then(() => toast(tr("trip.welcome", { name: n }))).catch(() => { cur.autoJoined = false; toast(tr("trip.addFailed")); });
      return [...out, h("div", { class: "panel" }, h("p", { class: "muted", text: tr("trip.adding") }))];
    }
  }
  // "Which one are you?": at the top for someone not on the trip yet; inside People when switching.
  const whoPicker = () => {
    const free = ids.filter(id => !t.members[id].uid).sort((a, b) => memberName(t, a).localeCompare(memberName(t, b), locale(), { sensitivity: "base" }));
    const nf = h("form", { class: "row", onsubmit: async e => {
        e.preventDefault(); const n = e.target.jn.value.trim(); if (!n) return;
        try { await addMember(n, true); } catch (x) { toast(x.known ? x.message : tr("trip.addFailed")); e.target.jn.select(); }
      } },
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
        try { await updateDoc(doc(db, "trips", t.id), { settlement: { at: Date.now(), by: mine, currency: ccy, count: cur.expenses.length, transfers }, paid: {} }); }
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
  // Next to the amount: what it comes to in the trip currency. Tapping it shows the editable rate;
  // without a known rate the rate line is always open (it has to be filled in).
  const fxSeg = h("button", { type: "button", class: "fx-seg", hidden: true, "aria-label": tr("x.rate"), "aria-controls": "fxbox",
    onclick: ev => { ui.fxOpen = !ui.fxOpen; syncFx(ev.currentTarget.form); if (ui.fxOpen) $("#xrate")?.focus(); } });
  const manualNote = h("p", { class: "fx-info", hidden: true, text: tr("x.noRate") });
  const rateBox = h("div", { class: "fx", id: "fxbox", hidden: true },
    h("div", { class: "fx-row" },
      h("label", { class: "fx-line", for: "xrate" }, h("span", { id: "fxfrom" }), h("input", { id: "xrate", name: "xrate", inputmode: "decimal", placeholder: numPh(), "aria-label": tr("x.rate") }), h("span", { text: ccy }))),
    manualNote);
  const syncFx = f => {
    const c = f.xccy.value, a = c === ccy ? null : autoRate(c, ccy);
    fxSeg.hidden = c === ccy; rateBox.hidden = c === ccy || (!ui.fxOpen && !!a);
    fxSeg.setAttribute("aria-expanded", String(!rateBox.hidden));
    const amt = parseNum(f.xamt.value), r = parseNum(f.xrate.value);
    fxSeg.textContent = amt > 0 && r > 0 ? "≈ " + money(Math.round(amt * r * 100), ccy) : "→ " + ccy;
    manualNote.hidden = !!a;
  };
  const preview = f => syncFx(f);
  const syncRate = f => {
    const c = f.xccy.value; f.xrate.required = c !== ccy;
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
  // Paid by: always yourself to start with; paying for someone else is the exception.
  const defaultPaid = mine;
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
    // No visible labels on description and amount: the placeholders say it; screen readers get aria-labels.
    h("div", { class: "field" },
      h("div", { class: "desc-row" }, iconBtn, h("input", { id: "xdesc", name: "xdesc", placeholder: tr("x.descPh"), "aria-label": tr("x.whatFor"), maxlength: 80, autocomplete: "off" }),
        h("input", { type: "hidden", id: "xicon", name: "xicon", value: "" })),
      picks),
    h("div", { class: "field" },
      h("span", { class: "money" },
        h("input", { id: "xamt", name: "xamt", inputmode: "decimal", placeholder: numPh(), "aria-label": tr("x.amount"), autocomplete: "off" }),
        h("select", { id: "xccy", name: "xccy", "aria-label": tr("x.currency"), onchange: e => syncRate(e.target.form) }, CURRENCIES.map(c => h("option", { value: c, selected: c === (t.localCurrency || ccy) }, c))),
        fxSeg)),
    rateBox,
    // "You paid today for everyone": who, when and for whom as one sentence of tappable pills.
    // The pills are the real controls (select, native date input, the For button); form._syncSentence
    // puts the words around them for the chosen language and payer.
    h("p", { class: "sentence", id: "xsentence" },
      h("select", { id: "xpaid", name: "xpaid", class: "pill", "aria-label": tr("x.paidBy"), onchange: () => form._syncSentence() },
        byName.map(id => h("option", { value: id, selected: id === defaultPaid }, id === mine ? tr("x.youSubj") : memberName(t, id)))),
      h("span", { class: "date-field pill" },
        h("span", { class: "date-show", id: "xdateshow", "aria-hidden": "true" }, h("span", { text: tr("x.whenToday") })),
        h("input", { id: "xdate", name: "xdate", type: "date", "aria-label": tr("x.date"), value: isoDay(Date.now()), max: isoDay(Date.now() + 864e5 * 366),
          onclick: e => { try { e.target.showPicker?.(); } catch {} },
          onchange: () => form._syncDate() })),
      h("button", { type: "button", class: "forbtn pill", id: "forbtn", "aria-label": tr("x.for"), "aria-controls": "forlist", "aria-expanded": String(!!ui.forOpen),
        onclick: ev => { ui.forOpen = !ui.forOpen; const b = ev.currentTarget; b.setAttribute("aria-expanded", String(ui.forOpen)); b.form.querySelector("#forlist").hidden = !ui.forOpen; } },
        h("span", { id: "forsum" }), h("span", { class: "chev", "aria-hidden": "true" }))),
    // Who shares this expense: toggle chips (real checkboxes inside, hidden), you first, plus "Everyone".
    h("div", { class: "checks people", id: "forlist", role: "group", "aria-label": tr("x.splitBetween"), hidden: !ui.forOpen },
      h("button", { type: "button", class: "allchip", id: "forall", "aria-pressed": "false", onclick: ev => {
          const boxes = [...ev.currentTarget.form.querySelectorAll("input[name=xsplit]")], all = boxes.every(b => b.checked);
          boxes.forEach(b => { b.checked = !all; });
          boxes[0]?.dispatchEvent(new Event("input", { bubbles: true }));
        } }, tr("x.forAllChip")),
      [mine, ...byName.filter(id => id !== mine)].filter(Boolean).map(id => h("label", { class: "pchip" },
        h("input", { type: "checkbox", name: "xsplit", value: id, checked: defaultSplit.has(id), id: "xs-" + id }),
        h("span", { class: "tick", "aria-hidden": "true" }),
        h("span", { text: id === mine ? tr("x.youSubj") : memberName(t, id) })))),
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
    $("#forall", form)?.setAttribute("aria-pressed", String(on.length === ids.length));
    const names = on.map(id => id === mine ? tr("x.youObj") : memberName(t, id));
    const list = names.length <= 3 ? names.join(", ") : names.slice(0, 2).join(", ") + ` +${names.length - 2}`;
    $("#forsum", form).textContent = !on.length ? tr("x.forNobody")
      : on.length === ids.length && ids.length > 1 ? tr("x.forAll", { n: ids.length }) : list;
  };
  // Words between the pills. German needs "hast" for "Du" and puts the verb at the end, so the
  // whole template is per language: {who} {when} {for} mark where the pills go.
  form._syncSentence = () => {
    const p = $("#xsentence", form), pills = { who: form.xpaid, when: $(".date-field", form), for: $("#forbtn", form) };
    const tpl = tr(form.xpaid.value === mine ? "x.sentenceYou" : "x.sentence");
    p.replaceChildren(...tpl.split(/(\{who\}|\{when\}|\{for\})/).filter(Boolean).map(part => {
      const k = part.match(/^\{(\w+)\}$/)?.[1];
      return k ? pills[k] : h("span", { class: "sw", text: part });
    }));
  };
  form._syncDate = () => {
    if (!form.xdate.value) form.xdate.value = isoDay(Date.now()); // cleared in the picker: back to today
    const k = form.xdate.value, rel = relDay(k);
    $("#xdateshow span", form).textContent = rel ? tr("x.when_" + rel) : tr("x.whenOn", { d: dayLabel(k) });
  };
  form._resync = () => {
    form._syncFor(); form._syncDate(); form._syncSentence();
    const c = form.xccy.value; form.xrate.required = c !== ccy;
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
  // Filters (this device only): text search, person (paid by or shares in), kind.
  const fq = normName(ui.fq || ""), fp = ui.fp && t.members[ui.fp] ? ui.fp : "", fk = ["paid", "for", "pay"].includes(ui.fk) ? ui.fk : "";
  // "Paid by" / "Paid for" are about the picked person, or about you when the person filter is Everyone.
  const who = fp || mine;
  const list = cur.expenses.filter(e => {
    const isPay = e.kind === "payment";
    if (fk === "pay" && !isPay) return false;
    if (fk === "paid" && (isPay || e.paidBy !== who)) return false;
    if (fk === "for" && (isPay || e.paidBy === who || !(e.split || []).includes(who))) return false;
    if (fp && !(e.paidBy === fp || (e.split || []).includes(fp))) return false;
    if (fq && !normName(isPay ? `${memberName(t, e.paidBy)} ${memberName(t, e.split[0])}` : e.desc).includes(fq)) return false;
    return true;
  });
  const filtering = !!(fq || fp || fk);
  const shareOf = id => e => { const b = Math.round(e.amount * (e.rate || 1) * 100), n = (e.split || []).length || 1; return (e.split || []).includes(id) ? b / n : 0; };
  // What a row adds to the totals: payments only when viewing payments (they aren't spending);
  // with a person picked, their share of each expense, or the full payment they sent or got.
  const full = e => Math.round(e.amount * (e.rate || 1) * 100);
  const counts = e => fk === "pay" ? e.kind === "payment" : e.kind !== "payment";
  // Paid by: the full amounts they paid. Paid for: their share of what others paid.
  const amountOf = e => !counts(e) ? 0 : e.kind === "payment" || fk === "paid" ? full(e) : fk === "for" ? shareOf(who)(e) : !fp ? full(e) : shareOf(fp)(e);
  const listTotal = list.reduce((sum, e) => sum + amountOf(e), 0);
  const setF = (k, v) => { ui[k] = v; render(); };
  const filterOpen = !!ui.filterOpen;
  const filterBar = cur.expenses.length && (filterOpen || filtering) ? h("div", { class: "filters" },
    filterOpen ? h("input", { id: "xfq", type: "search", placeholder: tr("filter.search"), "aria-label": tr("filter.search"), value: ui.fq || "", autocomplete: "off",
      oninput: e => { ui.fq = e.target.value; refreshExpenses(); } }) : null,
    filterOpen ? h("div", { class: "pair" },
      h("select", { id: "xfp", "aria-label": tr("filter.person"), onchange: e => setF("fp", e.target.value) },
        h("option", { value: "", text: tr("filter.everyone") }),
        byName.map(id => h("option", { value: id, selected: id === fp, text: memberName(t, id) + (id === mine ? tr("youSuffix") : "") }))),
      h("select", { id: "xfk", "aria-label": tr("filter.kind"), onchange: e => setF("fk", e.target.value) },
        [["", "filter.all"], ["paid", fp ? "filter.paidBy" : "filter.paidByYou"], ["for", fp ? "filter.paidFor" : "filter.paidForYou"], ["pay", "filter.pay"]]
          .map(([v, k]) => h("option", { value: v, selected: v === fk, text: tr(k, { name: fp ? memberName(t, fp) : "" }) })))) : null,
    filtering ? h("div", { class: "filter-sum" },
      h("span", { text: tr("filter.count", { n: list.length, total: cur.expenses.length }) + " · " + ((fp && !fk) || fk === "for" ? (fp ? tr("filter.shareOf", { name: memberName(t, fp) }) : tr("filter.yourShare")) : "") }),
      h("b", { class: "num", text: money(Math.round(listTotal), ccy) }),
      h("button", { type: "button", class: "ghost", onclick: () => { ui.fq = ""; ui.fp = ""; ui.fk = ""; render(); } }, tr("filter.clear"))) : null) : null;
  const filterBtn = h("button", { type: "button", class: "add-round filter-btn" + (filtering ? " active" : ""), title: tr("filter.toggle"), "aria-label": tr("filter.toggle"),
    "aria-expanded": String(filterOpen), onclick: () => { ui.filterOpen = !filterOpen; render(); if (ui.filterOpen) document.getElementById("xfq")?.focus(); } });
  filterBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h18l-7 8.5V19l-4 2v-7.5Z"/></svg>';
  out.push(h("div", { class: "panel", id: "xpanel" },
    h("div", { class: "top" }, h("h2", { text: tr("list.title") }),
      cur.expenses.length ? filterBtn : null),
    cur.expenses.length ? h("div", { class: "hint", text: hasOwn ? tr("list.swipeBoth") : tr("list.swipeDel") }) : null,
    filterBar,
    !cur.expenses.length ? h("div", { class: "empty", text: tr("list.empty") })
    : !list.length ? h("div", { class: "empty", text: tr("filter.none") })
    : h("div", { class: "list" }, list.flatMap((e, i) => {
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
      if (i > 0 && dayKey(list[i - 1]) === key) return [row];
      const dayTotal = list.filter(x => dayKey(x) === key).reduce((sum, x) => sum + amountOf(x), 0);
      return [h("div", { class: "day" }, h("span", { text: dayLabel(key) }), h("span", { class: "num", text: money(Math.round(dayTotal), ccy) })), row];
    }))));

  /* analytics */
  if (spends.length) out.push(analyticsView(t, spends, ids.length));

  /* people & invite */
  const ICON_COPY = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>';
  const ICON_SHARE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
  const linkBtn = (svg, label, onclick, cls = "") => { const b = h("button", { type: "button", class: "link-icon " + cls, title: label, "aria-label": label, onclick }); b.innerHTML = svg; return b; };
  const addForm = ui.addPerson ? h("form", { class: "add-person", onsubmit: async e => {
      e.preventDefault(); const n = e.target.gname.value.trim(); if (!n) return;
      try { await addMember(n, false); } catch (x) { toast(x.known ? x.message : tr("trip.addFailed")); e.target.gname.select(); return; }
      ui.addPerson = false; render(); toast(tr("ppl.added", { name: n }));
    } },
    h("input", { id: "gname", name: "gname", placeholder: tr("ppl.namePh"), "aria-label": tr("ppl.addLabel"), maxlength: 30, autocomplete: "off",
      onkeydown: e => { if (e.key === "Escape") { e.stopPropagation(); ui.addPerson = false; render(); } } }),
    h("button", { class: "primary", type: "submit" }, tr("add"))) : null;
  const link = inviteLink(t.code);
  out.push(h("div", { class: "panel" },
    h("div", { class: "top" }, h("h2", { text: tr("ppl.title") }),
      h("button", { type: "button", class: "add-round", title: tr("ppl.addLabel"), "aria-label": tr("ppl.addLabel"), "aria-expanded": String(!!ui.addPerson),
        onclick: () => { ui.addPerson = !ui.addPerson; render(); if (ui.addPerson) document.getElementById("gname")?.focus(); } }, h("span", { "aria-hidden": "true", text: "+" }))),
    addForm,
    h("div", { class: "chips" }, byName.map(id => h("span", { class: "chip" + (id === mine ? " you" : "") }, memberName(t, id), !t.members[id].uid ? h("small", { text: tr("ppl.notJoined") }) : null,
      // The trip's admin can remove anyone but themselves: first tap asks, second tap removes.
      t.createdBy === me.uid && id !== mine ? h("button", { type: "button", class: "chip-x", title: tr("ppl.remove", { name: memberName(t, id) }), "aria-label": tr("ppl.remove", { name: memberName(t, id) }),
        onclick: ev => {
          const b = ev.currentTarget, chip = b.parentNode;
          if (!b.dataset.sure) { b.dataset.sure = "1"; chip.classList.add("confirm"); b.textContent = tr("ppl.removeSure"); setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; chip.classList.remove("confirm"); b.textContent = "✕"; } }, 3000); return; }
          b.disabled = true; removeMember(t, id);
        } }, "✕") : null))),
    h("div", {}, h("h3", { text: tr("ppl.invite"), style: "margin-bottom:6px" }),
      h("div", { class: "linkbox" },
        h("input", { id: "invlink", readonly: true, value: link, "aria-label": tr("ppl.inviteLink"), onfocus: e => e.target.select() }),
        linkBtn(ICON_COPY, tr("copy"), async () => {
          try { await navigator.clipboard.writeText(link); toast(tr("ppl.copied")); }
          catch { const i = document.getElementById("invlink"); i.focus(); i.select(); toast(tr("ppl.holdToCopy")); }
        }),
        navigator.share ? linkBtn(ICON_SHARE, tr("share"), async () => { try { await navigator.share({ url: link }); } catch {} }, "share") : null)),
    ui.joinPick ? whoPicker() : h("button", { class: "ghost", style: "align-self:flex-start", onclick: () => {
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

/* ---------- analytics ---------- */
// Categorical colours in fixed order (teal, orange, coral, olive, violet, mustard, sky; colourblind-checked); "other" is always neutral.
const CAT_COLORS = 7;
const FOLD_SHARE = 0.04, FOLD_MAX = 6; // folded view: slices under 4 % (and beyond the 6th) go to "Other"
function analyticsView(t, spends, people) {
  const ccy = t.currency, base = e => Math.round(e.amount * (e.rate || 1) * 100);
  const total = spends.reduce((s, e) => s + base(e), 0);
  // Every category with its sum, biggest first. Colours follow this full ranking, so folding never repaints a slice.
  const by = {};
  for (const e of spends) { const c = categoryOf(iconFor(t, e)); (by[c] ||= { key: c, sum: 0, n: 0 }); by[c].sum += base(e); by[c].n++; }
  const cats = Object.values(by).sort((a, b) => (a.key === "other") - (b.key === "other") || b.sum - a.sum);
  let slot = 0;
  for (const c of cats) c.color = c.key === "other" || slot >= CAT_COLORS ? "var(--cat-other)" : `var(--cat-${++slot})`;
  const named = cats.filter(c => c.key !== "other");
  const keep = named.filter((c, i) => i < FOLD_MAX && c.sum >= total * FOLD_SHARE);
  // Folding a single small slice into "Other" hides more than it tidies: only fold two or more.
  const folded = named.filter(c => !keep.includes(c));
  const shown = folded.length + (by.other ? 1 : 0) >= 2 || !folded.length
    ? [...keep, ...(folded.length || by.other ? [{ key: "other", sum: total - keep.reduce((s, c) => s + c.sum, 0), n: spends.length - keep.reduce((s, c) => s + c.n, 0), color: "var(--cat-other)", folded }] : [])]
    : cats;
  const label = c => tr("cat." + c.key);
  const pct = v => total ? Math.round(v / total * 100) : 0;
  const sel = shown.find(c => c.key === ui.anaSel);
  const pick = k => { ui.anaSel = ui.anaSel === k ? null : k; render(); };

  // Donut: circumference 100 so dash lengths are percentages; a small surface gap between slices.
  const R = 15.9155, gap = shown.length > 1 ? 0.8 : 0;
  let acc = 0;
  const arcs = shown.map(c => {
    const len = c.sum / total * 100, d = Math.max(0, len - gap), off = 25 - acc; acc += len;
    return `<circle class="slice${sel && sel !== c ? " dim" : ""}" data-k="${c.key}" cx="21" cy="21" r="${R}" fill="none" stroke="${c.color}" stroke-width="7" stroke-dasharray="${d} ${100 - d}" stroke-dashoffset="${off}"><title>${label(c)}: ${money(c.sum, ccy)} (${pct(c.sum)} %)</title></circle>`;
  }).join("");
  const pie = h("div", { class: "pie" });
  pie.innerHTML = `<svg viewBox="0 0 42 42" role="img" aria-label="${tr("ana.title")}">${arcs}</svg>`;
  pie.querySelector("svg").addEventListener("click", e => { const k = e.target.dataset?.k; pick(k || null); });
  pie.append(h("div", { class: "pie-center" },
    h("span", { class: "muted small", text: sel ? label(sel) : tr("ana.total") }),
    h("b", { class: "num", text: money(sel ? sel.sum : total, ccy) }),
    sel ? h("span", { class: "muted small num", text: pct(sel.sum) + " %" }) : null));

  const legendRow = c => h("button", { type: "button", class: "leg" + (sel === c ? " on" : sel ? " dim" : ""), onclick: () => pick(c.key), "aria-pressed": String(sel === c) },
    h("i", { class: "dot", style: `background:${c.color}` }),
    h("span", { class: "leg-name" }, h("span", { "aria-hidden": "true", text: CAT_ICON[c.key] + " " }), label(c),
      c.folded?.length ? h("span", { class: "muted", text: " · " + c.folded.map(f => CAT_ICON[f.key]).join("") }) : null),
    h("span", { class: "num", text: money(c.sum, ccy) }),
    h("span", { class: "num muted pct", text: pct(c.sum) + " %" }));

  const open = !!ui.anaOpen;
  const panel = h("div", { class: "panel ana", id: "anapanel" },
    h("div", { class: "top" }, h("h2", { text: tr("ana.title") })),
    h("div", { class: "ana-main" }, pie, h("div", { class: "legend" }, shown.map(legendRow))));
  if (open) panel.append(...analyticsMore(t, spends, cats, total, people, base, label, pct));
  panel.append(h("button", { type: "button", class: "ghost unfold", "aria-expanded": String(open), onclick: () => { ui.anaOpen = !open; ui.anaDay = null; render(); } },
    open ? tr("ana.less") : tr("ana.more"), h("span", { class: "chev" + (open ? " up" : ""), "aria-hidden": "true" })));
  return panel;
}
function analyticsMore(t, spends, cats, total, people, base, label, pct) {
  const ccy = t.currency, out = [];
  // Days from the first to the last expense, empty days included (only the days with spending for very long trips).
  const perDay = {};
  for (const e of spends) perDay[dayKey(e)] = (perDay[dayKey(e)] || 0) + base(e);
  let days = Object.keys(perDay).sort();
  const first = new Date(days[0] + "T12:00"), last = new Date(days[days.length - 1] + "T12:00");
  const span = Math.round((last - first) / 864e5) + 1;
  if (span <= 62) days = Array.from({ length: span }, (_, i) => isoDay(+first + i * 864e5));
  const biggest = spends.reduce((b, e) => !b || base(e) > base(b) ? e : b, null);
  const tile = (lbl, val, sub) => h("div", { class: "tile" }, h("span", { class: "muted small", text: lbl }), h("b", { class: "num", text: val }), sub ? h("span", { class: "muted small ell", text: sub }) : null);
  out.push(h("div", { class: "tiles" },
    tile(tr("ana.perDay"), money(Math.round(total / days.length), ccy), tr("ana.days_n", { n: days.length })),
    tile(tr("ana.perPerson"), money(Math.round(total / Math.max(1, people)), ccy), tr("people", { n: people })),
    tile(tr("ana.biggest"), money(base(biggest), ccy), biggest.desc)));

  // All categories, nothing folded.
  // Only real categories here; the pie's "Other" is a fold of these plus untagged expenses, so it would read differently.
  const bySum = cats.filter(c => c.key !== "other").sort((a, b) => b.sum - a.sum);
  // Tap a category to unfold its expenses (newest first); tap again to fold.
  const catOpen = bySum.some(c => c.key === ui.anaCat) ? ui.anaCat : null;
  const catItems = c => spends.filter(e => categoryOf(iconFor(t, e)) === c.key)
    .sort((a, b) => dayKey(b).localeCompare(dayKey(a)) || (b.at || 0) - (a.at || 0))
    .map(e => h("div", { class: "cat-x" },
      h("span", { class: "xi", "aria-hidden": "true", text: iconFor(t, e) }),
      h("span", { class: "cat-x-main" }, h("span", { class: "cat-x-desc", text: e.desc }),
        h("span", { class: "muted small", text: `${dayLabel(dayKey(e))} · ${memberName(t, e.paidBy)}` })),
      h("span", { class: "num", text: money(base(e), ccy) })));
  if (bySum.length) out.push(h("h3", { text: tr("ana.allCats") }), h("div", { class: "list cats" }, bySum.flatMap(c => {
    const open = c.key === catOpen;
    return [h("button", { type: "button", class: "li cat-row" + (open ? " open" : ""), "aria-expanded": String(open),
        onclick: () => { ui.anaCat = open ? null : c.key; render(); } },
      h("span", {}, h("span", { "aria-hidden": "true", text: CAT_ICON[c.key] + " " }), h("b", { text: label(c) }), h("span", { class: "muted", text: " · " + tr("ana.count", { n: c.n }) })),
      h("span", { class: "cat-amt" }, h("span", { class: "num", text: money(c.sum, ccy) }), h("span", { class: "chev" + (open ? " up" : ""), "aria-hidden": "true" })),
      h("div", { class: "bar" }, h("i", { style: `width:${c.sum / bySum[0].sum * 100}%;background:${c.color}` }))),
      open ? h("div", { class: "cat-items" }, catItems(c)) : null];
  })));

  // Spending per day, stacked by who paid; tap a day for its amount and who paid what.
  if (days.length > 1) {
    const max = Math.max(...days.map(d => perDay[d] || 0)), selDay = days.includes(ui.anaDay) ? ui.anaDay : null;
    // One colour per person, in name order over the whole trip, so a person keeps their colour whatever is shown.
    const order = Object.keys(t.members || {}).sort((a, b) => memberName(t, a).localeCompare(memberName(t, b), locale(), { sensitivity: "base" }));
    const color = id => { const i = order.indexOf(id); return i >= 0 && i < CAT_COLORS ? `var(--cat-${i + 1})` : "var(--cat-other)"; };
    const paidOn = {};
    for (const e of spends) { const d = dayKey(e); (paidOn[d] ||= {}); paidOn[d][e.paidBy] = (paidOn[d][e.paidBy] || 0) + base(e); }
    const payers = order.filter(id => days.some(d => paidOn[d]?.[id]));
    const who = d => payers.filter(id => paidOn[d]?.[id]).map(id => `${memberName(t, id)} ${money(paidOn[d][id], ccy)}`).join(" · ");
    out.push(h("h3", { text: tr("ana.days") }),
      payers.length > 1 ? h("div", { class: "day-legend" }, payers.map(id => h("span", {}, h("i", { class: "dot", style: `background:${color(id)}` }), memberName(t, id)))) : null,
      h("p", { class: "muted small day-read", text: selDay ? `${dayLabel(selDay)} · ${money(perDay[selDay] || 0, ccy)}` + (perDay[selDay] ? " — " + who(selDay) : "") : tr("ana.dayAvg", { amount: money(Math.round(total / days.length), ccy) }) }),
      h("div", { class: "days" + (selDay ? " sel" : "") }, days.map(d => {
        const lbl = `${dayLabel(d)}: ${money(perDay[d] || 0, ccy)}` + (perDay[d] ? ` (${who(d)})` : "");
        return h("button", { type: "button", class: "dbar" + (d === selDay ? " on" : ""), title: lbl, "aria-label": lbl,
          onclick: () => { ui.anaDay = d === selDay ? null : d; render(); } },
          h("span", { class: "stack", style: `height:${perDay[d] ? Math.max(3, perDay[d] / max * 100) : 0}%` },
            payers.filter(id => paidOn[d]?.[id]).map(id => h("i", { style: `flex:${paidOn[d][id]} 1 0;background:${color(id)}` }))));
      })),
      h("div", { class: "days-axis muted small" }, h("span", { text: dayLabel(days[0]) }), h("span", { text: dayLabel(days[days.length - 1]) })));
  }

  return out;
}

/* ---------- boot ---------- */
loadRates().then(() => { if (me && cur.trip) render(); });
// Offline cache: makes repeat visits open instantly and lets MoneTrip open without a connection.
if ("serviceWorker" in navigator) {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  // The page was served from the phone; a newer version just arrived in the background.
  navigator.serviceWorker.addEventListener("message", e => {
    if (e.data?.type !== "monetrip-updated") return;
    if (!ui.sheetOpen && performance.now() < 4000) location.reload(); // still starting up: just switch over
    else toast(tr("app.updated"), { label: tr("app.reload"), run: () => location.reload() });
  });
  navigator.serviceWorker.startMessages?.(); // deliver a message that arrived before this script ran
}
bootFromSnapshot();
onAuthStateChanged(auth, async user => {
  const keep = booting && user && user.uid === me?.uid; // the snapshot on screen belongs to this user
  if (booting) { booting = false; document.documentElement.classList.remove("booting"); if (!keep) closeTrip(); }
  if (expCacheUid && expCacheUid !== user?.uid) expCache = {};
  expCacheUid = user?.uid || null;
  me = user; unsubTrips?.();
  // Accounts saved with Google before that copied Google's name and photo: repair once.
  const g = user && !user.isAnonymous && (user.providerData || []).find(p => p?.providerId === "google.com");
  if (g && g.photoURL && !user.photoURL) updateProfile(user, { photoURL: g.photoURL, displayName: g.displayName || user.displayName }).then(() => render()).catch(() => {});
  if (!keep) { trips = []; tripsLoaded = false; }
  if (!me) { clearSnapshot(); render(); return; }
  watchTrips();
  const j = location.hash.match(/^#join-([A-Za-z0-9]{6})$/), tm = location.hash.match(/^#trip-([a-z0-9]+)$/);
  if (j && me.isAnonymous && !guestName && !(await alreadyOnTrip(j[1]))) {
    // A guest account remembered by this browser may belong to someone else (shared phone,
    // private tabs). Ask before joining as them, so nobody ends up in another guest's trips.
    ui.guestConfirm = j[1]; render();
  }
  else if (j) { try { await joinByCode(j[1]); } catch (e) { render(); toast(e.known ? e.message : tr("err.joinShort")); } }
  else if (tm) openTrip(tm[1], keep);
  else render();
});
