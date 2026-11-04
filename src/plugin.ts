import { artworkUrl } from './artwork-url'
import { appsFromItunes, itunesSearchUrl, type AppIcon } from './itunes'
import { normalizeCountry } from './countries'
import { normalizeRecent } from './recent'

const COUNTRY_KEY = 'app-icons.country'
const RECENT_KEY = 'app-icons.recent'
const WINDOW_ID = 'design.uwarp.app-icons.panel'
const ALLOWED_URLS = new Set(['https://www.uwarp.design/privacy-policy', 'https://www.uwarp.design/logo-hunter'])
const MAX_PNG_CHARS = 8_000_000
const UTF8 = 4
const PNG_TYPE = 4

let browserWindow: any = null
let searchGeneration = 0
let insertCount = 0

function openPanel(context: any) {
  if (browserWindow) {
    browserWindow.show()
    return
  }

  const BrowserWindow = require('sketch-module-web-view')
  const html = resourceURL(context, 'webview.html')
  if (!html) {
    require('sketch').UI.message('App Icons is missing its interface.')
    return
  }

  browserWindow = new BrowserWindow({
    identifier: WINDOW_ID,
    title: 'App Icons',
    width: 400,
    height: 680,
    minWidth: 320,
    minHeight: 520,
    useContentSize: true,
    remembersWindowFrame: true,
    hidesOnDeactivate: false,
    center: true,
    show: true,
    resizable: true,
    maximizable: false,
    minimizable: true,
    fullscreenable: false,
    backgroundColor: '#f4f4f5',
    webPreferences: { devTools: false },
  })

  browserWindow.on('closed', () => {
    browserWindow = null
  })

  const contents = browserWindow.webContents
  contents.on('did-finish-load', () => sendInit())
  contents.on('ready', () => sendInit())
  contents.on('cancel', () => {
    searchGeneration += 1
  })
  contents.on('search', (payload: unknown) => search(readRecord(payload)))
  contents.on('setCountry', (payload: unknown) => saveCountry(readRecord(payload)))
  contents.on('setRecent', (payload: unknown) => saveRecent(readRecord(payload)))
  contents.on('open', (payload: unknown) => openExternal(readRecord(payload)))
  contents.on('insert', (payload: unknown) => insert(readRecord(payload)))

  browserWindow.loadURL(html)
}

function sendInit() {
  post({
    type: 'init',
    country: readCountry(),
    recent: readRecent(),
  })
}

function search(payload: Record<string, unknown> | undefined) {
  const requestId = payload?.requestId
  const query = payload?.query
  const country = payload?.country
  if (typeof requestId !== 'number' || typeof query !== 'string' || typeof country !== 'string') return
  const generation = ++searchGeneration
  try {
    const data = readData(itunesSearchUrl(query, country))
    const apps = appsFromItunes(JSON.parse(dataToString(data)))
    if (generation !== searchGeneration) return
    post({ type: 'results', requestId, apps, status: 'success' })
  } catch {
    if (generation !== searchGeneration) return
    post({ type: 'results', requestId, apps: [], status: 'error' })
  }
}

function insert(payload: Record<string, unknown> | undefined) {
  const artwork = artworkUrl(payload?.artworkUrl)
  const name = typeof payload?.name === 'string' ? payload.name.slice(0, 200) : ''
  if (!artwork) {
    post({ type: 'insertResult', status: 'failed' })
    return
  }
  try {
    const base64 = dataToPngBase64(readData(artwork))
    if (!base64.startsWith('iVBORw0KGgo') || base64.length > MAX_PNG_CHARS) {
      post({ type: 'insertResult', status: 'failed' })
      return
    }
    const status = placeImage(base64, name)
    post({ type: 'insertResult', status })
  } catch {
    post({ type: 'insertResult', status: 'failed' })
  }
}

function placeImage(base64: string, name: string): 'inserted' | 'nodoc' {
  const sketch = require('sketch')
  const { Image } = require('sketch/dom')
  const document = sketch.getSelectedDocument()
  if (!document) {
    sketch.UI.message('Open a Sketch document to insert an icon.')
    return 'nodoc'
  }
  const target = insertionTarget(document)
  const layer = new Image({
    parent: target.parent,
    name: layerName(name),
    image: { base64 },
    frame: new sketch.Rectangle(target.x, target.y, 128, 128),
  })
  if (typeof document.selectedLayers?.clear === 'function') document.selectedLayers.clear()
  layer.selected = true
  sketch.UI.message(`Inserted ${layer.name}`)
  return 'inserted'
}

