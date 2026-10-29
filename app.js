import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, signInAnonymously, updateProfile, linkWithPopup }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, collection, query, where, onSnapshot, getDoc, setDoc, updateDoc, deleteDoc, arrayUnion, deleteField, FieldPath }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { settle, balances } from "./settle.js";
import { autoIcon, PICKS } from "./icons.js";

const CURRENCIES = ["EUR","USD","GBP","CHF","CZK","HUF","PLN","TRY","SEK","NOK","DKK","JPY","CAD","AUD","THB"];
const $ = (s, r = document) => r.querySelector(s);
const app = $("#app");

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);

let me = null;            // Firebase user
let trips = [], unsubTrips = null;
let cur = { id: null, trip: null, expenses: [], unsubs: [] };
let ui = { joinPick: false };
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
const fmt = (v, c) => { try { return new Intl.NumberFormat("de-AT", { style: "currency", currency: c }).format(v); } catch { return v + " " + c; } };
const money = (cents, c) => fmt(cents / 100, c);
const parseNum = s => parseFloat(String(s).replace(/\s/g, "").replace(",", "."));
const isoDay = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const dayKey = e => e.date || isoDay(e.at || Date.now());
function dayLabel(key) {
  const today = isoDay(Date.now()), yest = isoDay(Date.now() - 864e5);
  if (key === today) return "Today";
  if (key === yest) return "Yesterday";
  const [y, m, d] = key.split("-").map(Number), dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", ...(y !== new Date().getFullYear() ? { year: "numeric" } : {}) });
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
const memberName = (trip, id) => trip.members?.[id]?.name || "Someone";

function watchTrips() {
  unsubTrips?.();
  unsubTrips = onSnapshot(query(collection(db, "trips"), where("memberUids", "array-contains", me.uid)), s => {
    trips = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (!cur.id) render();
  }, () => toast("Couldn't load trips. Reload the page."));
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
  if (!c.exists()) throw new Error("No trip has that code. Check the six characters and try again.");
  const tripId = c.data().tripId;
  if (!trips.some(t => t.id === tripId)) {
    try { await updateDoc(doc(db, "trips", tripId), { memberUids: arrayUnion(me.uid) }); }
    catch { throw new Error("No trip has that code. It may have been deleted."); }
  }
  openTrip(tripId);
}
async function deleteTrip(t) {
  const exps = cur.expenses.slice();
  for (const e of exps) await deleteDoc(doc(db, "trips", t.id, "expenses", e.id));
  const id = t.id; closeTrip();
  await deleteDoc(doc(db, "trips", id));
}
async function claimMember(mid) { await updateDoc(doc(db, "trips", cur.trip.id), { [`members.${mid}.uid`]: me.uid }); ui.joinPick = false; render(); }
async function addMember(name, withMe) {
  const mid = rid(8);
  await updateDoc(doc(db, "trips", cur.trip.id), { [`members.${mid}`]: { name, uid: withMe ? me.uid : null } });
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
    toast(rest.length ? "Payment recorded" : "All settled up 🎉", { label: "Undo", run: async () => {
      try {
        await deleteDoc(doc(db, "trips", t.id, "expenses", id));
        await updateDoc(doc(db, "trips", t.id), { settlement: { ...before, at: Date.now(), count: Math.max(0, count - 1) }, paid: {} });
        toast("Payment undone");
      } catch { toast("Couldn't undo. Delete the payment from the list instead."); }
    } });
  } catch { btn.disabled = false; toast("Couldn't record the payment. Try again."); }
}

/* ---------- expense list: swipe & delete ---------- */
async function deleteExpense(t, e) {
  const { id, ...data } = e;
  if (ui.editing === id) { ui.editing = null; }
  try {
    await deleteDoc(doc(db, "trips", t.id, "expenses", id));
    toast("Expense deleted", { label: "Undo", run: () => setDoc(doc(db, "trips", t.id, "expenses", id), data).then(() => toast("Expense restored")).catch(() => toast("Couldn't restore it.")) });
  } catch { toast("Couldn't delete the expense. Try again."); render(); }
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
  f.xdesc.value = e.desc; f.xamt.value = String(e.amount).replace(".", ",");
  f.xccy.value = e.currency; f.xrate.value = String(e.rate || 1).replace(".", ",");
  f.xpaid.value = e.paidBy; f.xdate.value = dayKey(e); f.xicon.value = e.icon || ""; f._syncIcon?.();
  for (const cb of f.querySelectorAll("input[name=xsplit]")) cb.checked = (e.split || []).includes(cb.value);
  f.dataset.dirty = "1"; f._resync?.();
  openSheet();
}

