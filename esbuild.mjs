import * as esbuild from 'esbuild'
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const bundle = join(root, 'app-icons.sketchplugin')
const sketch = join(bundle, 'Contents', 'Sketch')
const resources = join(bundle, 'Contents', 'Resources')

mkdirSync(sketch, { recursive: true })
mkdirSync(resources, { recursive: true })

const shared = {
  bundle: true,
  target: 'es2020',
  logLevel: 'info',
}

await Promise.all([
  esbuild.build({
    ...shared,
    entryPoints: [join(root, 'src/plugin.ts')],
    outfile: join(sketch, 'plugin.js'),
    platform: 'browser',
    mainFields: ['main'],
    format: 'cjs',
    external: ['sketch', 'sketch/dom', 'sketch/settings', 'sketch/ui', 'sketch/async'],
    banner: {
      js: 'var process=typeof process==="undefined"?{listenerCount:function(){return 0},emit:function(){}}:process;',
    },
    footer: {
      js: 'function onRun(context){ if (typeof globalThis.onRun === "function") globalThis.onRun(context); }',
    },
  }),
  esbuild.build({
    ...shared,
    entryPoints: [join(root, 'src/webview/main.ts')],
    outfile: join(resources, 'webview.js'),
    format: 'iife',
    platform: 'browser',
  }),
])

copyFileSync(join(root, 'src/manifest.json'), join(sketch, 'manifest.json'))
copyFileSync(join(root, 'src/webview/index.html'), join(resources, 'webview.html'))
copyFileSync(join(root, 'src/webview/styles.css'), join(resources, 'webview.css'))
copyFileSync(join(root, 'assets/icon.png'), join(resources, 'icon.png'))
