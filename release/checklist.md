# Sketch publish checklist

## Package

- [ ] `npm run build` finishes
- [ ] `Contents/Resources/icon.png` is 128×128 and matches the forest-green brand mark
- [ ] `Contents/Sketch/manifest.json` has `author: Uwarp`, `homepage`, `identifier`, `version`
- [ ] After hosting, `appcast` URL is set in the manifest and the bundle is rebuilt
- [ ] `npm run release:zip` produces `release/app-icons.sketchplugin.zip`
- [ ] Unzipping yields `app-icons.sketchplugin/` (not a nested parent folder)
- [ ] No `node_modules`, source maps, or `.DS_Store` inside the zip

## Manual test in Sketch

- [ ] Double-click install or copy into Plugins folder
- [ ] **Plugins › App Icons Finder › Search App Icons** opens the panel
- [ ] Search returns icons; switching region changes results
- [ ] Insert PNG places a 128×128 image on the selection or page
- [ ] Privacy sheet matches `privacy-and-permissions.md`
- [ ] Footer links open privacy policy and logo-hunter

## Directory / updates

- [ ] Zip hosted on HTTPS
- [ ] `appcast.json` `downloadURL` + `versionID` + `downloadFileSize` correct
- [ ] PR opened on `sketchplugins/plugin-directory` with entry from `plugins-directory-entry.json`
- [ ] Homepage https://www.uwarp.design/logo-hunter
- [ ] Privacy policy https://www.uwarp.design/privacy-policy
