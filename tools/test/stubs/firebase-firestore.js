const store = new Map(); const subs = new Set();
const trip = { name: "Edinburgh", currency: "EUR", localCurrency: "GBP", code: "ABC123", createdBy: "u1", createdAt: 1,
  members: { m1: { name: "Markus", uid: "u1" }, m2: { name: "Papa", uid: null }, m3: { name: "Lukas", uid: null } }, memberUids: ["u1"], settlement: null, paid: {} };
store.set("trips/t1", trip);
store.set("trips/t1/expenses/e1", { desc: "Pub", amount: 5, currency: "GBP", rate: 1.19, paidBy: "m1", split: ["m1","m2"], at: Date.now()-1e5, by: "m1", date: "2026-10-28" });
const fire = () => setTimeout(() => subs.forEach(f => f()), 0);
export const getFirestore = () => ({});
export const doc = (db, ...p) => ({ path: p.join("/") });
export const collection = (db, ...p) => ({ path: p.join("/"), coll: true });
export const query = (c) => ({ ...c, q: true });
export const where = () => ({});
const snapDoc = (path) => ({ id: path.split("/").pop(), exists: () => store.has(path), data: () => store.get(path) });
export const onSnapshot = (ref, a, b) => { const cb = typeof a === "function" ? a : b;
  const f = () => {
    if (ref.coll) {
      const pre = ref.path + "/"; const docs = [...store.keys()].filter(k => k.startsWith(pre) && !k.slice(pre.length).includes("/")).map(snapDoc);
      cb({ docs, metadata: { fromCache: false } });
    } else cb(snapDoc(ref.path));
  };
  subs.add(f); f(); return () => subs.delete(f);
};
export const getDoc = async ref => snapDoc(ref.path);
export const setDoc = async (ref, d) => { store.set(ref.path, d); fire(); await new Promise(r => setTimeout(r, 300)); };
export const updateDoc = async (ref, d) => { store.set(ref.path, { ...store.get(ref.path), ...d }); fire(); };
export const deleteDoc = async ref => { store.delete(ref.path); fire(); };
export const arrayUnion = (...a) => a;
window.__store = store; // tests can read and change the fake database
export const deleteField = () => undefined;
export class FieldPath { constructor(...a) { this.a = a; } }
window.__fire = fire;

export const initializeFirestore = () => ({});
export const persistentLocalCache = o => o;
export const persistentMultipleTabManager = () => ({});
