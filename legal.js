// Imprint (Impressum) and privacy policy, in English and German.
// Operator details below. This is a template, not legal advice.

export const OPERATOR = {
  name: "Markus Diem",
  street: "Leitgebgasse 7/25",
  city: "1050 Wien",
  country: "AT",          // "AT" (Austria) or "DE" (Germany): picks the legal references below
  email: "diemmarkus@gmail.com",
  firestoreRegion: "europe-west3 (Frankfurt)",
};

const COUNTRY = { AT: { en: "Austria", de: "Österreich" }, DE: { en: "Germany", de: "Deutschland" } };

const AUTHORITY = {
  AT: {
    en: "the Austrian Data Protection Authority (Datenschutzbehörde), Barichgasse 40–42, 1030 Vienna, dsb.gv.at",
    de: "der österreichischen Datenschutzbehörde, Barichgasse 40–42, 1030 Wien, dsb.gv.at",
  },
  DE: {
    en: "the data protection authority of your federal state, or any other EU supervisory authority",
    de: "der Datenschutzaufsichtsbehörde deines Bundeslandes oder jeder anderen Aufsichtsbehörde in der EU",
  },
};

// Storage on the device that the app needs to work. Strictly necessary, so no consent banner is needed
// (§ 165 (3) TKG 2021 in Austria, § 25 (2) TDDDG in Germany). Keep this list in sync with the code.
const STORAGE = [
  ["Firebase (IndexedDB)", "keeps you signed in", "hält dich angemeldet"],
  ["mt-lang", "your language choice", "deine Sprachwahl"],
  ["mt-home", "your last home currency", "deine zuletzt gewählte Heimwährung"],
  ["mt-fx", "cached exchange rates (6 hours)", "zwischengespeicherte Wechselkurse (6 Stunden)"],
  ["monetrip.icons", "icons you picked for expense descriptions", "Symbole, die du für Ausgaben gewählt hast"],
];

function imprint(l) {
  const o = OPERATOR, c = COUNTRY[o.country]?.[l] || "";
  const addr = [o.name, o.street, o.city + (c ? ", " + c : "")];
  const basis = o.country === "DE"
    ? (l === "de" ? "Angaben gemäß § 5 DDG und § 18 Abs. 2 MStV" : "Information under § 5 DDG and § 18 (2) MStV")
    : (l === "de" ? "Informationen gemäß § 5 ECG und Offenlegung gemäß § 25 MedienG" : "Information under § 5 ECG and disclosure under § 25 MedienG");
  return l === "de" ? {
    title: "Impressum",
    sections: [
      { h: "Betreiber", p: [basis, ...addr, "E-Mail: " + o.email] },
      { h: "Zweck", p: ["MoneTrip ist ein privates, nicht kommerzielles Projekt zum Aufteilen von Reisekosten unter Freunden. Es gibt keine Werbung und keine kostenpflichtigen Funktionen."] },
      ...(o.country === "AT" ? [{ h: "Grundlegende Richtung", p: ["Werkzeug zum gemeinsamen Erfassen und Abrechnen von Reiseausgaben. Keine redaktionellen Inhalte."] }] : []),
      ...(o.country === "DE" ? [{ h: "Verantwortlich für den Inhalt", p: [o.name + ", Anschrift wie oben"] }] : []),
      { h: "Haftung", p: ["Wechselkurse stammen von der Europäischen Zentralbank (über Frankfurter) und dienen nur zur Orientierung. Alle Beträge ohne Gewähr. Für Inhalte verlinkter Seiten sind deren Betreiber verantwortlich."] },
    ],
  } : {
    title: "Imprint",
    sections: [
      { h: "Operator", p: [basis, ...addr, "Email: " + o.email] },
      { h: "Purpose", p: ["MoneTrip is a private, non-commercial project for splitting trip costs among friends. There are no ads and no paid features."] },
      ...(o.country === "AT" ? [{ h: "Editorial line", p: ["A tool for logging and settling shared trip expenses. No editorial content."] }] : []),
      ...(o.country === "DE" ? [{ h: "Responsible for content", p: [o.name + ", address as above"] }] : []),
      { h: "Liability", p: ["Exchange rates come from the European Central Bank (via Frankfurter) and are for guidance only. All amounts without guarantee. Operators of linked sites are responsible for their content."] },
    ],
  };
}

