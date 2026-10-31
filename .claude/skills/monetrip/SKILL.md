---
name: monetrip
description: How MoneTrip (this repo) is built, deployed and changed safely — architecture, data model, conventions, gotchas and how to test. Read before changing anything in diemmarkus/monetrip.
---

# MoneTrip

*Freunde & Moneten.* A trip expense splitter: create a trip, invite people by link, log expenses in any
currency, press **Settle up** to get the payback plan with the fewest transfers.

- Live: https://diemmarkus.github.io/monetrip/ (GitHub Pages, branch `main`, folder `/`)
- Owner: Markus (`diemmarkus`). He tests on his phone (Android/Chrome) and usually reports with screenshots.
- No build step, no framework, no npm dependencies. Plain ES modules served as static files.

## Files

| File | What it is |
|---|---|
| `index.html` | Shell: meta/OG tags, preloads, splash screen, `#app`, `#toast`. Asset URLs carry `?v=N`. |
| `app.js` | The whole app: Firebase setup, state, views (`h()` helper builds DOM), actions. ~900 lines. |
| `settle.js` | `balances()` (equal split to the cent, payments excluded from paid/share) and `settle()` (min transfers). |
| `i18n.js` | `DICT.en` / `DICT.de`, `t(key, vars)` with plural objects `{one, other}`. Every UI string lives here. |
| `icons.js` | Keyword → emoji rules for expenses, `DEFAULT_ICON` 💰, `PICKS` for the picker. |
| `legal.js` | Imprint and privacy text (EN/DE). Operator details are Markus's real ones — required by Austrian law. |
| `style.css` | All styles; color tokens on `:root`, dark values under `prefers-color-scheme` and `[data-theme]`. |
| `sw.js` | Service worker (offline cache), see Caching. |
| `firestore.rules` | Security rules. **Not deployed by git** — Markus pastes them into the Firebase console. |
| `firebase-config.js` | Public web config for project `monetrip-2aa9b`. The apiKey is not a secret. |
| `tools/bump-version.py` | Bumps every `?v=` (index.html + module imports in app.js). Run before every commit. |
| `tools/test/` | Playwright smoke test with a fake Firebase (see Testing). |

## Data model (Cloud Firestore, region europe-west3)

`trips/{tripId}`
- `name`, `code` (6 chars, also `codes/{code} → {tripId}`), `createdBy` (uid = the trip **admin**), `createdAt`
- `currency` = home/settle currency, `localCurrency` = default currency for new expenses
- `members: { memberId: { name, uid|null } }` — a member without `uid` is "not joined" yet
- `memberUids: [uid]` — who may read the trip (rules check this)
- `settlement: { at, by, currency, count, transfers: [{ from, to, amount (cents) }] } | null`
- `iconMemory: { normalisedDesc: emoji }` — remembered icon overrides per trip

`trips/{tripId}/expenses/{id}`
- `desc, amount, currency, rate (to trip currency), paidBy (memberId), split [memberIds], date "YYYY-MM-DD", at, by, icon?, changed?`
- `kind: "payment"` = a settle-up transfer (paidBy = sender, split = [receiver]). Moves balances,
  never counts as spending (totals, day totals, paid/share).

Money inside the app is integer **cents** in the trip currency: `Math.round(amount * rate * 100)`.

## Behaviour worth knowing

- **Accounts:** Google sign-in or **guest** (anonymous auth + first name). Guests can join but not create
  trips; "Sign in with Google" links the guest account (copies Google name/photo). A remembered guest
  opening a *new* invite link is asked "Are you {name}?" so nobody lands in someone else's guest account.
- **Names are unique per trip** (case/space-insensitive, `normName`). A guest typing the name of a
  not-joined member claims that spot.
- **Admin** (`createdBy`) can rename/delete the trip and remove people — only people no expense involves.
  These admin checks are app-side; the rules still let any member update the trip document.
- **Settle up** stores a plan; **Mark paid** writes a `kind: "payment"` expense and drops that transfer;
  the rest of the plan stays valid. Plan shows a "stale" notice when expenses change afterwards.
- **Expense sheet** is a bottom sheet opened by the floating +; Add/Save sits in the pinned header.
  Swipe left = delete (with Undo), swipe right = edit (own expenses only).