function insertionTarget(document: any): { parent: any; x: number; y: number } {
  const layers = selectedLayers(document)
  const selected = layers.length === 1 ? layers[0] : undefined
  const nudge = (insertCount % 6) * 16
  insertCount += 1
  if (selected && canContain(selected)) {
    return { parent: selected, x: 32 + nudge, y: 32 + nudge }
  }
  const frame = selected?.frame
  if (selected && frame && typeof frame.x === 'number' && typeof frame.y === 'number') {
    return { parent: document.selectedPage, x: frame.x + 24 + nudge, y: frame.y + 24 + nudge }
  }
  return { parent: document.selectedPage, x: 80 + nudge, y: 80 + nudge }
}

function selectedLayers(document: any): any[] {
  const layers = document.selectedLayers?.layers
  if (Array.isArray(layers)) return layers
  if (!layers || typeof layers.length !== 'number') return []
  const list: any[] = []
  for (let index = 0; index < layers.length; index += 1) {
    const layer = layers[index]
    if (layer) list.push(layer)
  }
  return list
}

function canContain(layer: { type?: string }): boolean {
  return layer.type === 'Group' || layer.type === 'Artboard'
}

function layerName(name: string): string {
  const base = name
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  return base || 'App Icon'
}

function saveCountry(payload: Record<string, unknown> | undefined) {
  if (typeof payload?.country !== 'string') return
  require('sketch/settings').setGlobalSettingForKey(COUNTRY_KEY, normalizeCountry(payload.country))
}

function saveRecent(payload: Record<string, unknown> | undefined) {
  require('sketch/settings').setGlobalSettingForKey(RECENT_KEY, normalizeRecent(payload?.recent))
}

function readCountry(): string {
  return normalizeCountry(settingString(require('sketch/settings').globalSettingForKey(COUNTRY_KEY)))
}

function readRecent(): string[] {
  return normalizeRecent(require('sketch/settings').globalSettingForKey(RECENT_KEY))
}

function openExternal(payload: Record<string, unknown> | undefined) {
  const url = payload?.url
  if (typeof url !== 'string' || !ALLOWED_URLS.has(url)) return
  NSWorkspace.sharedWorkspace().openURL(NSURL.URLWithString(url))
}

function post(message: { type: string; apps?: AppIcon[] } | Record<string, unknown>) {
  if (!browserWindow) return
  const json = JSON.stringify(message).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
  browserWindow.webContents.executeJavaScript(`window.appIcons && window.appIcons.onHost(${json})`)
}

function readData(urlString: string) {
  const request = NSURLRequest.requestWithURL_cachePolicy_timeoutInterval(NSURL.URLWithString(urlString), 0, 12)
  const responsePtr = MOPointer.alloc().init()
  const errorPtr = MOPointer.alloc().init()
  const data = NSURLConnection.sendSynchronousRequest_returningResponse_error(request, responsePtr, errorPtr)
  const error = errorPtr.value()
  if (!data || error) throw new Error(error ? String(error.localizedDescription()) : 'The request failed.')
  const response = responsePtr.value()
  const status = response && typeof response.statusCode === 'function' ? Number(response.statusCode()) : 200
  if (status < 200 || status >= 300) throw new Error(`Request failed (${status})`)
  return data
}

function dataToString(data: any): string {
  return String(NSString.alloc().initWithData_encoding(data, UTF8))
}

function dataToPngBase64(data: any): string {
  const image = NSImage.alloc().initWithData(data)
  const tiff = image && typeof image.TIFFRepresentation === 'function' ? image.TIFFRepresentation() : null
  const rep = tiff ? NSBitmapImageRep.imageRepWithData(tiff) : null
  const png = rep ? rep.representationUsingType_properties(PNG_TYPE, null) : null
  if (!png || typeof png.base64EncodedStringWithOptions !== 'function') throw new Error('png encode failed')
  return String(png.base64EncodedStringWithOptions(0))
}

function resourceURL(context: any, name: string): string {
  const url = context.plugin?.urlForResourceNamed?.(name)
  if (!url || typeof url.absoluteString !== 'function') return ''
  return String(url.absoluteString())
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'string') {
    try {
      return readRecord(JSON.parse(value))
    } catch {
      return undefined
    }
  }
  if (typeof value === 'object' && value !== null) return value as Record<string, unknown>
  return undefined
}

function settingString(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (value == null) return undefined
  const text = String(value)
  return text.startsWith('<') ? undefined : text
}

;(globalThis as { onRun?: (context: any) => void }).onRun = openPanel
