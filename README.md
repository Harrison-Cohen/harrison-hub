# Harrison's Hub

A personal, installable web app (PWA) that replaces a pile of notes apps and
spreadsheets with one home for the things Harrison wants to keep track of —
movies, quotes, recipes, and anything else he dreams up later. No accounts,
no login — it's just his, and it stays in sync across every device
automatically.

## What it is

Harrison's Hub is a single-page app with four built-in sections, plus a way
to spin up new ones on demand:

- **Movies** — a "To Watch" queue and a "Watched" list (0–10 ratings, notes),
  shown side-by-side so nothing gets lost scrolling.
- **Quotes** — a running collection of quotes worth remembering, each with
  an optional date and source.
- **Recipes** — ingredients, steps, and notes per recipe, collapsed into
  foldable cards so a long recipe list stays easy to scan.
- **Templates** — define a custom data shape once (fields like text,
  ratings, dates, checkboxes, dropdowns), then spin up as many tabs from it
  as you want — e.g. a "Books" tab or a "Wishlist" tab — each backed by its
  own sheet of data.

Every tab, built-in or custom, can be given its own accent color from the
Templates screen, so the app can be color-coded to taste. Add/edit/delete
actions update the screen instantly and sync to the backend in the
background, so it feels responsive even though the data lives in a Google
Sheet.

Everything is backed by a single Google Sheet, so opening the Sheet
directly lets you eyeball or bulk-edit the raw data any time, and every
device that loads the app talks to the same backend — no manual
export/import between phone and desktop.

## How it's built

- **Frontend**: a static PWA (`index.html` + `manifest.json` + `sw.js`),
  installable to a phone home screen, hosted for free on GitHub Pages.
- **Backend**: a single Google Apps Script Web App (`Code.gs`), deployed at
  script.google.com, exposing a JSON API via `doGet(e)` with an `action`
  query param.
- **Storage**: a Google Sheet bound to the Apps Script, with one sheet/tab
  per data category (Movies, Quotes, Recipes, Templates, CustomTabs,
  TabColors, plus one sheet per custom tab you create).

## Setup

### 1. Create the Google Sheet + Apps Script backend

1. Go to [sheets.new](https://sheets.new) to create a new Google Sheet.
2. In the Sheet, go to **Extensions > Apps Script**.
3. Delete the default code in the editor, then paste in the entire contents
   of [`Code.gs`](Code.gs) from this repo.
4. Click **Deploy > New deployment**, click the gear icon and select
   **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Click **Deploy** and authorize the permissions it asks for (this is your
   own script accessing your own Sheet — safe to allow).
6. Copy the Web App URL (it ends in `/exec`).
7. Back in the Apps Script editor, select `seedAll` from the function
   dropdown at the top of the editor and click **Run**. This populates the
   Sheet with starting Movies / Quotes / Recipes data and the two example
   Templates (Book, Wishlist). Authorize again if prompted. Only run this
   once, on a fresh Sheet — running it again will append duplicate rows.

### 2. Point the frontend at your backend

1. Open `index.html` in this repo.
2. Near the top of the `<script>` block, set:
   ```js
   const SCRIPT_URL = "https://script.google.com/macros/s/XXXXXXXX/exec";
   ```
   using the URL you copied in step 6 above.
3. Commit and push.

### 3. Deploy the frontend on GitHub Pages

1. Push this repo to GitHub (see below if it isn't already there).
2. In the repo, go to **Settings > Pages**.
3. Under **Build and deployment**, set **Source** to "Deploy from a
   branch", branch `main`, folder `/ (root)`. Save.
4. GitHub will give you a URL like
   `https://<your-username>.github.io/<repo-name>/`. That's your app.

### 4. Install it on your iPhone

1. Open the GitHub Pages URL in Safari.
2. Tap the Share icon > **Add to Home Screen**.
3. It now opens full-screen like a native app, and stays in sync with the
   same Google Sheet as your desktop browser.

## Editing the backend later

`Code.gs` in this repo is the source of truth — but Apps Script isn't
deployed from git. Whenever you (or Claude Code) change it:

1. Copy the updated contents of `Code.gs`.
2. Paste them into the Apps Script editor at script.google.com, replacing
   what's there.
3. **Deploy > Manage deployments** > pencil (edit) icon > Version:
   **New version** > **Deploy**.

The `/exec` URL stays the same across versions, so `SCRIPT_URL` in
`index.html` doesn't need to change.

## Data model

| Sheet | Columns |
|---|---|
| `Movies` | id, title, status (`towatch`/`watched`), rating, notes, dateAdded |
| `Quotes` | id, text, date, source, dateAdded |
| `Recipes` | id, name, notes, ingredients (JSON array), steps (JSON array), source, dateAdded |
| `Templates` | id, templateName, fieldsJson (JSON array of `{label, type, options?}`) |
| `CustomTabs` | id, tabName, templateId, sheetName, fieldsJson, order, dateAdded — the registry of tabs spawned from templates |
| `TabColors` | tabId, color — the accent color chosen for a tab (built-in id like `movies`, or a custom tab's id) |
| one sheet per custom tab | id, dateAdded, then one column per field defined in that tab's template |

All sheets are created automatically the first time they're needed —
you don't need to create them by hand (aside from running `seedAll` once
for the starting data).

You can open the Sheet directly any time to eyeball or bulk-edit data.

## Repo structure

- `index.html` — the entire frontend (styles + markup + JS in one file)
- `manifest.json` — PWA manifest
- `sw.js` — service worker, caches the app shell for instant loads
- `Code.gs` — Apps Script backend (source of truth; paste into
  script.google.com to deploy)
- `icons/` — app icons used by the manifest and `apple-touch-icon`