/* ---------- views ---------- */
const firstName = () => guestName || (me?.displayName || "").split(" ")[0];
function googleSignIn() {
  const p = new GoogleAuthProvider();
  return signInWithPopup(auth, p).catch(e => { if (e.code === "auth/popup-blocked") signInWithRedirect(auth, p); else if (e.code !== "auth/popup-closed-by-user") toast("Sign-in didn't finish. Try again."); });
}
async function saveWithGoogle() {
  try { const r = await linkWithPopup(me, new GoogleAuthProvider()); me = r.user; toast("Saved. You can now sign in with Google on any device."); render(); }
  catch (e) {
    if (e.code === "auth/credential-already-in-use") toast("That Google account already uses MoneTrip. Sign out and sign in with Google instead.");
    else if (e.code !== "auth/popup-closed-by-user") toast("Couldn't connect Google. Try again.");
  }
}
function brand() {
  const guest = me?.isAnonymous;
  const out = h("button", { class: "ghost", onclick: ev => {
    const b = ev.currentTarget;
    if (guest && !b.dataset.sure) { b.dataset.sure = "1"; b.textContent = "Sure? You'll lose access"; setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = "Sign out"; } }, 4000); return; }
    closeTrip(); signOut(auth);
  } }, "Sign out");
  return h("div", { class: "brand" }, h("div", { class: "top" },
    h("div", { class: "id" }, h("span", { class: "logo", "aria-hidden": "true" }),
      h("div", { class: "words" }, h("span", { class: "name", text: "MoneTrip" }),
        h("span", { class: "tag", text: "Freunde & Moneten" }))),
    me ? h("span", { class: "who" }, me.photoURL ? h("img", { src: me.photoURL, alt: "" }) : null,
      h("span", { text: guest ? (firstName() || "Guest") + " · guest" : (me.displayName || me.email || "") }),
      guest ? h("button", { class: "ghost", style: "color:var(--accent-text)", onclick: saveWithGoogle }, "Save with Google") : null, out) : null));
}
function render() {
  const ae = document.activeElement?.id, saved = {}, sheetScroll = $("#sheet .xform")?.scrollTop || 0;
  // The expense form keeps its values across redraws only once someone has touched it;
  // an untouched form is rebuilt from fresh defaults (last split / payer, which depend on loaded expenses).
  const oldX = app.querySelector(".xform"), keepX = oldX?.dataset.dirty === "1";
  for (const el of app.querySelectorAll("input[id],select[id]")) if (keepX || !oldX?.contains(el)) saved[el.id] = el.type === "checkbox" ? el.checked : el.value;
  app.replaceChildren(...(!me ? signInView() : cur.id ? tripView() : homeView()));
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
      if (!name || c.length !== 6) { gerr.hidden = false; gerr.textContent = !name ? "Enter your first name." : "Enter the six-character trip code."; return; }
      f.querySelector("button[type=submit]").disabled = true;
      guestName = name; if (!code) location.hash = "join-" + c;
      try { const r = await signInAnonymously(auth); await updateProfile(r.user, { displayName: name }); }
      catch (x) {
        guestName = null; gerr.hidden = false; f.querySelector("button[type=submit]").disabled = false;
        gerr.textContent = ["auth/operation-not-allowed", "auth/admin-restricted-operation"].includes(x.code)
          ? "Guest sign-in is switched off for MoneTrip. Ask the trip owner to enable it, or sign in with Google."
          : x.code === "auth/network-request-failed" ? "No connection. Check your internet and try again."
          : "Couldn't join as a guest (" + (x.code || "unknown error") + "). Try again, or sign in with Google.";
      }
    } },
    h("h2", { text: code ? "Join as a guest" : "Got a trip code?" }),
    h("p", { class: "muted", text: "Just your first name. No account needed." }),
    h("div", { class: "row" },
      h("label", { class: "grow" }, "First name", h("input", { id: "gfirst", name: "gfirst", required: true, maxlength: 30, autocomplete: "given-name", placeholder: "Anna" })),
      code ? null : h("label", { style: "flex:0 1 140px" }, "Trip code", h("input", { id: "gcode", name: "gcode", maxlength: 6, required: true, autocapitalize: "characters", placeholder: "K7Q2MX", style: "font-family:var(--mono);letter-spacing:.15em;text-transform:uppercase" })),
      h("button", { class: "primary", type: "submit" }, "Join trip")), gerr);
  const google = h("div", { class: "panel signin" },
    h("h2", { text: code ? "Or use your Google account" : "Start your own trip" }),
    h("p", { class: "muted", text: code ? "Then you can open the trip on any device." : "Sign in to create trips and invite friends." }),
    h("button", { class: code ? "gbtn" : "primary gbtn", onclick: googleSignIn }, "Sign in with Google"));
  return [brand(),
    h("div", { class: "panel signin" },
      h("h1", { text: code ? "You're invited to a trip" : "Split trip costs without the awkward maths" }),
      h("p", { class: "muted", text: "Log who paid what, in any currency. When the trip is over, MoneTrip works out who pays whom, with as few transfers as possible." })),
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
      try { await createTrip(name, f.thome.value, f.tlocal.value, nick); } catch { err.hidden = false; err.textContent = "Couldn't create the trip. Check your connection and try again."; btn.disabled = false; }
    } },
    h("h2", { text: "New trip" }),
    h("label", {}, "Trip name", h("input", { id: "tname", name: "tname", placeholder: "Edinburgh, November", required: true, maxlength: 60 })),
    h("div", { class: "pair" },
      h("label", {}, "Home currency", ccySelect("thome", home), h("span", { class: "hint", text: "Everyone settles up in this" })),
      h("label", {}, "Trip currency", ccySelect("tlocal", home), h("span", { class: "hint", text: "What you'll mostly pay in" }))),
    h("label", {}, "Your name on this trip", h("input", { id: "tnick", name: "tnick", value: firstName(), required: true, maxlength: 30 })),
    err,
    h("button", { class: "primary", type: "submit" }, "Create trip"));
  const jerr = h("p", { class: "err", hidden: true });
  const joinForm = h("form", { class: "panel", onsubmit: async e => {
      e.preventDefault();
      try { jerr.hidden = true; await joinByCode(e.target.jcode.value); } catch (x) { jerr.hidden = false; jerr.textContent = x.message?.startsWith("No trip") ? x.message : "Couldn't join that trip. Try again."; }
    } },
    h("h2", { text: "Join with a trip code" }),
    h("p", { class: "muted", text: "Got an invite? Enter the six-character code, or just open the invite link." }),
    h("div", { class: "row" },
      h("label", { class: "grow" }, "Trip code", h("input", { id: "jcode", name: "jcode", placeholder: "K7Q2MX", maxlength: 6, required: true, autocapitalize: "characters", style: "font-family:var(--mono);letter-spacing:.2em;text-transform:uppercase" })),
      h("button", { type: "submit" }, "Join trip")), jerr);
  const list = trips.length ? h("div", { class: "trips" }, trips.map(t => {
      const n = Object.keys(t.members || {}).length;
      return h("button", { class: "trip", onclick: () => openTrip(t.id) },
        h("span", {}, h("strong", { text: t.name }), h("br"), h("span", { class: "muted", text: `${n} ${n === 1 ? "person" : "people"} · ${t.localCurrency && t.localCurrency !== t.currency ? t.localCurrency + " → " : ""}${t.currency}${t.settlement ? " · settled" : ""}` })),
        h("span", { class: "code", text: t.code }));
    }))
    : h("div", { class: "empty", text: "No trips yet. Create one below, or join a friend's trip with their code." });
  const guestNote = h("div", { class: "panel" },
    h("h2", { text: "Start your own trip" }),
    h("p", { class: "muted", text: "You're using MoneTrip as a guest, so you can join trips but not create them. Save your account with Google to start your own." }),
    h("button", { class: "primary", style: "align-self:flex-start", onclick: saveWithGoogle }, "Save with Google"));
  return [brand(), h("h1", { text: "Your trips" }), list, me.isAnonymous ? guestNote : createForm, joinForm];
}