- Filters on the expense list (search, person → their share, all/expenses/payments) are per device (`ui` state).
- Exchange rates: ECB via Frankfurter, cached 6 h in `localStorage["mt-fx"]`; the rate stays editable.
- Theme: Light/Dark switch in the avatar menu, preselected from the system; `localStorage["mt-theme"]`.
- Languages: EN/DE, auto-detected, switch in the avatar menu. German copy is deliberately natural, not
  literal (e.g. balances heading "Saldo") — Markus edits German wording himself; keep his phrasing.

## Caching and speed (read before touching index.html, sw.js or file names)

- **Always run `python3 tools/bump-version.py` before committing** any change to app.js, style.css or a
  module. Versioned files are served cache-first forever; a change without a new `?v=` never reaches phones,
  and a phone can end up running new `app.js` with an old `i18n.js` (showed raw keys like `theme.label`).
- `sw.js`: the page is served from cache and refreshed in the background; when it changed, the page
  reloads itself during start-up or shows "A new version is ready · Reload". Versioned assets, fonts and the
  Firebase SDK are cache-first. Data/API requests are never intercepted.
- Firestore uses `persistentLocalCache`. On top, `app.js` keeps a **start-up snapshot** (`mt-snap`) of the
  trip list / open trip and draws it before Firebase auth resolves (`html.booting` blocks taps until then).
  Cleared on sign-out. If you add fields to trips/expenses, they'll be in the snapshot automatically.
- The snapshot also keeps `expCache` (expenses of the last 8 opened trips). Opening a trip draws it at once
  from the trip list + `expCache`, even while the sign-in check is still running (trip rows and the back
  button stay tappable during `booting`; live listeners attach after sign-in). A trip with no saved
  expenses shows a loading screen (`.trip-loading`, "Taking longer than usual" after 6 s); an empty
  expense list from Firestore's cache is ignored until the server answers.
- `render()` redraws the whole `#app` and restores typed values by element `id` — give inputs stable ids;
  fields that are driven by state (filters, `xf*`) are excluded from that restore on purpose.

## Workflow

1. `git pull` first — Markus also edits on GitHub and via other sessions (merge PRs, German wording,
   logo, fonts). Rebase onto his changes, never overwrite them.
2. Make the change; put every new string in **both** `en` and `de` in `i18n.js`.
3. `python3 tools/bump-version.py`
4. `node --check --input-type=module < app.js` (and any other touched module), then `node tools/test/smoke.js`.
5. Commit and push to `main`; GitHub Pages deploys in about a minute.
6. If `firestore.rules` changed, give Markus the full rules block to paste into
   Firebase console → Firestore → Rules → Publish.

## Try-out previews

Markus can try a branch on his phone before it goes live: `tools/make-preview.sh <branch>` copies it into
`preview/` on main → https://diemmarkus.github.io/monetrip/preview/ (no service worker, noindex; the live
`sw.js` ignores `/preview/`). It uses the **real** Firebase project and data. Re-run the script after
pushing more commits to the branch; `tools/make-preview.sh --remove` takes it down once merged.

## Testing

`tools/test/smoke.js` loads the real app with Playwright, swapping the Firebase SDK for the fakes in
`tools/test/stubs/` (an in-memory store with trip `t1`: Markus/Papa/Lukas, one GBP expense). It checks that
the trip renders, an expense can be added, Settle up produces a plan, and — with a simulated slow
network (`window.__authDelay`, `window.__dataDelay`) — that trips open from the phone's copy during
sign-in and an unseen trip (`t2` Vienna) shows the loading screen, then loads. `GUEST=1` runs it as a guest.
In a test, `window.__store` is the fake database and `window.__fire()` pushes changes to listeners.
Real Firebase, Google sign-in and phone keyboards can't be tested this way — say so when it matters.

## Taste (from Markus's feedback)

- Mobile first, dense but tappable; no toasts for things the screen already shows (he removed several).
- Icons over text buttons where obvious (copy/share), platform conventions (swipe left = delete).
- Colors: highlight `#34e5eb` (dark text on it), negative/owe `#ed9726`, errors keep their own red.
- Keep the sheet header layout: ✕ · title · Add.
