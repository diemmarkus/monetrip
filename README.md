# MoneTrip

*Freunde & Moneten*

Split trip expenses with friends. Create a trip, invite people with a link, log expenses in any currency (default EUR, with ECB exchange rates filled in automatically), and press **Settle up** to get the payback plan with the fewest possible transfers.

## Stack

- Static site on GitHub Pages: `index.html`, `style.css`, `app.js`, `settle.js`
- Firebase Authentication (Google sign-in) and Cloud Firestore for shared data
- Exchange rates from the ECB via [Frankfurter](https://frankfurter.dev)
- Self-hosted fonts in `fonts/` (Bricolage Grotesque, Figtree, JetBrains Mono; SIL Open Font License)
- English and German UI (`i18n.js`); imprint and privacy policy in `legal.js`

## Setup

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. **Build → Authentication → Get started → Google** → enable.
3. **Authentication → Settings → Authorized domains** → add `<your-username>.github.io`.
4. **Build → Firestore Database → Create database** (production mode, region `europe-west3` Frankfurt).
5. **Firestore → Rules** → paste `firestore.rules` → Publish.
6. **Project settings → Your apps → Web (`</>`)** → register an app, copy the config into `firebase-config.js`.
7. Repo **Settings → Pages** → Deploy from branch `main`, folder `/`.

## How settling works

Each expense is converted to the trip currency and split equally (to the cent) between the chosen people. Balances are then partitioned into the largest number of groups that sum to zero; a group of *k* people needs *k − 1* transfers, so this gives the minimum number of transfers overall. It is exact for up to 18 people with a non-zero balance and falls back to a greedy match beyond that.
