const user = { uid: "u1", displayName: "Markus Diem", isAnonymous: false, photoURL: null, email: "m@x" };
export const getAuth = () => ({});
export const onAuthStateChanged = (a, cb) => setTimeout(() => cb(user), 0);
export class GoogleAuthProvider {}
export const signInWithPopup = async () => {}; export const signInWithRedirect = async () => {};
export const signOut = async () => {}; export const signInAnonymously = async () => {};
export const updateProfile = async () => {}; export const linkWithPopup = async () => {};
