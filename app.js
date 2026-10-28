import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, signInAnonymously, updateProfile, linkWithPopup }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, collection, query, where, onSnapshot, getDoc, setDoc, updateDoc, deleteDoc, arrayUnion }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { settle, balances } from "./settle.js";

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
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2400); }
function rid(n = 12) { const a = "abcdefghijkmnpqrstuvwxyz23456789"; let s = ""; for (const x of crypto.getRandomValues(new Uint8Array(n))) s += a[x % a.length]; return s; }
function refCode() { const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = ""; for (const x of crypto.getRandomValues(new Uint8Array(6))) s += a[x % a.length]; return s; }
const fmt = (v, c) => { try { return new Intl.NumberFormat("de-AT", { style: "currency", currency: c }).format(v); } catch { return v + " " + c; } };
const money = (cents, c) => fmt(cents / 100, c);
const parseNum = s => parseFloat(String(s).replace(/\s/g, "").replace(",", "."));
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
    cur.expenses = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.at || 0) - (a.at || 0)); render();
  }, () => {}));
  render();
}
function closeTrip() { cur.unsubs.forEach(u => u()); cur = { id: null, trip: null, expenses: [], unsubs: [] }; ui.joinPick = false; }
function goHome() { closeTrip(); history.replaceState(null, "", location.pathname); render(); }

async function createTrip(name, ccy, nick) {
  let code = refCode();
  for (let i = 0; i < 5 && (await getDoc(doc(db, "codes", code))).exists(); i++) code = refCode();
  const id = rid(20), mid = rid(8);
  await setDoc(doc(db, "trips", id), { name, currency: ccy, code, createdBy: me.uid, createdAt: Date.now(),
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
    h("span", { class: "name", text: "MoneTrip" }),
    me ? h("span", { class: "who" }, me.photoURL ? h("img", { src: me.photoURL, alt: "" }) : null,
      h("span", { text: guest ? (firstName() || "Guest") + " · guest" : (me.displayName || me.email || "") }),
      guest ? h("button", { class: "ghost", style: "color:var(--accent)", onclick: saveWithGoogle }, "Save with Google") : null, out) : null),
    h("span", { class: "tag", text: "Strenge Rechnung, gute Freunde." }));
}
function render() {
  const ae = document.activeElement?.id;
  app.replaceChildren(...(!me ? signInView() : cur.id ? tripView() : homeView()));
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
      catch { guestName = null; gerr.hidden = false; gerr.textContent = "Couldn't join as a guest. Try again, or sign in with Google."; f.querySelector("button[type=submit]").disabled = false; }
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
  const createForm = h("form", { class: "panel", onsubmit: async e => {
      e.preventDefault(); const f = e.target, name = f.tname.value.trim(), nick = f.tnick.value.trim(); if (!name || !nick) return;
      f.querySelector("button").disabled = true;
      try { await createTrip(name, f.tccy.value, nick); } catch { err.hidden = false; err.textContent = "Couldn't create the trip. Check your connection and try again."; f.querySelector("button").disabled = false; }
    } },
    h("h2", { text: "New trip" }),
    h("div", { class: "row" },
      h("label", { class: "grow" }, "Trip name", h("input", { id: "tname", name: "tname", placeholder: "Istanbul, November", required: true, maxlength: 60 })),
      h("label", { style: "flex:0 0 110px" }, "Currency", h("select", { id: "tccy", name: "tccy" }, CURRENCIES.map(c => h("option", { value: c, selected: c === "EUR" }, c))))),
    h("div", { class: "row" },
      h("label", { class: "grow" }, "Your name on this trip", h("input", { id: "tnick", name: "tnick", value: firstName(), required: true, maxlength: 30 })),
      h("button", { class: "primary", type: "submit" }, "Create trip")), err);
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
        h("span", {}, h("strong", { text: t.name }), h("br"), h("span", { class: "muted", text: `${n} ${n === 1 ? "person" : "people"} · ${t.currency}${t.settlement ? " · settled" : ""}` })),
        h("span", { class: "code", text: t.code }));
    }))
    : h("div", { class: "empty", text: "No trips yet. Create one below, or join a friend's trip with their code." });
  return [brand(), h("h1", { text: "Your trips" }), list, createForm, joinForm];
}

