const user = { uid: "u1", displayName: "Lukas", isAnonymous: true, photoURL: null, email: "m@x" };
export const getAuth = () => ({});
// window.__authDelay (ms) simulates a slow sign-in check.
export const onAuthStateChanged = (a, cb) => setTimeout(() => cb(user), window.__authDelay || 0);
export class GoogleAuthProvider {}
export const signInWithPopup = async () => {}; export const signInWithRedirect = async () => {};
export const signOut = async () => {}; export const signInAnonymously = async () => {};
export const updateProfile = async () => {}; export const linkWithPopup = async () => {};
