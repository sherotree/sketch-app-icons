# App Icons Finder

Sketch plugin by **Uwarp** (Sherotree / 小树): search the App Store and insert official app icons as PNG into the current document.

Homepage: https://www.uwarp.design/logo-hunter

## Install

1. Download [`app-icons.sketchplugin.zip`](https://github.com/sherotree/sketch-app-icons/releases/latest/download/app-icons.sketchplugin.zip)
2. Unzip and double-click `app-icons.sketchplugin`, or copy it into Sketch’s Plugins folder
3. In Sketch: **Plugins › App Icons Finder › Search App Icons**

Or install from the [Sketch plugin directory](https://www.sketch.com/extensions/plugins/) once the listing is live.

## Privacy

The search text and App Store region you pick are sent to Apple. Uwarp does not receive them. The UI is English only.

## Develop

```bash
npm install
npm run build
npm run release:zip
```

Double-click the built `app-icons.sketchplugin`, or:

```bash
cp -R app-icons.sketchplugin "$HOME/Library/Application Support/com.bohemiancoding.sketch3/Plugins/"
```

## License

MIT
