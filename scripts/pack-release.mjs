import { mkdirSync, existsSync, rmSync, statSync, writeFileSync, copyFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const bundle = join(root, 'app-icons.sketchplugin')
const releaseDir = join(root, 'release')
const assetsDir = join(releaseDir, 'assets')
mkdirSync(assetsDir, { recursive: true })

if (!existsSync(join(bundle, 'Contents', 'Sketch', 'manifest.json'))) {
  console.error('Missing built bundle. Run: npm run build')
  process.exit(1)
}

const zipName = 'app-icons.sketchplugin.zip'
const zipPath = join(releaseDir, zipName)
const assetsZip = join(assetsDir, zipName)
rmSync(zipPath, { force: true })
rmSync(assetsZip, { force: true })

// Clean zip without AppleDouble / __MACOSX
execFileSync(
  'zip',
  ['-r', '-X', '-q', zipPath, 'app-icons.sketchplugin', '-x', '*.DS_Store', '*__MACOSX*', '*.map'],
  { cwd: root, env: { ...process.env, COPYFILE_DISABLE: '1' } },
)
copyFileSync(zipPath, assetsZip)

const size = statSync(zipPath).size
const now = new Date()
const creationDate = now.toUTCString().replace(/GMT$/, '+0000')

const appcast = {
  itemName: 'App Icons Finder',
  versionID: '1.0.0',
  downloadURL: 'REPLACE_WITH_HOSTED_ZIP_URL',
  downloadFileSize: size,
  creationDate,
}

writeFileSync(join(releaseDir, 'appcast.json'), JSON.stringify(appcast, null, 2) + '\n')
writeFileSync(
  join(releaseDir, 'appcast.TEMPLATE.json'),
  JSON.stringify(
    {
      ...appcast,
      downloadURL: 'https://example.com/releases/app-icons.sketchplugin.zip',
      _notes: [
        'Host the zip, set downloadURL to the public HTTPS URL.',
        'Put the hosted appcast.json URL into src/manifest.json as "appcast".',
        'Sketch only requires downloadURL + versionID.',
      ],
    },
    null,
    2,
  ) + '\n',
)

console.log('wrote', zipPath, `(${size} bytes)`)
console.log('wrote', join(releaseDir, 'appcast.json'))
