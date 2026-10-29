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
    "x.saveChanges": "Save changes", "x.add": "Add expense",
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

    "ppl.added": "{name} added", "ppl.addLabel": "Add someone who hasn't joined yet", "ppl.namePh": "Name",
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
    loading: "Lädt…", someone: "Jemand", you: "du", youSuffix: " (du)",
    undo: "Rückgängig", save: "Speichern", cancel: "Abbrechen", close: "Schließen", add: "Hinzufügen", copy: "Kopieren", share: "Teilen…", auto: "Auto",
    today: "Heute", yesterday: "Gestern",

    "err.loadTrips": "Reisen konnten nicht geladen werden. Lade die Seite neu.",
    "err.noCode": "Keine Reise mit diesem Code. Prüf die sechs Zeichen und versuch es nochmal.",
    "err.noCodeDeleted": "Keine Reise mit diesem Code. Vielleicht wurde sie gelöscht.",
    "err.join": "Beitritt hat nicht geklappt. Versuch es nochmal.",
    "err.joinShort": "Beitritt hat nicht geklappt.",

    "auth.signInFailed": "Anmeldung nicht abgeschlossen. Versuch es nochmal.",
    "auth.saved": "Gespeichert. Du kannst dich jetzt auf jedem Gerät mit Google anmelden.",
    "auth.googleInUse": "Dieses Google-Konto nutzt MoneTrip schon. Melde dich ab und stattdessen mit Google an.",
    "auth.googleFailed": "Google konnte nicht verbunden werden. Versuch es nochmal.",
    "auth.signOut": "Abmelden", "auth.signOutSure": "Sicher? Du verlierst den Zugang",
    "auth.guest": "Gast", "auth.guestSuffix": " · Gast",
    "auth.saveWithGoogle": "Mit Google speichern", "auth.signInGoogle": "Mit Google anmelden",

    "signin.needName": "Gib deinen Vornamen ein.",
    "signin.needCode": "Gib den sechsstelligen Reisecode ein.",
    "signin.guestOff": "Gast-Anmeldung ist für MoneTrip ausgeschaltet. Bitte den Reise-Ersteller, sie zu aktivieren, oder melde dich mit Google an.",
    "signin.offline": "Keine Verbindung. Prüf dein Internet und versuch es nochmal.",
    "signin.guestFailed": "Beitritt als Gast hat nicht geklappt ({code}). Versuch es nochmal oder melde dich mit Google an.",
    "signin.unknownError": "unbekannter Fehler",
    "signin.joinAsGuest": "Als Gast beitreten", "signin.gotCode": "Du hast einen Reisecode?",
    "signin.justName": "Nur dein Vorname. Kein Konto nötig.",
    "signin.firstName": "Vorname", "signin.namePh": "Anna",
    "signin.orGoogle": "Oder nutz dein Google-Konto", "signin.startOwn": "Starte deine eigene Reise",
    "signin.anyDevice": "Dann kannst du die Reise auf jedem Gerät öffnen.",
    "signin.signInToCreate": "Melde dich an, um Reisen zu erstellen und Freunde einzuladen.",
    "signin.invited": "Du bist zu einer Reise eingeladen",
    "signin.headline": "Reisekosten teilen, ohne mühsames Nachrechnen",
    "signin.pitch": "Trag ein, wer was bezahlt hat, in jeder Währung. Nach der Reise rechnet MoneTrip aus, wer wem was zahlt, mit so wenigen Überweisungen wie möglich.",

    "home.createFailed": "Reise konnte nicht erstellt werden. Prüf deine Verbindung und versuch es nochmal.",
    "home.newTrip": "Neue Reise", "home.tripName": "Name der Reise", "home.tripNamePh": "Wien, November",
    "home.homeCcy": "Heimwährung", "home.homeCcyHint": "Darin wird abgerechnet",
    "home.tripCcy": "Reisewährung", "home.tripCcyHint": "Darin zahlt ihr meistens",
    "home.yourName": "Dein Name auf dieser Reise", "home.create": "Reise erstellen",
    "home.joinTitle": "Mit Reisecode beitreten",
    "home.joinHint": "Eingeladen? Gib den sechsstelligen Code ein oder öffne einfach den Einladungslink.",
    "home.settled": " · abgerechnet",
    "home.empty": "Noch keine Reisen. Erstell unten eine oder tritt mit dem Code einer Reise von Freunden bei.",
    "home.guestNote": "Du nutzt MoneTrip als Gast: Du kannst Reisen beitreten, aber keine erstellen. Speichere dein Konto mit Google, um eigene zu starten.",
    "home.yourTrips": "Deine Reisen",
    tripCode: "Reisecode", joinTrip: "Reise beitreten", codePh: "K7Q2MX",
    people: { one: "{n} Person", other: "{n} Personen" },
    expenses: { one: "{n} Ausgabe", other: "{n} Ausgaben" },

    "trip.allTrips": "← Alle Reisen",
    "trip.missing": "Diese Reise gibt es nicht oder du bist nicht dabei. Frag nach einem neuen Einladungslink.",
    "trip.loading": "Reise wird geladen…",
    "trip.renamed": "Reise umbenannt", "trip.renameFailed": "Reise konnte nicht umbenannt werden. Versuch es nochmal.",
    "trip.rename": "Reise umbenennen", "trip.label": "Reise",
    "trip.total": "Gesamt ", "trip.payingIn": "Zahlen in {c} · ", "trip.settlesIn": "Abrechnung in {c}",
    "trip.welcome": "Willkommen, {name}!", "trip.addFailed": "Konnte dich nicht hinzufügen. Wähl unten deinen Namen.",
    "trip.adding": "Du wirst zur Reise hinzugefügt…",
    "trip.joinNew": "Als neue Person beitreten", "trip.join": "Beitreten",
    "trip.whoAreYou": "Wer davon bist du?", "trip.imName": "Ich bin {name}",

    "pay.youPay": "Du zahlst ", "pay.paysYou": " zahlt dir", "pay.markPaid": "Bezahlt",
    "pay.recorded": "Zahlung erfasst", "pay.allSettled": "Alles beglichen 🎉", "pay.undone": "Zahlung rückgängig gemacht",
    "pay.undoFailed": "Rückgängig machen hat nicht geklappt. Lösch die Zahlung stattdessen aus der Liste.",
    "pay.failed": "Zahlung konnte nicht erfasst werden. Versuch es nochmal.",
    "pay.title": "Zurückzahlen", "pay.left": { one: "noch {n} Überweisung", other: "noch {n} Überweisungen" },
    "pay.close": "Zurückzahlen schließen", "pay.closed": "Zurückzahlen geschlossen",
    "pay.restoreFailed": "Konnte nicht zurückgeholt werden. Tipp stattdessen auf Abrechnen.",
    "pay.closeFailed": "Schließen hat nicht geklappt. Versuch es nochmal.",
    "pay.stale": "Die Ausgaben haben sich seit diesem Plan geändert. Rechne neu ab, um ihn zu aktualisieren.",
    "pay.howItWorks": "Eine als bezahlt markierte Überweisung landet als Zahlung bei den Ausgaben, so könnt ihr eine nach der anderen begleichen.",
    "pay.allEven": "Alle sind quitt. Niemand muss etwas zahlen.",
    "pay.yourList": "Deine Liste", "pay.youEven": "Du bist quitt. Nichts zu zahlen oder zu bekommen.", "pay.others": "Alle anderen",

    "bal.title": "Salden",
    "bal.done": { one: "Fertig: {n} Überweisung gleicht alles aus", other: "Fertig: {n} Überweisungen gleichen alles aus" },
    "bal.alreadyEven": "Alle sind schon quitt", "bal.saveFailed": "Plan konnte nicht gespeichert werden. Versuch es nochmal.",
    "bal.settle": "Abrechnen", "bal.settleAgain": "Neu abrechnen",
    "bal.paidShare": "bezahlt {paid} · Anteil {share}",

    "x.noRate": "Gerade kein automatischer Kurs. Gib den Kurs deiner Bank ein.",
    "x.rate": "Wechselkurs", "x.chooseIcon": "Symbol wählen", "x.icons": "Symbole",
    "x.emojiPh": "Oder tipp ein Emoji…", "x.emoji": "Emoji eingeben",
    "x.needDesc": "Füg eine kurze Beschreibung hinzu.", "x.needAmount": "Gib einen Betrag über null ein.",
    "x.needRate": "Gib an, wie viel {ccy} ein {c} wert ist.", "x.needSplit": "Wähl mindestens eine Person zum Aufteilen.",
    "x.updated": "Ausgabe aktualisiert", "x.added": "Ausgabe hinzugefügt", "x.saveFailed": "Ausgabe konnte nicht gespeichert werden. Versuch es nochmal.",
    "x.editTitle": "Ausgabe bearbeiten", "x.addTitle": "Ausgabe hinzufügen",
    "x.whatFor": "Wofür", "x.descPh": "Abendessen, Taxi, Hotel…", "x.amount": "Betrag", "x.currency": "Währung",
    "x.paidBy": "Bezahlt von", "x.date": "Datum", "x.for": "Für", "x.splitBetween": "Gleichmäßig aufteilen auf",
    "x.saveChanges": "Änderungen speichern", "x.add": "Ausgabe hinzufügen",
    "x.nobody": "Noch niemand", "x.everyone": "Alle ({n})", "x.justYou": "Nur du",

    "list.title": "Ausgaben",
    "list.swipeBoth": "← wischen zum Löschen · → deine bearbeiten", "list.swipeDel": "← wischen zum Löschen",
    "list.ariaEdit": "E zum Bearbeiten, ", "list.ariaDel": "Entf zum Löschen.",
    "list.paymentSub": "Zahlung aus der Abrechnung",
    "list.paidSplit": { one: "{name} hat bezahlt · nur für eine Person", other: "{name} hat bezahlt · durch {n} geteilt" },
    "list.converted": " · {amount}",
    "list.delete": "Löschen", "list.edit": "Bearbeiten",
    "x.deleted": "Ausgabe gelöscht", "x.restored": "Ausgabe wiederhergestellt", "x.restoreFailed": "Wiederherstellen hat nicht geklappt.",
    "x.deleteFailed": "Ausgabe konnte nicht gelöscht werden. Versuch es nochmal.",
    "list.empty": "Noch keine Ausgaben. Füg die erste hinzu, etwa das Hotel oder ein Abendessen.",

    "ppl.added": "{name} hinzugefügt", "ppl.addLabel": "Jemanden hinzufügen, der noch nicht beigetreten ist", "ppl.namePh": "Name",
    "ppl.title": "Personen", "ppl.notJoined": "nicht beigetreten", "ppl.invite": "Einladen", "ppl.inviteLink": "Einladungslink",
    "ppl.copied": "Link kopiert", "ppl.holdToCopy": "Zum Kopieren gedrückt halten", "ppl.switch": "Nicht du? Person wechseln",

    "del.title": "{name} löschen?",
    "del.body": "Damit wird die Reise{extra} für alle gelöscht. Das lässt sich nicht rückgängig machen.",
    "del.extra": { one: " samt {n} Ausgabe", other: " samt {n} Ausgaben" },
    "del.deleting": "Wird gelöscht…", "del.button": "Reise löschen", "del.done": "{name} gelöscht",
    "del.failed": "Reise konnte nicht gelöscht werden. Versuch es nochmal.",
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
