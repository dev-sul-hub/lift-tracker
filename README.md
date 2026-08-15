# Lift Tracker v2.2 — Phone Setup

## 1. Put it on GitHub Pages (one time, ~5 min)
1. Create a new GitHub repo (e.g. `lift-tracker`). Private works for Pages on paid plans; otherwise public is fine — the app contains no personal data, your logs stay on-device and in a **private** gist.
2. Upload everything in this folder (`index.html`, `styles.css`, the `js/` folder, `sw.js`, `manifest.webmanifest`, `icons/`). Keep the folder structure exactly as-is.
3. Repo → Settings → Pages → Source: **Deploy from a branch** → Branch: `main`, folder `/ (root)` → Save.
4. Wait ~1 minute. Your app lives at `https://<username>.github.io/lift-tracker/`.

## 2. Install on your phone
Open that URL in Chrome (Android) → menu (⋮) → **Add to Home screen** → Install.
iPhone: Safari → Share → **Add to Home Screen**.
It launches fullscreen and works offline at the gym after the first load.

## 3. Move your data over
On the PC where you've been using the file version: EXPORT DATA → transfer the JSON to your phone → IMPORT DATA in the installed app. (Or skip this and let sync move it — see below.)

## 4. Set up sync (optional but recommended)
1. github.com → Settings → Developer settings → Personal access tokens →
   **Fine-grained token** → Account permissions → **Gists: Read and write** → Generate.
   (Classic token with the `gist` scope also works.)
2. In the app: **⇅ SYNC** → paste the token → **SYNC NOW**.
   First device creates a private gist automatically.
3. On the second device: paste the **same token** → SYNC NOW. It finds the gist by itself.

Sync merges by entry — you can log on the phone and edit on the PC and nothing gets
clobbered. Deletes and edits propagate. Tap SYNC when you finish a session and when
you sit down at the other device.

## Updating the app later
Replace the changed files in the repo **and bump the version string at the top of `sw.js`**
(e.g. `lift-tracker-v2.1.1`) so installed phones pick up the update on their next launch.
