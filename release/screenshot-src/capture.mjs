import { chromium } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'screenshots')
const assetsShotDir = join(__dirname, '..', 'assets', 'screenshots')
const releaseIcons = join(__dirname, '..', 'assets', 'icons')
mkdirSync(outDir, { recursive: true })
mkdirSync(assetsShotDir, { recursive: true })

const iconSrc = join(releaseIcons, 'icon-128.png')
if (!existsSync(iconSrc)) {
  console.error('Missing release/assets/icons/icon-128.png — run npm run icons first')
  process.exit(1)
}
copyFileSync(iconSrc, join(__dirname, 'icon-128.png'))

const template = readFileSync(join(__dirname, 'panel.html'), 'utf8')
const scenes = JSON.parse(readFileSync(join(__dirname, 'scenes.json'), 'utf8'))

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
})

for (const [name, data] of Object.entries(scenes)) {
  const page = await context.newPage()
  const injected = template.replace(
    '<script>\n    const params = new URLSearchParams(location.search);',
    `<script>\n    window.__SCENE__ = ${JSON.stringify({ ...data, scene: data.scene })};\n    const params = new URLSearchParams(location.search);`,
  )
  const tmp = join(__dirname, `_tmp-${name}.html`)
  writeFileSync(tmp, injected)

  await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load' })
  try {
    await page.waitForFunction(() => {
      const imgs = [...document.images]
      return imgs.length > 0 && imgs.every(img => img.complete && img.naturalWidth > 0)
    }, { timeout: 15000 })
  } catch (err) {
    console.warn(`image wait soft-fail for ${name}:`, err.message)
  }
  await page.waitForTimeout(300)

  const frame = page.locator('#frame')
  const outPath = join(outDir, `${name}.png`)
  await frame.screenshot({ path: outPath, type: 'png' })
  writeFileSync(join(assetsShotDir, `${name}.png`), readFileSync(outPath))
  const box = await frame.boundingBox()
  console.log(`wrote ${outPath} (${box?.width}x${box?.height})`)
  await page.close()
}

await browser.close()
console.log('done')