function tripView() {
  const t = cur.trip, back = h("button", { class: "back", onclick: goHome }, "← All trips");
  if (!t) return [brand(), back, h("div", { class: "panel" }, h("p", { class: "muted", text: cur.missing ? "This trip doesn't exist or you're not on it. Ask for a new invite link." : "Loading trip…" }))];
  const mine = myMemberId(t), ccy = t.currency, ids = Object.keys(t.members || {});
  const { bal, paid, share } = balances(t.members, cur.expenses);
  const total = cur.expenses.reduce((s, e) => s + Math.round(e.amount * (e.rate || 1) * 100), 0);
  const out = [brand(), back];

  out.push(h("div", { class: "ticket" },
    h("div", {}, h("div", { class: "lbl", text: "Trip" }), h("h1", { text: t.name })),
    h("div", { style: "text-align:right" }, h("div", { class: "lbl", text: "Trip code" }), h("div", { class: "ref", text: t.code })),
    h("div", { class: "meta" }, h("span", {}, "Total ", h("b", { class: "num", text: money(total, ccy) })), h("span", {}, `${ids.length} ${ids.length === 1 ? "person" : "people"}`), h("span", {}, `${cur.expenses.length} expenses`), h("span", {}, "Settles in " + ccy))));

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
    const stale = cur.expenses.some(e => (e.at || 0) > s.at) || s.count !== cur.expenses.length;
    const minePay = s.transfers.filter(x => x.from === mine || x.to === mine), others = s.transfers.filter(x => !(x.from === mine || x.to === mine));
    const row = x => {
      const k = x.from + "_" + x.to, done = !!(t.paid || {})[k], isMine = x.from === mine || x.to === mine;
      const label = x.from === mine ? ["You pay ", h("b", { text: memberName(t, x.to) })] : x.to === mine ? [h("b", { text: memberName(t, x.from) }), " pays you"] : [h("b", { text: memberName(t, x.from) }), h("span", { class: "arrow" }, " → "), h("b", { text: memberName(t, x.to) })];
      return h("div", { class: "pay" + (isMine ? " mine" : "") + (done ? " done" : "") }, h("span", {}, label), h("span", { class: "num", text: money(x.amount, s.currency || ccy) }),
        h("button", { class: done ? "ghost" : "", onclick: () => updateDoc(doc(db, "trips", t.id), { [`paid.${k}`]: !done }) }, done ? "Undo" : "Mark paid"));
    };
    const allDone = s.transfers.length && s.transfers.every(x => (t.paid || {})[x.from + "_" + x.to]);
    out.push(h("div", { class: "panel" },
      h("div", { class: "top" }, h("h2", { text: "Pay back" }), allDone ? h("span", { class: "pill ok", text: "All paid" }) : h("span", { class: "muted", text: `${s.transfers.length} ${s.transfers.length === 1 ? "transfer" : "transfers"} in total` })),
      stale ? h("p", { class: "notice", text: "Expenses changed after this plan was made. Settle up again to update it." }) : null,
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
    h("div", { class: "list" }, ids.map(id => {
      const b = bal[id];
      return h("div", { class: "li" },
        h("span", {}, h("b", { text: memberName(t, id) }), id === mine ? h("span", { class: "muted", text: " (you)" }) : null),
        h("span", { class: "num " + (b > 0 ? "pos" : b < 0 ? "neg" : "muted"), text: (b > 0 ? "+" : "") + money(b, ccy) }),
        h("span", { class: "sub", text: `paid ${money(paid[id], ccy)} · share ${money(share[id], ccy)}` }),
        h("div", { class: "bar" }, h("i", { style: `width:${Math.abs(b) / maxAbs * 100}%;background:var(${b >= 0 ? "--get" : "--owe"})` })));
    }))));

  /* add expense */
  const xerr = h("p", { class: "err", hidden: true });
  const rateHint = h("span", { class: "muted", style: "font-size:12px;font-weight:400" });
  const rateWrap = h("label", { class: "grow", hidden: true }, "", h("input", { id: "xrate", name: "xrate", inputmode: "decimal", placeholder: "e.g. 0,027" }), rateHint);
  const syncRate = f => {
    const c = f.xccy.value; rateWrap.hidden = c === ccy; rateWrap.firstChild.textContent = `Rate: 1 ${c} = ? ${ccy}`; f.xrate.required = c !== ccy;
    const a = c === ccy ? null : autoRate(c, ccy);
    if (a) { f.xrate.value = String(a).replace(".", ","); rateHint.textContent = `ECB rate from ${new Date(fx.date).toLocaleDateString("de-AT", { day: "numeric", month: "short" })}. Change it if your bank charged a different rate.`; }
    else { f.xrate.value = ""; rateHint.textContent = c === ccy ? "" : "No automatic rate available right now. Enter it yourself."; }
  };
  const form = h("form", { class: "panel", onsubmit: async e => {
      e.preventDefault(); const f = e.target; xerr.hidden = true;
      const amount = parseNum(f.xamt.value), c = f.xccy.value, rate = c === ccy ? 1 : parseNum(f.xrate.value);
      const split = [...f.querySelectorAll("input[name=xsplit]:checked")].map(i => i.value);
      const bad = !f.xdesc.value.trim() ? "Add a short description." : !(amount > 0) ? "Enter an amount above zero." : !(rate > 0) ? `Enter how many ${ccy} one ${c} is worth.` : !split.length ? "Pick at least one person to split with." : null;
      if (bad) { xerr.hidden = false; xerr.textContent = bad; return; }
      const btn = f.querySelector("button[type=submit]"); btn.disabled = true;
      try { await setDoc(doc(db, "trips", t.id, "expenses", rid()), { desc: f.xdesc.value.trim(), amount, currency: c, rate, paidBy: f.xpaid.value, split, at: Date.now(), by: mine });
        f.reset(); syncRate(f); toast("Expense added"); }
      catch { xerr.hidden = false; xerr.textContent = "Couldn't save the expense. Try again."; }
      btn.disabled = false;
    } },
    h("h2", { text: "Add an expense" }),
    h("div", { class: "row" },
      h("label", { class: "grow" }, "What for", h("input", { id: "xdesc", name: "xdesc", placeholder: "Dinner in Karaköy", maxlength: 80 })),
      h("label", { style: "flex:0 1 120px" }, "Amount", h("input", { id: "xamt", name: "xamt", inputmode: "decimal", placeholder: "0,00" })),
      h("label", { style: "flex:0 0 96px" }, "Currency", h("select", { id: "xccy", name: "xccy", onchange: e => syncRate(e.target.form) }, CURRENCIES.map(c => h("option", { value: c, selected: c === ccy }, c))))),
    h("div", { class: "row" }, rateWrap,
      h("label", { class: "grow" }, "Paid by", h("select", { id: "xpaid", name: "xpaid" }, ids.map(id => h("option", { value: id, selected: id === mine }, memberName(t, id) + (id === mine ? " (you)" : "")))))),
    h("div", {}, h("h3", { text: "Split equally between", style: "margin-bottom:6px" }),
      h("div", { class: "checks" }, ids.map(id => h("label", {}, h("input", { type: "checkbox", name: "xsplit", value: id, checked: true, id: "xs-" + id }), memberName(t, id))))),
    h("div", { class: "row", style: "justify-content:flex-end" }, h("button", { class: "primary", type: "submit" }, "Add expense")), xerr);
  out.push(form);

  /* expenses */
  out.push(h("div", { class: "panel" }, h("h2", { text: "Expenses" }),
    cur.expenses.length ? h("div", { class: "list" }, cur.expenses.map(e => {
      const base = Math.round(e.amount * (e.rate || 1) * 100);
      return h("div", { class: "li" }, h("b", { text: e.desc }),
        h("span", { class: "act" }, h("span", { class: "num", text: fmt(e.amount, e.currency) }),
          h("button", { class: "ghost", "aria-label": "Delete " + e.desc, title: "Delete", onclick: async ev => {
            const b = ev.currentTarget;
            if (b.dataset.sure) { await deleteDoc(doc(db, "trips", t.id, "expenses", e.id)); toast("Expense deleted"); }
            else { b.dataset.sure = "1"; b.textContent = "Delete?"; setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = "✕"; } }, 3000); }
          } }, "✕")),
        h("span", { class: "sub", text: `${memberName(t, e.paidBy)} paid · split ${e.split.length} ways${e.currency !== ccy ? ` · ${money(base, ccy)} at ${e.rate}` : ""} · ${new Date(e.at).toLocaleDateString("de-AT", { day: "numeric", month: "short" })}` }));
    })) : h("div", { class: "empty", text: "No expenses yet. Add the first one above, like the hotel or a dinner." })));

  /* people & invite */
  const gform = h("form", { class: "row", onsubmit: async e => { e.preventDefault(); const n = e.target.gname.value.trim(); if (!n) return; await addMember(n, false); e.target.reset(); toast(n + " added"); } },
    h("label", { class: "grow" }, "Add someone who hasn't joined yet", h("input", { id: "gname", name: "gname", placeholder: "Name", maxlength: 30 })), h("button", { type: "submit" }, "Add"));
  const link = inviteLink(t.code);
  out.push(h("div", { class: "panel" }, h("h2", { text: "People" }),
    h("div", { class: "chips" }, ids.map(id => h("span", { class: "chip" + (id === mine ? " you" : "") }, memberName(t, id), !t.members[id].uid ? h("small", { text: "not joined" }) : null))),
    h("div", {}, h("h3", { text: "Invite", style: "margin-bottom:6px" }),
      h("p", {}, "Send friends this link. They sign in with Google and pick their name. Code: ", h("b", { class: "num", text: t.code })),
      h("div", { class: "row", style: "margin-top:10px" },
        h("button", { class: "primary", onclick: async () => {
          const text = `Join "${t.name}" on MoneTrip – strenge Rechnung, gute Freunde.`;
          if (navigator.share) { try { await navigator.share({ title: "MoneTrip", text, url: link }); return; } catch (e) { if (e.name === "AbortError") return; } }
          try { await navigator.clipboard.writeText(text + " " + link); toast("Invite link copied"); } catch { toast(link); }
        } }, "Share invite link"))),
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
      : h("button", { class: "ghost", style: "align-self:center;color:var(--owe)", onclick: () => { ui.confirmDelete = t.id; render(); } }, "Delete trip"));
  }
  return out;
}

/* ---------- boot ---------- */
loadRates();
onAuthStateChanged(auth, async user => {
  me = user; unsubTrips?.(); trips = [];
  if (!me) { render(); return; }
  watchTrips();
  const j = location.hash.match(/^#join-([A-Za-z0-9]{6})$/), tm = location.hash.match(/^#trip-([a-z0-9]+)$/);
  if (j) { try { await joinByCode(j[1]); } catch (e) { render(); toast(e.message?.startsWith("No trip") ? e.message : "Couldn't join that trip."); } }
  else if (tm) openTrip(tm[1]);
  else render();
});