function privacy(l) {
  const o = OPERATOR, c = COUNTRY[o.country]?.[l] || "", auth = AUTHORITY[o.country]?.[l] || AUTHORITY.DE[l];
  const contact = `${o.name}, ${o.street}, ${o.city}${c ? ", " + c : ""}, ${o.email}`;
  const storage = STORAGE.map(([k, en, de]) => `• ${k}: ${l === "de" ? de : en}`);
  return l === "de" ? {
    title: "Datenschutzerklärung",
    sections: [
      { h: "Verantwortlicher", p: [contact] },
      { h: "Kurz gesagt", p: ["MoneTrip speichert nur, was zum Aufteilen eurer Reisekosten nötig ist. Kein Tracking, keine Analyse-Tools, keine Werbung, kein Verkauf von Daten."] },
      { h: "Welche Daten wir verarbeiten", p: [
        "Konto: Wenn du dich mit Google anmeldest, erhalten wir deinen Namen, deine E-Mail-Adresse, dein Profilbild und eine technische Nutzer-ID von Google. Als Gast speichern wir nur den Vornamen, den du eingibst, und eine anonyme Nutzer-ID.",
        "Reisen: Reisename, Währungen, Reisecode, die Namen der Mitreisenden sowie Ausgaben (Beschreibung, Betrag, Währung, Kurs, Datum, wer bezahlt hat und für wen) und erfasste Rückzahlungen.",
        "Alle Mitglieder einer Reise sehen diese Reisedaten, einschließlich deines Namens. Wer den Einladungslink oder Reisecode hat, kann der Reise beitreten.",
      ] },
      { h: "Zweck und Rechtsgrundlage", p: [
        "Wir verarbeiten diese Daten, um dir die App bereitzustellen, die du nutzen willst (Art. 6 Abs. 1 lit. b DSGVO). Server-Protokolle beim Hosting dienen dem sicheren Betrieb (berechtigtes Interesse, Art. 6 Abs. 1 lit. f DSGVO).",
      ] },
      { h: "Dienste, die wir nutzen", p: [
        `Firebase Authentication und Cloud Firestore (Google Ireland Ltd., Gordon House, Barrow Street, Dublin 4, Irland): Anmeldung und Speicherung der Reisedaten. Die Datenbank liegt in der Region ${o.firestoreRegion}.`,
        "GitHub Pages (GitHub B.V., Niederlande, Tochter der GitHub Inc., USA): Hosting der Website. Beim Aufruf verarbeitet GitHub technisch notwendige Daten wie deine IP-Adresse.",
        "Frankfurter (frankfurter.dev): Abruf der Wechselkurse der Europäischen Zentralbank direkt aus deinem Browser; dabei wird deine IP-Adresse übermittelt.",
        "Google und GitHub sind nach dem EU-US Data Privacy Framework zertifiziert; eine Übermittlung in die USA stützt sich darauf (Art. 45 DSGVO) sowie auf Standardvertragsklauseln.",
      ] },
      { h: "Speicherung auf deinem Gerät", p: ["Schriftarten werden von MoneTrip selbst ausgeliefert, nicht von Google. MoneTrip setzt keine Tracking-Cookies. Im Browser-Speicher liegen nur Daten, die für die Funktion nötig sind:", ...storage] },
      { h: "Speicherdauer", p: [
        "Reisedaten bleiben gespeichert, bis die Person, die die Reise erstellt hat, sie löscht; dabei werden alle Ausgaben der Reise mitgelöscht. Einzelne Ausgaben können jederzeit gelöscht werden.",
        "Dein Konto und deine Daten löschen wir auf Anfrage per E-Mail.",
      ] },
      { h: "Deine Rechte", p: [
        "Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch (Art. 15–21 DSGVO). Schreib dafür einfach an " + o.email + ".",
        "Du kannst dich außerdem bei einer Aufsichtsbehörde beschweren, etwa bei " + auth + ".",
        "Es findet keine automatisierte Entscheidungsfindung oder Profilbildung statt.",
      ] },
      { h: "Stand", p: ["Oktober 2026"] },
    ],
  } : {
    title: "Privacy policy",
    sections: [
      { h: "Controller", p: [contact] },
      { h: "In short", p: ["MoneTrip stores only what it needs to split your trip costs. No tracking, no analytics, no ads, and no selling of data."] },
      { h: "What data we process", p: [
        "Account: if you sign in with Google, we receive your name, email address, profile picture and a technical user ID from Google. As a guest, we only store the first name you enter and an anonymous user ID.",
        "Trips: trip name, currencies, trip code, the names of the people on the trip, plus expenses (description, amount, currency, rate, date, who paid and for whom) and recorded repayments.",
        "Everyone on a trip can see its data, including your name. Anyone with the invite link or trip code can join the trip.",
      ] },
      { h: "Purpose and legal basis", p: [
        "We process this data to provide the app you choose to use (Art. 6 (1)(b) GDPR). Hosting server logs keep the service secure (legitimate interest, Art. 6 (1)(f) GDPR).",
      ] },
      { h: "Services we use", p: [
        `Firebase Authentication and Cloud Firestore (Google Ireland Ltd., Gordon House, Barrow Street, Dublin 4, Ireland): sign-in and storing trip data. The database is in the ${o.firestoreRegion} region.`,
        "GitHub Pages (GitHub B.V., Netherlands, a subsidiary of GitHub Inc., USA): hosting the website. When you visit, GitHub processes technically necessary data such as your IP address.",
        "Frankfurter (frankfurter.dev): fetches European Central Bank exchange rates directly from your browser, which sends your IP address.",
        "Google and GitHub are certified under the EU-US Data Privacy Framework; transfers to the USA rely on it (Art. 45 GDPR) and on standard contractual clauses.",
      ] },
      { h: "Storage on your device", p: ["Fonts are served by MoneTrip itself, not by Google. MoneTrip sets no tracking cookies. Browser storage only holds what the app needs to work:", ...storage] },
      { h: "How long we keep data", p: [
        "Trip data is kept until the person who created the trip deletes it, which also deletes all its expenses. Single expenses can be deleted at any time.",
        "We delete your account and data on request by email.",
      ] },
      { h: "Your rights", p: [
        "You have the right to access, rectification, erasure, restriction of processing, data portability and to object (Art. 15–21 GDPR). Just write to " + o.email + ".",
        "You can also lodge a complaint with a supervisory authority, for example " + auth + ".",
        "There is no automated decision-making or profiling.",
      ] },
      { h: "Last updated", p: ["October 2026"] },
    ],
  };
}

export const legalDoc = (kind, lang) => (kind === "imprint" ? imprint : privacy)(lang === "de" ? "de" : "en");