function tripView() {
  const t = cur.trip, back = h("button", { class: "back", onclick: goHome }, "← All trips");
  if (!t) return [brand(), back, h("div", { class: "panel" }, h("p", { class: "muted", text: cur.missing ? "This trip doesn't exist or you're not on it. Ask for a new invite link." : "Loading trip…" }))];
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
        try { await updateDoc(doc(db, "trips", t.id), { name: n }); ui.renaming = null; render(); toast("Trip renamed"); }
        catch { e.target.querySelector("button").disabled = false; toast("Couldn't rename the trip. Try again."); }
      } },
        h("input", { id: "rname", name: "rname", value: t.name, maxlength: 60, required: true, "aria-label": "Trip name",
          onkeydown: e => { if (e.key === "Escape") { ui.renaming = null; render(); } } }),
        h("div", { class: "rename-actions" },
          h("button", { type: "submit", class: "on-accent" }, "Save"),
          h("button", { type: "button", class: "ghost on-accent", onclick: () => { ui.renaming = null; render(); } }, "Cancel")))
    : h("div", { class: "title-row" }, h("h1", { text: t.name }),
        isAdmin ? h("button", { class: "icon-btn", title: "Rename trip", "aria-label": "Rename trip",
          onclick: () => { ui.renaming = t.id; render(); const i = document.getElementById("rname"); i.value = t.name; i.focus(); i.select(); } }) : null);
  if (isAdmin && ui.renaming !== t.id) titleBlock.querySelector(".icon-btn").innerHTML = pencil;

  out.push(h("div", { class: "ticket" },
    h("div", { style: "min-width:0" }, h("div", { class: "lbl", text: "Trip" }), titleBlock),
    h("div", { style: "text-align:right" }, h("div", { class: "lbl", text: "Trip code" }), h("div", { class: "ref", text: t.code })),
    h("div", { class: "meta" }, h("span", {}, "Total ", h("b", { class: "num", text: money(total, ccy) })), h("span", {}, `${ids.length} ${ids.length === 1 ? "person" : "people"}`), h("span", {}, `${spends.length} ${spends.length === 1 ? "expense" : "expenses"}`), h("span", {}, (t.localCurrency && t.localCurrency !== ccy ? "Paying in " + t.localCurrency + " · " : "") + "Settles in " + ccy))));

  if (!mine && guestName && !cur.autoJoined) {
    cur.autoJoined = true; const n = guestName;
    const match = ids.find(id => !t.members[id].uid && t.members[id].name.trim().toLowerCase() === n.toLowerCase());
    (match ? claimMember(match) : addMember(n, true)).then(() => toast("Welcome, " + n + "!")).catch(() => { cur.autoJoined = false; toast("Couldn't add you. Pick your name below."); });
    return [...out, h("div", { class: "panel" }, h("p", { class: "muted", text: "Adding you to the trip…" }))];
  }
  if (!mine || ui.joinPick) {
    const free = ids.filter(id => !t.members[id].uid);
    const nf = h("form", { class: "row", onsubmit: async e => { e.preventDefault(); const n = e.target.jn.value.trim(); if (n) await addMember(n, true); } },
      h("label", { class: "grow" }, "Join as a new person", h("input", { id: "jn", name: "jn", value: firstName(), required: true, maxlength: 30 })),
      h("button", { class: "primary", type: "submit" }, "Join"));
    out.push(h("div", { class: "panel" }, h("h2", { text: "Which one are you?" }),
      free.length ? h("div", { class: "chips" }, free.map(id => h("button", { onclick: () => claimMember(id) }, "I'm " + t.members[id].name))) : null, nf,
      mine ? h("button", { class: "ghost", onclick: () => { ui.joinPick = false; render(); } }, "Cancel") : null));
    if (!mine) return out;
  }

  /* settlement */
  const s = t.settlement;
  if (s) {
    const stale = cur.expenses.some(e => (e.changed || e.at || 0) > s.at) || s.count !== cur.expenses.length;
    const minePay = s.transfers.filter(x => x.from === mine || x.to === mine), others = s.transfers.filter(x => !(x.from === mine || x.to === mine));
    const row = x => {
      const isMine = x.from === mine || x.to === mine;
      const label = x.from === mine ? ["You pay ", h("b", { text: memberName(t, x.to) })] : x.to === mine ? [h("b", { text: memberName(t, x.from) }), " pays you"] : [h("b", { text: memberName(t, x.from) }), h("span", { class: "arrow" }, " → "), h("b", { text: memberName(t, x.to) })];
      return h("div", { class: "pay" + (isMine ? " mine" : "") }, h("span", {}, label), h("span", { class: "num", text: money(x.amount, s.currency || ccy) }),
        h("button", { onclick: ev => markPaid(t, x, ev.currentTarget) }, "Mark paid"));
    };
    out.push(h("div", { class: "panel" },
      h("div", { class: "top" }, h("h2", { text: "Pay back" }),
        h("span", { class: "head-right" },
          h("span", { class: "muted", text: `${s.transfers.length} ${s.transfers.length === 1 ? "transfer" : "transfers"} left` }))),
      stale ? h("p", { class: "notice", text: "Expenses changed after this plan was made. Settle up again to update it." }) : null,
      s.transfers.length ? h("p", { class: "muted small", text: "Marking a transfer as paid adds it to the expenses as a payment, so you can settle one at a time." }) : null,
      !s.transfers.length ? h("p", { class: "muted", text: "Everyone is even. Nobody needs to pay anything." }) : null,
      minePay.length ? h("h3", { text: "Your list" }) : s.transfers.length ? h("p", { class: "muted", text: "You're even. Nothing to pay or collect." }) : null,
      minePay.map(row), others.length ? h("h3", { text: "Everyone else" }) : null, others.map(row)));
  }

  /* balances */
  const maxAbs = Math.max(1, ...ids.map(id => Math.abs(bal[id])));
  out.push(h("div", { class: "panel" },
    h("div", { class: "top" }, h("h2", { text: "Balances" }),
      h("button", { class: "primary", disabled: !cur.expenses.length, onclick: async ev => {
        ev.target.disabled = true; const transfers = settle(bal);
        try { await updateDoc(doc(db, "trips", t.id), { settlement: { at: Date.now(), by: mine, currency: ccy, count: cur.expenses.length, transfers }, paid: {} });
          toast(transfers.length ? `Done: ${transfers.length} ${transfers.length === 1 ? "transfer" : "transfers"} settle everything` : "Everyone is already even"); }
        catch { toast("Couldn't save the plan. Try again."); ev.target.disabled = false; }
      } }, s ? "Settle up again" : "Settle up")),
    h("div", { class: "list" }, [...ids].sort((a, b) => memberName(t, a).localeCompare(memberName(t, b), "de", { sensitivity: "base" })).map(id => {
      const b = bal[id];
      return h("div", { class: "li" },
        h("span", {}, h("b", { text: memberName(t, id) }), id === mine ? h("span", { class: "muted", text: " (you)" }) : null),
        h("span", { class: "num " + (b > 0 ? "pos" : b < 0 ? "neg" : "muted"), text: (b > 0 ? "+" : "") + money(b, ccy) }),
        h("span", { class: "sub", text: `paid ${money(paid[id], ccy)} · share ${money(share[id], ccy)}` }),
        h("div", { class: "bar" }, h("i", { style: `width:${Math.abs(b) / maxAbs * 100}%;background:var(${b >= 0 ? "--bar-pos" : "--bar-neg"})` })));
    }))));

  /* add expense */
  const xerr = h("p", { class: "err", hidden: true });
  const rateNote = h("span", { class: "fx-conv" });
  const manualNote = h("p", { class: "fx-info", hidden: true, text: "No automatic rate right now. Enter the rate your bank used." });
  const rateBox = h("div", { class: "fx", hidden: true },
    h("div", { class: "fx-row" },
      h("label", { class: "fx-line", for: "xrate" }, h("span", { id: "fxfrom" }), h("input", { id: "xrate", name: "xrate", inputmode: "decimal", placeholder: "0,00", "aria-label": "Exchange rate" }), h("span", { text: ccy })),
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
    f.xrate.value = a ? String(a).replace(".", ",") : "";
    preview(f);
  };
  const editing = ui.editing ? cur.expenses.find(x => x.id === ui.editing) : null;
  // Tick the same people as in this person's own most recent expense; everyone if they haven't added one yet.
  const lastOwn = cur.expenses.filter(x => x.by === mine && x.kind !== "payment").reduce((best, x) => !best || (x.at || 0) > (best.at || 0) ? x : best, null);
  const lastSplit = (lastOwn?.split || []).filter(id => ids.includes(id));
  const defaultSplit = new Set(lastSplit.length ? lastSplit : ids);
  // Paid by: whoever paid in this person's own last expense, else themselves.
  const defaultPaid = lastOwn && ids.includes(lastOwn.paidBy) ? lastOwn.paidBy : mine;
  const byName = ids.slice().sort((a, b) => memberName(t, a).localeCompare(memberName(t, b), "de", { sensitivity: "base" }));
  if (ui.editing && !editing && cur.expenses.length) ui.editing = null;
  const iconBtn = h("button", { type: "button", class: "icon-pick", "aria-label": "Choose an icon", "aria-expanded": "false",
    onclick: () => { picks.hidden = !picks.hidden; iconBtn.setAttribute("aria-expanded", String(!picks.hidden)); } });
  const pick = ic => { form.xicon.value = ic; form.dataset.dirty = "1"; picks.hidden = true; iconBtn.setAttribute("aria-expanded", "false"); form._syncIcon(); };
  const firstEmoji = v => { for (const { segment } of new Intl.Segmenter().segment(v)) if (/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(segment)) return segment; return ""; };
  const picks = h("div", { class: "picks", hidden: true, role: "group", "aria-label": "Icons" },
    h("input", { class: "emoji-in", placeholder: "Or type any emoji…", "aria-label": "Type an emoji", autocomplete: "off", enterkeyhint: "done",
      oninput: e => { const em = firstEmoji(e.target.value); if (em) { e.target.value = ""; pick(em); } },
      onkeydown: e => { if (e.key === "Enter") e.preventDefault(); } }),
    PICKS.map(ic => h("button", { type: "button", onclick: () => pick(ic) }, ic)),
    h("button", { type: "button", class: "auto", onclick: () => pick("") }, "Auto"));
  const form = h("form", { class: "panel xform", oninput: e => { e.currentTarget.dataset.dirty = "1"; if (e.target.id === "xrate") e.currentTarget.dataset.auto = ""; if (e.target.id === "xdesc") form._syncIcon(); if (e.target.name === "xsplit") form._syncFor(); preview(e.currentTarget); }, onsubmit: async e => {
      e.preventDefault(); const f = e.target; xerr.hidden = true;
      const amount = parseNum(f.xamt.value), c = f.xccy.value, rate = c === ccy ? 1 : parseNum(f.xrate.value);
      const split = [...f.querySelectorAll("input[name=xsplit]:checked")].map(i => i.value);
      const bad = !f.xdesc.value.trim() ? "Add a short description." : !(amount > 0) ? "Enter an amount above zero." : !(rate > 0) ? `Enter how many ${ccy} one ${c} is worth.` : !split.length ? "Pick at least one person to split with." : null;
      if (bad) { xerr.hidden = false; xerr.textContent = bad; return; }
      const btn = f.querySelector("button[type=submit]"); btn.disabled = true;
      const data = { desc: f.xdesc.value.trim(), icon: f.xicon.value, amount, currency: c, rate, paidBy: f.xpaid.value, split, date: f.xdate.value || isoDay(Date.now()) };
      if (data.icon !== (editing?.icon || "")) rememberIcon(t, data.desc, data.icon);
      try {
        if (editing) { await updateDoc(doc(db, "trips", t.id, "expenses", editing.id), { ...data, changed: Date.now() }); closeSheet(); toast("Expense updated"); }
        else {
          const newId = rid(); ui.justAdded = { id: newId, t0: Date.now() };
          // Hide the sheet right away so the new row's fold-in animation is visible; keep the values until the save succeeds.
          ui.sheetOpen = false; syncSheet();
          try { await setDoc(doc(db, "trips", t.id, "expenses", newId), { ...data, at: Date.now(), by: mine }); }
          catch (err) { ui.justAdded = null; openSheet(); throw err; }
          resetExpenseForm(); $("#fab")?.focus({ preventScroll: true }); toast("Expense added");
        }
      }
      catch { xerr.hidden = false; xerr.textContent = "Couldn't save the expense. Try again."; toast("Couldn't save the expense. Try again."); }
      btn.disabled = false;
    } },
    h("div", { class: "top sheet-head" }, h("h2", { id: "sheettitle", text: editing ? "Edit expense" : "Add an expense" }),
      h("button", { type: "button", class: "icon-btn close-btn", "aria-label": "Close", onclick: closeSheet }, "✕")),
    h("div", { class: "field" }, h("label", { for: "xdesc", text: "What for" }),
      h("div", { class: "desc-row" }, iconBtn, h("input", { id: "xdesc", name: "xdesc", placeholder: "Dinner, taxi, hotel…", maxlength: 80, autocomplete: "off" }),
        h("input", { type: "hidden", id: "xicon", name: "xicon", value: "" })),
      picks),
    h("label", {}, "Amount",
      h("span", { class: "money" },
        h("input", { id: "xamt", name: "xamt", inputmode: "decimal", placeholder: "0,00", autocomplete: "off" }),
        h("select", { id: "xccy", name: "xccy", "aria-label": "Currency", onchange: e => syncRate(e.target.form) }, CURRENCIES.map(c => h("option", { value: c, selected: c === (t.localCurrency || ccy) }, c))))),
    rateBox,
    h("div", { class: "pair" },
      h("label", {}, "Paid by", h("select", { id: "xpaid", name: "xpaid" }, byName.map(id => h("option", { value: id, selected: id === defaultPaid }, memberName(t, id) + (id === mine ? " (you)" : ""))))),
      h("label", {}, "Date", h("input", { id: "xdate", name: "xdate", type: "date", value: isoDay(Date.now()), max: isoDay(Date.now() + 864e5 * 366) }))),
    h("div", { class: "forfield" },
      h("span", { class: "flabel", id: "forlbl", text: "For" }),
      h("button", { type: "button", class: "forbtn", id: "forbtn", "aria-labelledby": "forlbl forsum", "aria-controls": "forlist", "aria-expanded": String(!!ui.forOpen),
        onclick: ev => { ui.forOpen = !ui.forOpen; const b = ev.currentTarget; b.setAttribute("aria-expanded", String(ui.forOpen)); b.form.querySelector("#forlist").hidden = !ui.forOpen; } },
        h("span", { id: "forsum" }), h("span", { class: "chev", "aria-hidden": "true" })),
      h("div", { class: "checks", id: "forlist", role: "group", "aria-label": "Split equally between", hidden: !ui.forOpen },
        byName.map(id => h("label", {}, h("input", { type: "checkbox", name: "xsplit", value: id, checked: defaultSplit.has(id), id: "xs-" + id }), memberName(t, id))))),
    xerr,
    editing
      ? h("div", { class: "pair" },
          h("button", { type: "button", onclick: closeSheet }, "Cancel"),
          h("button", { class: "primary", type: "submit" }, "Save changes"))
      : h("button", { class: "primary", type: "submit" }, "Add expense"));
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
    const names = on.map(id => id === mine ? "you" : memberName(t, id));
    $("#forsum", form).textContent = !on.length ? "Nobody yet"
      : on.length === ids.length ? (ids.length > 1 ? `Everyone (${ids.length})` : "Just you")
      : names.length <= 3 ? names.join(", ").replace(/^you/, "You") : names.slice(0, 2).join(", ").replace(/^you/, "You") + ` +${names.length - 2}`;
  };
  form._resync = () => {
    form._syncFor();
    const c = form.xccy.value; rateBox.hidden = c === ccy; form.xrate.required = c !== ccy;
    $("#fxfrom", rateBox).textContent = "1 " + c + " =";
    const a = c === ccy ? null : autoRate(c, ccy);
    if (a && !form.xrate.value) form.xrate.value = String(a).replace(".", ",");
    form.dataset.auto = a && parseNum(form.xrate.value) === a ? "1" : "";
    preview(form);
  };
  form.classList.add("sheet");
  out.push(h("div", { class: "sheet-wrap", id: "sheet", hidden: !ui.sheetOpen, role: "dialog", "aria-modal": "true", "aria-labelledby": "sheettitle",
      onclick: e => { if (e.target === e.currentTarget) closeSheet(); } }, form),
    h("button", { class: "fab", id: "fab", "aria-label": "Add expense", title: "Add expense", hidden: !!ui.sheetOpen, onclick: openSheet }, h("span", { "aria-hidden": "true", text: "+" })));

  /* expenses */
  const hasOwn = cur.expenses.some(e => e.by === mine && e.kind !== "payment");
  out.push(h("div", { class: "panel" },
    h("div", { class: "top" }, h("h2", { text: "Expenses" }),
      cur.expenses.length ? h("span", { class: "hint", text: hasOwn ? "Swipe ← to delete · → to edit yours" : "Swipe ← to delete" }) : null),
    cur.expenses.length ? h("div", { class: "list" }, cur.expenses.flatMap((e, i) => {
      const base = Math.round(e.amount * (e.rate || 1) * 100), isPay = e.kind === "payment", own = e.by === mine && !isPay;
      const fg = h("div", { class: "li xp" + (isPay ? " payment" : "") + (ui.editing === e.id ? " is-editing" : ""), tabindex: 0,
          "aria-label": `${e.desc}, ${fmt(e.amount, e.currency)}. ${own ? "Press E to edit, " : ""}Delete key to delete.`,
          onkeydown: ev => { if (own && ev.key.toLowerCase() === "e") startEdit(e); else if (ev.key === "Delete") deleteExpense(t, e); } },
        h("span", { class: "xi", "aria-hidden": "true", text: isPay ? "💸" : iconFor(t, e) }),
        h("b", { text: isPay ? `${memberName(t, e.paidBy)} → ${memberName(t, e.split[0])}` : e.desc }),
        h("span", { class: "act" }, h("span", { class: "num", text: fmt(e.amount, e.currency) })),
        h("span", { class: "sub", text: isPay ? "Payment from settle up" : `${memberName(t, e.paidBy)} paid · split ${e.split.length} ways${e.currency !== ccy ? ` · ${money(base, ccy)} at ${e.rate}` : ""}` }));
      // A just-added expense folds into the list. Live updates can redraw the list mid-animation,
      // so resume it where it was with a negative delay instead of restarting.
      const ja = ui.justAdded, age = ja && ja.id === e.id ? Date.now() - ja.t0 : Infinity;
      const row = h("div", { class: "swipe" + (age < 900 ? " entering" : ""), style: age < 900 ? `animation-delay:${-age}ms` : null },
        h("div", { class: "sw-bg sw-del", "aria-hidden": "true" }, "Delete"),
        h("div", { class: "sw-bg sw-edit", "aria-hidden": "true" }, "Edit"),
        fg);
      attachSwipe(row, fg, { left: () => deleteExpense(t, e), right: own ? () => startEdit(e) : null });
      const key = dayKey(e);
      if (i > 0 && dayKey(cur.expenses[i - 1]) === key) return [row];
      const dayTotal = cur.expenses.filter(x => dayKey(x) === key && x.kind !== "payment").reduce((sum, x) => sum + Math.round(x.amount * (x.rate || 1) * 100), 0);
      return [h("div", { class: "day" }, h("span", { text: dayLabel(key) }), h("span", { class: "num", text: money(dayTotal, ccy) })), row];
    })) : h("div", { class: "empty", text: "No expenses yet. Add the first one above, like the hotel or a dinner." })));

  /* people & invite */
  const gform = h("form", { class: "row", onsubmit: async e => { e.preventDefault(); const n = e.target.gname.value.trim(); if (!n) return; await addMember(n, false); e.target.reset(); toast(n + " added"); } },
    h("label", { class: "grow" }, "Add someone who hasn't joined yet", h("input", { id: "gname", name: "gname", placeholder: "Name", maxlength: 30 })), h("button", { type: "submit" }, "Add"));
  const link = inviteLink(t.code);
  out.push(h("div", { class: "panel" }, h("h2", { text: "People" }),
    h("div", { class: "chips" }, ids.map(id => h("span", { class: "chip" + (id === mine ? " you" : "") }, memberName(t, id), !t.members[id].uid ? h("small", { text: "not joined" }) : null))),
    h("div", {}, h("h3", { text: "Invite", style: "margin-bottom:6px" }),
      h("div", { class: "linkbox" },
        h("input", { id: "invlink", readonly: true, value: link, "aria-label": "Invite link", onfocus: e => e.target.select() }),
        h("button", { type: "button", onclick: async () => {
          try { await navigator.clipboard.writeText(link); toast("Link copied"); }
          catch { const i = document.getElementById("invlink"); i.focus(); i.select(); toast("Tap and hold to copy"); }
        } }, "Copy")),
      navigator.share ? h("button", { class: "primary", style: "margin-top:10px", onclick: async () => {
          try { await navigator.share({ url: link }); } catch {}
        } }, "Share…") : null),
    gform, h("button", { class: "ghost", style: "align-self:flex-start", onclick: () => { ui.joinPick = true; render(); } }, "Not you? Switch person")));

  if (t.createdBy === me.uid) {
    const n = cur.expenses.length;
    out.push(ui.confirmDelete === t.id
      ? h("div", { class: "panel danger" },
          h("h2", { text: `Delete ${t.name}?` }),
          h("p", { text: `This removes the trip${n ? ` and its ${n} ${n === 1 ? "expense" : "expenses"}` : ""} for everyone on it. This can't be undone.` }),
          h("div", { class: "row" },
            h("button", { class: "danger-btn", onclick: async ev => {
              ev.currentTarget.disabled = true; ev.currentTarget.textContent = "Deleting…";
              try { const name = t.name; await deleteTrip(t); ui.confirmDelete = null; history.replaceState(null, "", location.pathname); render(); toast(name + " deleted"); }
              catch { toast("Couldn't delete the trip. Try again."); ui.confirmDelete = null; render(); }
            } }, "Delete trip"),
            h("button", { onclick: () => { ui.confirmDelete = null; render(); } }, "Cancel")))
      : h("button", { class: "ghost", style: "align-self:center;color:var(--danger)", onclick: () => { ui.confirmDelete = t.id; render(); } }, "Delete trip"));
  }
  return out;
}

/* ---------- boot ---------- */
loadRates().then(() => { if (me && cur.trip) render(); });
onAuthStateChanged(auth, async user => {
  me = user; unsubTrips?.(); trips = [];
  if (!me) { render(); return; }
  watchTrips();
  const j = location.hash.match(/^#join-([A-Za-z0-9]{6})$/), tm = location.hash.match(/^#trip-([a-z0-9]+)$/);
  if (j) { try { await joinByCode(j[1]); } catch (e) { render(); toast(e.message?.startsWith("No trip") ? e.message : "Couldn't join that trip."); } }
  else if (tm) openTrip(tm[1]);
  else render();
});
