// UI strings for MoneTrip. English is the default; German is picked when the browser
// prefers it, and the header toggle overrides both (remembered on this device).
// Values can be plain strings with {placeholders}, or {one, other} for plurals (pass {n}).

const DICT = {
  en: {
    "lang.switch": "DE", "lang.switchTitle": "Auf Deutsch wechseln",
    "brand.tag": "Freunde & Moneten",
    loading: "Loading…", someone: "Someone", you: "you", youSuffix: " (you)",
    undo: "Undo", save: "Save", cancel: "Cancel", close: "Close", add: "Add", copy: "Copy", share: "Share…", auto: "Auto",
    today: "Today", yesterday: "Yesterday",

    "err.loadTrips": "Couldn't load trips. Reload the page.",
    "err.noCode": "No trip has that code. Check the six characters and try again.",
    "err.noCodeDeleted": "No trip has that code. It may have been deleted.",
    "err.join": "Couldn't join that trip. Try again.",
    "err.joinShort": "Couldn't join that trip.",

    "auth.signInFailed": "Sign-in didn't finish. Try again.",
    "auth.saved": "Saved. You can now sign in with Google on any device.",
    "auth.googleInUse": "That Google account already uses MoneTrip. Sign out and sign in with Google instead.",
    "auth.googleFailed": "Couldn't connect Google. Try again.",
    "auth.signOut": "Sign out", "auth.signOutSure": "Sure? You'll lose access",
    "auth.guest": "Guest", "auth.guestSuffix": " · guest",
    "auth.saveWithGoogle": "Save with Google", "auth.signInGoogle": "Sign in with Google",
    "theme.label": "Theme", "theme.system": "System", "theme.light": "Light", "theme.dark": "Dark",

    "signin.needName": "Enter your first name.",
    "signin.needCode": "Enter the six-character trip code.",
    "signin.guestOff": "Guest sign-in is switched off for MoneTrip. Ask the trip owner to enable it, or sign in with Google.",
    "signin.offline": "No connection. Check your internet and try again.",
    "signin.guestFailed": "Couldn't join as a guest ({code}). Try again, or sign in with Google.",
    "signin.unknownError": "unknown error",
    "signin.joinAsGuest": "Join as a guest", "signin.gotCode": "Got a trip code?",
    "signin.justName": "Just your first name. No account needed.",
    "signin.firstName": "First name", "signin.namePh": "Anna",
    "signin.orGoogle": "Or use your Google account", "signin.startOwn": "Start your own trip",
    "signin.anyDevice": "Then you can open the trip on any device.",
    "signin.signInToCreate": "Sign in to create trips and invite friends.",
    "signin.invited": "You're invited to a trip",
    "signin.headline": "Split trip costs without the awkward maths",
    "signin.pitch": "Log who paid what, in any currency. When the trip is over, MoneTrip works out who pays whom, with as few transfers as possible.",

    "home.createFailed": "Couldn't create the trip. Check your connection and try again.",
    "home.newTrip": "New trip", "home.tripName": "Trip name", "home.tripNamePh": "Edinburgh, November",
    "home.homeCcy": "Home currency", "home.homeCcyHint": "Everyone settles up in this",
    "home.tripCcy": "Trip currency", "home.tripCcyHint": "What you'll mostly pay in",
    "home.yourName": "Your name on this trip", "home.create": "Create trip",
    "home.joinTitle": "Join with a trip code",
    "home.joinHint": "Got an invite? Enter the six-character code, or just open the invite link.",
    "home.settled": " · settled",
    "home.empty": "No trips yet. Create one below, or join a friend's trip with their code.",
    "home.guestNote": "You're using MoneTrip as a guest, so you can join trips but not create them. Save your account with Google to start your own.",
    "home.yourTrips": "Your trips",
    tripCode: "Trip code", joinTrip: "Join trip", codePh: "K7Q2MX",
    people: { one: "{n} person", other: "{n} people" },
    expenses: { one: "{n} expense", other: "{n} expenses" },

    "trip.allTrips": "← All trips",
    "trip.missing": "This trip doesn't exist or you're not on it. Ask for a new invite link.",
    "trip.loading": "Loading trip…",
    "trip.renamed": "Trip renamed", "trip.renameFailed": "Couldn't rename the trip. Try again.",
    "trip.rename": "Rename trip", "trip.label": "Trip",
    "trip.total": "Total ", "trip.payingIn": "Paying in {c} · ", "trip.settlesIn": "Settles in {c}",
    "trip.welcome": "Welcome, {name}!", "trip.addFailed": "Couldn't add you. Pick your name below.",
    "trip.adding": "Adding you to the trip…",
    "trip.joinNew": "Join as a new person", "trip.join": "Join",
    "trip.whoAreYou": "Which one are you?", "trip.imName": "I'm {name}",

    "pay.youPay": "You pay ", "pay.paysYou": " pays you", "pay.markPaid": "Mark paid",
    "pay.recorded": "Payment recorded", "pay.allSettled": "All settled up 🎉", "pay.undone": "Payment undone",
    "pay.undoFailed": "Couldn't undo. Delete the payment from the list instead.",
    "pay.failed": "Couldn't record the payment. Try again.",
    "pay.title": "Pay back", "pay.left": { one: "{n} transfer left", other: "{n} transfers left" },
    "pay.close": "Close pay back", "pay.closed": "Pay back closed",
    "pay.restoreFailed": "Couldn't bring it back. Tap Settle up instead.",
    "pay.closeFailed": "Couldn't close it. Try again.",
    "pay.stale": "Expenses changed after this plan was made. Settle up again to update it.",
    "pay.howItWorks": "Marking a transfer as paid adds it to the expenses as a payment, so you can settle one at a time.",
    "pay.allEven": "Everyone is even. Nobody needs to pay anything.",
    "pay.yourList": "Your list", "pay.youEven": "You're even. Nothing to pay or collect.", "pay.others": "Everyone else",

    "bal.title": "Balances",
    "bal.done": { one: "Done: {n} transfer settles everything", other: "Done: {n} transfers settle everything" },
    "bal.alreadyEven": "Everyone is already even", "bal.saveFailed": "Couldn't save the plan. Try again.",
    "bal.settle": "Settle up", "bal.settleAgain": "Settle up again",
    "bal.paidShare": "paid {paid} · share {share}",

    "x.noRate": "No automatic rate right now. Enter the rate your bank used.",
    "x.rate": "Exchange rate", "x.chooseIcon": "Choose an icon", "x.icons": "Icons",
    "x.emojiPh": "Or type any emoji…", "x.emoji": "Type an emoji",
    "x.needDesc": "Add a short description.", "x.needAmount": "Enter an amount above zero.",
    "x.needRate": "Enter how many {ccy} one {c} is worth.", "x.needSplit": "Pick at least one person to split with.",
    "x.updated": "Expense updated", "x.added": "Expense added", "x.saveFailed": "Couldn't save the expense. Try again.",
    "x.editTitle": "Edit expense", "x.addTitle": "Add an expense",
    "x.whatFor": "What for", "x.descPh": "Dinner, taxi, hotel…", "x.amount": "Amount", "x.currency": "Currency",
    "x.paidBy": "Paid by", "x.date": "Date", "x.for": "For", "x.splitBetween": "Split equally between",
    "x.saveChanges": "Save changes", "x.add": "Add expense", "x.addShort": "Add", "x.saveShort": "Save",
    "x.nobody": "Nobody yet", "x.everyone": "Everyone ({n})", "x.justYou": "Just you",

    "list.title": "Expenses",
    "list.swipeBoth": "Swipe ← to delete · → to edit yours", "list.swipeDel": "Swipe ← to delete",
    "list.ariaEdit": "Press E to edit, ", "list.ariaDel": "Delete key to delete.",
    "list.paymentSub": "Payment from settle up",
    "list.paidSplit": { one: "{name} paid · just for one", other: "{name} paid · split {n} ways" },
    "list.converted": " · {amount}",
    "list.delete": "Delete", "list.edit": "Edit",
    "x.deleted": "Expense deleted", "x.restored": "Expense restored", "x.restoreFailed": "Couldn't restore it.",
    "x.deleteFailed": "Couldn't delete the expense. Try again.",
    "list.empty": "No expenses yet. Add the first one above, like the hotel or a dinner.",

    "guest.confirmTitle": "Are you {name}?", "guest.confirmBody": "This phone is still signed in as the guest {name}. Continue only if that's you; otherwise join with your own name.", "guest.continueAs": "Yes, I'm {name}", "guest.someoneElse": "No, I'm someone else",
    "ppl.remove": "Remove {name}", "ppl.removeSure": "Remove?", "ppl.removed": "{name} removed", "ppl.removeFailed": "Couldn't remove them. Try again.", "ppl.inExpenses": "{name} is in {n} expense(s). Delete those or take {name} out of them first.",
    "ppl.added": "{name} added", "ppl.nameTaken": "There's already a {name} on this trip. Use another name, e.g. with an initial.", "ppl.addLabel": "Add someone who hasn't joined yet", "ppl.namePh": "Name",
    "ppl.title": "People", "ppl.notJoined": "not joined", "ppl.invite": "Invite", "ppl.inviteLink": "Invite link",
    "ppl.copied": "Link copied", "ppl.holdToCopy": "Tap and hold to copy", "ppl.switch": "Not you? Switch person",

    "del.title": "Delete {name}?",
    "del.body": "This removes the trip{extra} for everyone on it. This can't be undone.",
    "del.extra": { one: " and its {n} expense", other: " and its {n} expenses" },
    "del.deleting": "Deleting…", "del.button": "Delete trip", "del.done": "{name} deleted",
    "del.failed": "Couldn't delete the trip. Try again.",
    "legal.imprint": "Imprint", "legal.privacy": "Privacy", "legal.back": "← Back",
  },

  de: {
    "lang.switch": "EN", "lang.switchTitle": "Switch to English",
    "brand.tag": "Freunde & Moneten",
    loading: "Wird geladen…", someone: "Jemand", you: "du", youSuffix: " (du)",
    undo: "Rückgängig", save: "Speichern", cancel: "Abbrechen", close: "Schließen", add: "Hinzufügen", copy: "Kopieren", share: "Teilen…", auto: "Auto",
    today: "Heute", yesterday: "Gestern",

    "err.loadTrips": "Reisen konnten nicht geladen werden. Bitte lade die Seite neu.",
    "err.noCode": "Zu diesem Code gibt es keine Reise. Prüf die sechs Zeichen und probier es nochmal.",
    "err.noCodeDeleted": "Zu diesem Code gibt es keine Reise. Vielleicht wurde sie gelöscht.",
    "err.join": "Beitreten hat nicht geklappt. Bitte nochmal versuchen.",
    "err.joinShort": "Beitreten hat nicht geklappt.",

    "auth.signInFailed": "Anmeldung abgebrochen. Bitte nochmal versuchen.",
    "auth.saved": "Gesichert! Ab jetzt kannst du dich auf jedem Gerät mit Google anmelden.",
    "auth.googleInUse": "Dieses Google-Konto ist schon bei MoneTrip. Melde dich ab und dann direkt mit Google an.",
    "auth.googleFailed": "Verbindung mit Google hat nicht geklappt. Bitte nochmal versuchen.",
    "auth.signOut": "Abmelden", "auth.signOutSure": "Sicher? Als Gast kommst du dann nicht mehr rein",
    "auth.guest": "Gast", "auth.guestSuffix": " · Gast",
    "auth.saveWithGoogle": "Mit Google sichern", "auth.signInGoogle": "Mit Google anmelden",
    "theme.label": "Design", "theme.system": "System", "theme.light": "Hell", "theme.dark": "Dunkel",

    "signin.needName": "Bitte gib deinen Vornamen ein.",
    "signin.needCode": "Bitte gib den sechsstelligen Code ein.",
    "signin.guestOff": "Der Gastzugang ist gerade ausgeschaltet. Melde dich bitte mit Google an.",
    "signin.offline": "Keine Internetverbindung. Prüf dein Netz und probier es nochmal.",
    "signin.guestFailed": "Beitreten als Gast hat nicht geklappt ({code}). Probier es nochmal oder melde dich mit Google an.",
    "signin.unknownError": "unbekannter Fehler",
    "signin.joinAsGuest": "Als Gast mitmachen", "signin.gotCode": "Code bekommen?",
    "signin.justName": "Nur dein Vorname, kein Konto nötig.",
    "signin.firstName": "Vorname", "signin.namePh": "Anna",
    "signin.orGoogle": "Oder mit Google anmelden", "signin.startOwn": "Eigene Reise starten",
    "signin.anyDevice": "Dann hast du die Reise auf all deinen Geräten.",
    "signin.signInToCreate": "Melde dich an, um Reisen anzulegen und Freunde einzuladen.",
    "signin.invited": "Du bist eingeladen!",
    "signin.headline": "Reisekosten teilen, ohne Kopfrechnen",
    "signin.pitch": "Tragt ein, wer was bezahlt hat, egal in welcher Währung. Am Ende rechnet MoneTrip aus, wer wem wie viel schuldet, mit möglichst wenigen Überweisungen.",

    "home.createFailed": "Die Reise konnte nicht angelegt werden. Prüf deine Verbindung und probier es nochmal.",
    "home.newTrip": "Neue Reise", "home.tripName": "Name", "home.tripNamePh": "Toskana im Mai",
    "home.homeCcy": "Abrechnen in", "home.homeCcyHint": "Darin begleicht ihr am Ende alles",
    "home.tripCcy": "Bezahlen in", "home.tripCcyHint": "Die Währung vor Ort",
    "home.yourName": "Dein Name in der Gruppe", "home.create": "Reise anlegen",
    "home.joinTitle": "Mit Code beitreten",
    "home.joinHint": "Eingeladen worden? Gib den sechsstelligen Code ein oder öffne einfach den Link aus der Einladung.",
    "home.settled": " · abgerechnet",
    "home.empty": "Noch keine Reisen. Leg unten eine an oder tritt mit einem Code bei.",
    "home.guestNote": "Als Gast kannst du Reisen beitreten, aber keine eigenen anlegen. Sichere dein Konto mit Google, dann kannst du selbst Reisen starten.",
    "home.yourTrips": "Reisen",
    tripCode: "Reisecode", joinTrip: "Beitreten", codePh: "K7Q2MX",
    people: { one: "{n} Person", other: "{n} Personen" },
    expenses: { one: "{n} Ausgabe", other: "{n} Ausgaben" },

    "trip.allTrips": "← Alle Reisen",
    "trip.missing": "Diese Reise gibt es nicht, oder du bist nicht dabei. Lass dir einen neuen Einladungslink schicken.",
    "trip.loading": "Reise wird geladen…",
    "trip.renamed": "Umbenannt", "trip.renameFailed": "Umbenennen hat nicht geklappt. Bitte nochmal versuchen.",
    "trip.rename": "Umbenennen", "trip.label": "Reise",
    "trip.total": "Gesamt ", "trip.payingIn": "Vor Ort {c} · ", "trip.settlesIn": "Abrechnung in {c}",
    "trip.welcome": "Willkommen, {name}!", "trip.addFailed": "Das hat nicht geklappt. Wähl unten deinen Namen aus.",
    "trip.adding": "Du wirst hinzugefügt…",
    "trip.joinNew": "Oder neu dazukommen als", "trip.join": "Beitreten",
    "trip.whoAreYou": "Wer bist du?", "trip.imName": "Ich bin {name}",

    "pay.youPay": "Du zahlst ", "pay.paysYou": " zahlt dir", "pay.markPaid": "Erledigt",
    "pay.recorded": "Rückzahlung eingetragen", "pay.allSettled": "Alles beglichen 🎉", "pay.undone": "Rückzahlung entfernt",
    "pay.undoFailed": "Rückgängig machen ging nicht. Lösch die Rückzahlung einfach aus der Liste.",
    "pay.failed": "Die Rückzahlung konnte nicht eingetragen werden. Bitte nochmal versuchen.",
    "pay.title": "Wer zahlt wem", "pay.left": { one: "noch {n} offen", other: "noch {n} offen" },
    "pay.close": "Ausblenden", "pay.closed": "Ausgeblendet",
    "pay.restoreFailed": "Konnte nicht wiederhergestellt werden. Tipp einfach nochmal auf „Abrechnen“.",
    "pay.closeFailed": "Ausblenden hat nicht geklappt. Bitte nochmal versuchen.",
    "pay.stale": "Seit dieser Abrechnung hat sich bei den Ausgaben etwas geändert. Rechne neu ab, um sie zu aktualisieren.",
    "pay.howItWorks": "Tippst du auf „Erledigt“, landet die Überweisung als Rückzahlung bei den Ausgaben. So könnt ihr Schritt für Schritt begleichen.",
    "pay.allEven": "Alle sind quitt. Niemand muss etwas zahlen.",
    "pay.yourList": "Deine Überweisungen", "pay.youEven": "Du bist quitt: Du musst nichts zahlen und bekommst nichts.", "pay.others": "Die anderen",

    "bal.title": "Saldo",
    "bal.done": { one: "Fertig! Eine Überweisung reicht", other: "Fertig! {n} Überweisungen reichen" },
    "bal.alreadyEven": "Alle sind schon quitt", "bal.saveFailed": "Die Abrechnung konnte nicht gespeichert werden. Bitte nochmal versuchen.",
    "bal.settle": "Abrechnen", "bal.settleAgain": "Neu abrechnen",
    "bal.paidShare": "bezahlt {paid} · Anteil {share}",

    "x.noRate": "Gerade kein automatischer Kurs verfügbar. Trag den Kurs deiner Bank ein.",
    "x.rate": "Wechselkurs", "x.chooseIcon": "Symbol wählen", "x.icons": "Symbole",
    "x.emojiPh": "Oder ein beliebiges Emoji…", "x.emoji": "Emoji eingeben",
    "x.needDesc": "Schreib kurz dazu, wofür.", "x.needAmount": "Der Betrag muss größer als null sein.",
    "x.needRate": "Wie viel {ccy} ist ein {c} wert?", "x.needSplit": "Wähl mindestens eine Person aus.",
    "x.updated": "Gespeichert", "x.added": "Eingetragen", "x.saveFailed": "Speichern hat nicht geklappt. Bitte nochmal versuchen.",
    "x.editTitle": "Ausgabe bearbeiten", "x.addTitle": "Neue Ausgabe",
    "x.whatFor": "Wofür?", "x.descPh": "Abendessen, Taxi, Hotel…", "x.amount": "Betrag", "x.currency": "Währung",
    "x.paidBy": "Wer hat bezahlt?", "x.date": "Wann?", "x.for": "Für wen?", "x.splitBetween": "Gleichmäßig aufteilen auf",
    "x.saveChanges": "Speichern", "x.add": "Eintragen", "x.addShort": "Eintragen", "x.saveShort": "Speichern",
    "x.nobody": "Noch niemand", "x.everyone": "Alle ({n})", "x.justYou": "Nur du",

    "list.title": "Ausgaben",
    "list.swipeBoth": "← Löschen · → Bearbeiten", "list.swipeDel": "← Löschen",
    "list.ariaEdit": "E zum Bearbeiten, ", "list.ariaDel": "Entf zum Löschen.",
    "list.paymentSub": "Rückzahlung",
    "list.paidSplit": { one: "{name} · für eine Person", other: "{name} · für {n} Personen" },
    "list.converted": " · {amount}",
    "list.delete": "Löschen", "list.edit": "Bearbeiten",
    "x.deleted": "Ausgabe gelöscht", "x.restored": "Wiederhergestellt", "x.restoreFailed": "Wiederherstellen hat nicht geklappt.",
    "x.deleteFailed": "Löschen hat nicht geklappt. Bitte nochmal versuchen.",
    "list.empty": "Noch keine Ausgaben. Trag gleich die erste ein, zum Beispiel das Hotel oder ein Abendessen.",

    "guest.confirmTitle": "Bist du {name}?", "guest.confirmBody": "Dieses Handy ist noch als Gast {name} angemeldet. Mach nur weiter, wenn du das bist – sonst tritt mit deinem eigenen Namen bei.", "guest.continueAs": "Ja, ich bin {name}", "guest.someoneElse": "Nein, ich bin jemand anderes",
    "ppl.remove": "{name} entfernen", "ppl.removeSure": "Entfernen?", "ppl.removed": "{name} entfernt", "ppl.removeFailed": "Entfernen hat nicht geklappt. Versuch es nochmal.", "ppl.inExpenses": "{name} steckt noch in {n} Ausgabe(n). Lösch diese oder nimm {name} dort zuerst raus.",
    "ppl.added": "{name} hinzugefügt", "ppl.nameTaken": "{name} gibt es auf dieser Reise schon. Nimm einen anderen Namen, z. B. mit Initiale.", "ppl.addLabel": "Jemanden hinzufügen, der noch nicht dabei ist", "ppl.namePh": "Name",
    "ppl.title": "Mitreisende", "ppl.notJoined": "noch nicht dabei", "ppl.invite": "Einladen", "ppl.inviteLink": "Einladungslink",
    "ppl.copied": "Link kopiert", "ppl.holdToCopy": "Zum Kopieren lange drücken", "ppl.switch": "Nicht du? Person wechseln",

    "del.title": "„{name}“ löschen?",
    "del.body": "Das löscht die Reise{extra} für alle Mitreisenden und lässt sich nicht rückgängig machen.",
    "del.extra": { one: " samt ihrer einen Ausgabe", other: " samt allen {n} Ausgaben" },
    "del.deleting": "Wird gelöscht…", "del.button": "Reise löschen", "del.done": "„{name}“ gelöscht",
    "del.failed": "Löschen hat nicht geklappt. Bitte nochmal versuchen.",
    "legal.imprint": "Impressum", "legal.privacy": "Datenschutz", "legal.back": "← Zurück",
  },
};

export const LANGS = Object.keys(DICT);
const LOCALES = { en: "en-GB", de: "de-AT" };
const KEY = "mt-lang";

function detect() {
  try { const s = localStorage.getItem(KEY); if (DICT[s]) return s; } catch {}
  for (const l of navigator.languages || [navigator.language || ""]) {
    const base = String(l).toLowerCase().split("-")[0];
    if (DICT[base]) return base;
  }
  return "en";
}

export let lang = detect();
let plural = new Intl.PluralRules(LOCALES[lang]);
document.documentElement.lang = lang;

export function setLang(l) {
  if (!DICT[l]) return;
  lang = l; plural = new Intl.PluralRules(LOCALES[l]);
  document.documentElement.lang = l;
  try { localStorage.setItem(KEY, l); } catch {}
}

// Locale for numbers, currencies, dates and sorting.
export const locale = () => LOCALES[lang];
export const decimalSep = () => (1.5).toLocaleString(LOCALES[lang]).charAt(1);

export function t(key, vars = {}) {
  let v = DICT[lang][key] ?? DICT.en[key] ?? key;
  if (typeof v === "object") v = v[plural.select(vars.n ?? 0)] ?? v.other;
  return v.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}
