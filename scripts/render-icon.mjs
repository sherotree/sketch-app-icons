import { mkdirSync, readFileSync, copyFileSync, existsSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const assetsDir = join(root, 'assets')
const iconsDir = join(root, 'icons')
const releaseIcons = join(root, 'release', 'assets', 'icons')
const svgMaster = join(iconsDir, 'icon.svg')
const svgSimple = join(iconsDir, 'icon-simple.svg')

mkdirSync(assetsDir, { recursive: true })
mkdirSync(releaseIcons, { recursive: true })

let sharp
try {
  sharp = require('sharp')
} catch {
  console.error('sharp is required: npm install')
  process.exit(1)
}

if (!existsSync(svgMaster) || !existsSync(svgSimple)) {
  console.error('Missing icons/icon.svg or icons/icon-simple.svg (copy from chrome-plugins/app-icons/icons)')
  process.exit(1)
}

const sizes = [
  { size: 16, svg: svgSimple, name: 'icon-16.png' },
  { size: 32, svg: svgSimple, name: 'icon-32.png' },
  { size: 48, svg: svgMaster, name: 'icon-48.png' },
  { size: 128, svg: svgMaster, name: 'icon-128.png' },
  { size: 256, svg: svgMaster, name: 'icon-256.png' },
  { size: 512, svg: svgMaster, name: 'icon-512.png' },
]

async function render(svgPath, size, outPath) {
  const input = readFileSync(svgPath)
  await sharp(input, { density: 384 })
    .resize(size, size, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outPath)
}

for (const { size, svg, name } of sizes) {
  const out = join(releaseIcons, name)
  await render(svg, size, out)
  console.log('wrote', out)
}

 // Sketch manifest icon: 128×128 PNG in Contents/Resources (via assets/icon.png)
const pluginIcon = join(assetsDir, 'icon.png')
copyFileSync(join(releaseIcons, 'icon-128.png'), pluginIcon)
console.log('wrote', pluginIcon)

copyFileSync(svgMaster, join(releaseIcons, 'icon.svg'))
copyFileSync(svgSimple, join(releaseIcons, 'icon-simple.svg'))

 // small provenance note
writeFileSync(
  join(releaseIcons, 'README.md'),
  [
    '# Icons',
    '',
    'Forest-green / cream / gold 2×2 + magnifier brand mark shared with the Chrome App Icons Finder extension.',
    '',
    '- Masters: `../../icons/icon.svg` (detail) and `icon-simple.svg` (16/32).',
    '- Plugin bundle uses `assets/icon.png` = 128×128 (Sketch manifest requirement).',
    '',
  ].join('\n'),
)
