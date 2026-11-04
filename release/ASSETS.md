# App Icons Finder (Sketch) — release assets

Brand: **Uwarp / Sherotree**. Homepage: https://www.uwarp.design/logo-hunter  
Same forest-green / cream / gold 2×2 + magnifier mark as the Chrome extension.

## Folder map

| Path | Purpose |
| --- | --- |
| `assets/icons/` | PNG + SVG masters for listing / marketing |
| `assets/screenshots/` | 1280×800 marketing screenshots |
| `assets/app-icons.sketchplugin.zip` | Installable plugin archive (bundle at zip root) |
| `screenshots/` | Same PNGs (working copies) |
| `appcast.json` | Sketch update JSON (**replace `downloadURL` after hosting**) |
| `plugins-directory-entry.json` | Paste target for `sketchplugins/plugin-directory` PR |
| `directory-listing.md` | Copy for README line + PR description |
| `privacy-and-permissions.md` | What the plugin sends |
| `checklist.md` | Publish checklist |

## Required dimensions

| Asset | Size | Notes |
| --- | --- | --- |
| Plugin icon (`assets/icon.png` → `Contents/Resources/icon.png`) | **128×128 PNG** | Sketch manifest requirement |
| Listing / marketing icons | 16, 32, 48, 128, 256, 512 PNG + SVG | Matching Chrome set |
| Screenshots | **1280×800 PNG** | Not mandated by Sketch directory; useful for homepage / PR |
| Zip | `app-icons.sketchplugin.zip` | Archive root = `app-icons.sketchplugin/` |

## Icon sources

- Masters: `../icons/icon.svg`, `../icons/icon-simple.svg` (copied from `chrome-plugins/app-icons/icons/`)
- Regenerate: `npm run icons` (or `npm run build`)

## Paste / upload steps (manual — do not automate publish)

1. **Build & zip**
   - `cd sketch-plugins/app-icons && npm install && npm run build && npm run release:zip`
2. **Host the zip** on HTTPS (GitHub Release asset, CDN, or uwarp.design).
3. **Fill `appcast.json`**
   - Set `downloadURL` to the public zip URL.
   - Keep `versionID` in sync with `src/manifest.json` → `version`.
4. **Host `appcast.json`** and set in `src/manifest.json`:
   - `"appcast": "https://…/appcast.json"`
   - Rebuild + re-zip after changing the manifest.
5. **Sketch Plugin Directory PR**
   - Fork https://github.com/sketchplugins/plugin-directory
   - Add the object from `plugins-directory-entry.json` to `plugins.json` (and optionally a README bullet from `directory-listing.md`).
   - `owner` / `name` must match the public GitHub repo when hosted on GitHub.
6. **Homepage**
   - Optional: upload `assets/screenshots/*.png` and `assets/icons/icon-512.png` to https://www.uwarp.design/logo-hunter

## Do not

- Do not submit the PR or upload the zip from this agent session unless explicitly asked.
- Do not brand as tangweikun; use **Uwarp** / **Sherotree**.
