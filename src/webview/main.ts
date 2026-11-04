import { artworkUrl } from '../artwork-url'
import { STORE_COUNTRIES, normalizeCountry } from '../countries'
import { forgetRecent, rememberRecent, normalizeRecent } from '../recent'
import { copy } from './copy'

const DEBOUNCE_MS = 280
const WATCHDOG_MS = 20_000

interface AppIcon {
  trackId: number
  trackName: string
  artistName: string
  artworkUrl: string
  primaryGenreName?: string
}

type Notice = { tone: 'ok' | 'err'; text: string } | null
type Status = 'idle' | 'loading' | 'success' | 'error'
type InsertStatus = 'inserted' | 'nodoc' | 'failed'

interface HostApi {
  onHost(message: unknown): void
}

const host = window as unknown as HostApi & { postMessage(type: string, payload?: unknown): void }

class AppView {
  private readonly form = required(HTMLFormElement, 'search-form')
  private readonly input = required(HTMLInputElement, 'query')
  private readonly clearButton = required(HTMLButtonElement, 'clear')
  private readonly countrySelect = required(HTMLSelectElement, 'country')
  private readonly progress = required(HTMLElement, 'progress')
  private readonly statusNode = required(HTMLElement, 'status')
  private readonly stage = required(HTMLElement, 'stage')
  private readonly dock = required(HTMLElement, 'dock')
  private readonly dialog = required(HTMLDialogElement, 'privacy-dialog')

  private query = ''
  private submitted = ''
  private country = 'US'
  private recent: string[] = []
  private apps: AppIcon[] = []
  private status: Status = 'idle'
  private selectedId: number | undefined
  private requestId = 0
  private composing = false
  private countryTouched = false
  private recentTouched = false
  private savedToken = ''
  private busy = false
  private notice: Notice = null
  private insertTrackId: number | undefined
  private stageKey = ''
  private resultsNode: HTMLElement | undefined
  private dockTrackId: number | undefined
  private dockButton: HTMLButtonElement | undefined
  private dockLabel: HTMLElement | undefined
  private dockNotice: HTMLElement | undefined
  private timer: number | undefined
  private watchdog: number | undefined

  constructor() {
    host.onHost = message => this.onHost(message)
    this.applyCopy()
    this.fillCountries()
    this.bind()
    this.render()
    send('ready')
  }

  private onHost(message: unknown) {
    const record = readRecord(message)
    if (!record) return
    if (record.type === 'init' && typeof record.country === 'string') {
      this.applyInit(record.country, normalizeRecent(record.recent))
      return
    }
    if (record.type === 'results' && typeof record.requestId === 'number') {
      const status = record.status === 'error' ? 'error' : 'success'
      this.applyResults(record.requestId, readApps(record.apps), status)
      return
    }
    if (record.type === 'insertResult') this.applyInsert(readInsertStatus(record.status))
  }

  private applyCopy() {
    text('search-label', copy.searchLabel)
    text('region-label', copy.regionLabel)
    text('privacy', copy.privacy)
    text('privacy-title', copy.privacyTitle)
    text('privacy-body', copy.privacyBody)
    text('privacy-local', copy.privacyLocal)
    text('rights', copy.rights)
    text('privacy-policy', copy.privacyPolicy)
    text('web-tool', copy.webTool)
    text('privacy-close', copy.close)
    this.input.placeholder = copy.searchPlaceholder
    this.input.setAttribute('aria-label', copy.searchLabel)
    this.clearButton.setAttribute('aria-label', copy.clearSearch)
    this.countrySelect.setAttribute('aria-label', copy.regionLabel)
    this.dialog.setAttribute('aria-labelledby', 'privacy-title')
  }

  private fillCountries() {
    for (const country of STORE_COUNTRIES) {
      const option = document.createElement('option')
      option.value = country.code
      option.textContent = country.name
      this.countrySelect.append(option)
    }
    this.countrySelect.value = this.country
  }

  private bind() {
    this.form.addEventListener('submit', event => {
      event.preventDefault()
      this.stage.querySelector<HTMLButtonElement>('[data-result="true"]')?.focus()
    })
    this.input.addEventListener('input', () => {
      this.query = this.input.value
      this.syncClear()
      if (this.composing) {
        window.clearTimeout(this.timer)
        this.render()
        return
      }
      this.scheduleSearch()
    })
    this.input.addEventListener('compositionstart', () => {
      this.composing = true
      window.clearTimeout(this.timer)
    })
    this.input.addEventListener('compositionend', () => {
      this.composing = false
      this.query = this.input.value
      this.scheduleSearch()
    })
    this.input.addEventListener('keydown', event => {
      if (event.key === 'Escape' && this.query) {
        event.preventDefault()
        this.setQuery('', true)
      }
    })
    this.clearButton.addEventListener('click', () => {
      this.setQuery('', true)
      this.input.focus()
    })
    this.countrySelect.addEventListener('change', () => {
      this.country = normalizeCountry(this.countrySelect.value)
      this.countryTouched = true
      send('setCountry', { country: this.country })
      if (this.query.trim()) this.flushSearch()
    })
    required(HTMLButtonElement, 'privacy').addEventListener('click', () => this.dialog.showModal())
    required(HTMLButtonElement, 'privacy-close').addEventListener('click', () => this.dialog.close())
    this.dialog.addEventListener('click', event => {
      if (event.target === this.dialog) this.dialog.close()
    })
    for (const id of ['privacy-policy', 'web-tool']) {
      required(HTMLButtonElement, id).addEventListener('click', event => {
        const url = event.currentTarget instanceof HTMLButtonElement ? event.currentTarget.dataset.url : undefined
        if (url) send('open', { url })
      })
    }
  }

  private applyInit(country: string, recent: string[]) {
    if (!this.countryTouched) {
      const next = normalizeCountry(country)
      const changed = next !== this.country
      this.country = next
      this.countrySelect.value = next
      if (changed && this.submitted) this.flushSearch()
    }
    if (!this.recentTouched) this.recent = recent
    this.render()
  }

  private applyResults(requestId: number, apps: AppIcon[], status: 'success' | 'error') {
    if (requestId !== this.requestId) return
    window.clearTimeout(this.watchdog)
    if (status === 'error') {
      this.apps = []
      this.status = 'error'
      this.selectedId = undefined
    } else {
      this.apps = apps
      this.status = 'success'
      this.ensureSelection()
      this.maybeRemember()
    }
    this.render()
  }

  private applyInsert(status: InsertStatus) {
    const sameApp = this.insertTrackId === this.selectedId
    this.busy = false
    this.insertTrackId = undefined
    if (!sameApp) this.notice = null
    else if (status === 'inserted') this.notice = { tone: 'ok', text: copy.inserted }
    else if (status === 'nodoc') this.notice = { tone: 'err', text: copy.noDocument }
    else this.notice = { tone: 'err', text: copy.insertFailed }
    this.syncDock()
  }

  private setQuery(value: string, immediate: boolean) {
    this.query = value
    this.input.value = value
    this.composing = false
    this.syncClear()
    if (immediate) this.flushSearch()
    else this.scheduleSearch()
  }

  private scheduleSearch() {
    window.clearTimeout(this.timer)
    if (!this.query.trim()) {
      this.clearResults()
      return
    }
    this.render()
    this.timer = window.setTimeout(() => this.flushSearch(), DEBOUNCE_MS)
  }

  private flushSearch() {
    window.clearTimeout(this.timer)
    const term = this.query.trim()
    if (!term) {
      this.clearResults()
      return
    }
    this.submitted = term
    this.status = 'loading'
    this.requestId += 1
    const requestId = this.requestId
    send('search', { query: term, country: this.country, requestId })
    this.armWatchdog(requestId)
    this.render()
  }

  private clearResults() {
    window.clearTimeout(this.timer)
    window.clearTimeout(this.watchdog)
    const shouldCancel = this.status === 'loading' || this.submitted !== ''
    this.submitted = ''
    this.apps = []
    this.status = 'idle'
    this.selectedId = undefined
    this.requestId += 1
    if (shouldCancel) send('cancel')
    this.render()
  }

  private armWatchdog(requestId: number) {
    window.clearTimeout(this.watchdog)
    this.watchdog = window.setTimeout(() => {
      if (this.requestId !== requestId || this.status !== 'loading') return
      this.apps = []
      this.status = 'error'
      this.selectedId = undefined
      send('cancel')
      this.render()
    }, WATCHDOG_MS)
  }

  private ensureSelection() {
    if (!this.apps.some(app => app.trackId === this.selectedId)) this.selectedId = this.apps[0]?.trackId
  }

  private maybeRemember() {
    const term = this.submitted.trim()
    if (this.status !== 'success' || this.apps.length === 0 || term.length < 2) return
    const token = `${this.country}:${term}`
    if (this.savedToken === token) return
    this.savedToken = token
    this.recent = rememberRecent(this.recent, term)
    this.recentTouched = true
    send('setRecent', { recent: this.recent })
  }

  private select(trackId: number) {
    this.selectedId = trackId
    this.notice = null
    this.render()
  }

  private removeRecent(term: string) {
    this.recent = forgetRecent(this.recent, term)
    this.recentTouched = true
    send('setRecent', { recent: this.recent })
    this.render()
  }

  private insert(app: AppIcon) {
    if (this.busy) return
    this.busy = true
    this.notice = null
    this.insertTrackId = app.trackId
    this.syncDock()
    send('insert', { artworkUrl: app.artworkUrl, name: app.trackName })
  }

  private render() {
    this.syncClear()
    const active = this.status === 'loading' || this.isStale()
    this.progress.dataset.active = active ? 'true' : 'false'
    this.stage.setAttribute('aria-busy', active ? 'true' : 'false')
    this.renderStatus()
    this.renderStage()
    this.renderDock()
  }

  private renderStatus() {
    const typed = this.query.trim()
    if (!typed) this.statusNode.textContent = ''
    else if (this.status === 'loading' || this.isStale()) this.statusNode.textContent = copy.loading
    else if (this.status === 'error' && this.apps.length === 0) this.statusNode.textContent = copy.errorTitle
    else if (this.apps.length === 0) this.statusNode.textContent = copy.noResults
    else this.statusNode.textContent = copy.resultCount(this.apps.length)
  }

  private syncClear() {
    this.clearButton.hidden = this.query.length === 0
  }

  private renderStage() {
    const key = `${this.stageMode()}|${this.recent.join('\n')}`
    if (key !== this.stageKey) {
      this.stageKey = key
      this.resultsNode = undefined
      this.stage.replaceChildren()
      this.buildStage()
    }
    this.resultsNode?.classList.toggle('is-stale', this.apps.length > 0 && (this.isStale() || this.status === 'loading'))
    this.syncSelection()
  }

  private buildStage() {
    if (this.recent.length > 0) this.stage.append(this.recentRow())
    const mode = this.stageMode()
    if (mode === 'idle') {
      this.stage.append(this.idleState())
      return
    }
    if (mode === 'error') {
      this.stage.append(this.messageState(copy.errorTitle, copy.errorHint, copy.retry, () => this.retry()))
      return
    }
    if (mode === 'loading') {
      this.stage.append(this.skeleton())
      return
    }
    if (mode === 'empty') {
      this.stage.append(this.messageState(copy.noResults, copy.noResultsHint))
      return
    }
    this.stage.append(this.results())
  }

  private stageMode(): string {
    if (!this.query.trim()) return 'idle'
    if (this.apps.length === 0 && this.status === 'error' && !this.isStale()) return 'error'
    if (this.apps.length === 0 && (this.status === 'loading' || this.isStale() || this.status === 'idle')) return 'loading'
    if (this.apps.length === 0) return 'empty'
    return `results:${this.apps.map(app => String(app.trackId)).join(',')}`
  }

  private retry() {
    if (this.submitted.trim()) this.flushSearch()
  }

  private recentRow(): HTMLElement {
    const row = el('div', 'recent')
    const label = el('div', 'recent-label')
    label.textContent = copy.recent
    const chips = el('div', 'chips')
    for (const term of this.recent) {
      const wrap = el('span', 'chip-wrap')
      const chip = el('button', 'chip')
      chip.type = 'button'
      chip.textContent = term
      chip.addEventListener('click', () => this.setQuery(term, true))
      const remove = el('button', 'chip-x')
      remove.type = 'button'
      remove.setAttribute('aria-label', `${copy.removeRecent} ${term}`)
      remove.textContent = '×'
      remove.addEventListener('click', () => this.removeRecent(term))
      wrap.append(chip, remove)
      chips.append(wrap)
    }
    row.append(label, chips)
    return row
  }

  private idleState(): HTMLElement {
    const block = el('div', 'empty')
    const title = el('p', 'empty-title')
    title.textContent = copy.idleTitle
    const body = el('p', 'empty-body')
    body.textContent = copy.idleBody
    const chips = el('div', 'chips')
    chips.setAttribute('aria-label', copy.suggestionsLabel)
    for (const term of copy.suggestions) {
      const chip = el('button', 'chip chip-solid')
      chip.type = 'button'
      chip.textContent = term
      chip.addEventListener('click', () => this.setQuery(term, true))
      chips.append(chip)
    }
    block.append(title, body, chips)
    return block
  }

  private messageState(title: string, hint: string, action?: string, onAction?: () => void): HTMLElement {
    const block = el('div', 'empty')
    const heading = el('p', 'empty-title')
    heading.textContent = title
    const body = el('p', 'empty-body')
    body.textContent = hint
    block.append(heading, body)
    if (action && onAction) {
      const button = el('button', 'secondary')
      button.type = 'button'
      button.textContent = action
      button.addEventListener('click', onAction)
      block.append(button)
    }
    return block
  }

  private skeleton(): HTMLElement {
    const grid = el('div', 'grid')
    grid.setAttribute('aria-hidden', 'true')
    for (let index = 0; index < 9; index += 1) grid.append(el('div', 'skeleton'))
    return grid
  }

  private results(): HTMLElement {
    const block = el('div', 'results')
    const count = el('p', 'count')
    count.textContent = copy.resultCount(this.apps.length)
    const grid = el('div', 'grid')
    grid.setAttribute('role', 'listbox')
    grid.setAttribute('aria-label', copy.resultsLabel)
    for (const app of this.apps) grid.append(this.tile(app))
    block.append(count, grid)
    this.resultsNode = block
    return block
  }

  private tile(app: AppIcon): HTMLButtonElement {
    const button = el('button', 'tile')
    button.type = 'button'
    button.dataset.result = 'true'
    button.dataset.trackId = String(app.trackId)
    button.setAttribute('role', 'option')
    button.setAttribute('aria-label', app.trackName)
    button.title = app.artistName ? `${app.trackName} — ${app.artistName}` : app.trackName
    button.append(iconImage(app))
    button.addEventListener('click', () => this.select(app.trackId))
    return button
  }

  private syncSelection() {
    const selected = this.selectedId === undefined ? '' : String(this.selectedId)
    for (const button of this.stage.querySelectorAll<HTMLButtonElement>('[data-result="true"]')) {
      const pressed = button.dataset.trackId === selected
      button.setAttribute('aria-pressed', pressed ? 'true' : 'false')
      button.setAttribute('aria-selected', pressed ? 'true' : 'false')
    }
  }

  private renderDock() {
    const app = this.apps.find(item => item.trackId === this.selectedId)
    if (!app) {
      this.dock.hidden = true
      this.dock.replaceChildren()
      this.dockTrackId = undefined
      this.dockButton = undefined
      this.dockLabel = undefined
      this.dockNotice = undefined
      return
    }
    this.dock.hidden = false
    if (this.dockTrackId !== app.trackId) this.buildDock(app)
    this.syncDock()
  }

  private buildDock(app: AppIcon) {
    this.dockTrackId = app.trackId
    this.notice = null
    this.dock.replaceChildren()
    this.dock.setAttribute('aria-label', copy.selectedLabel)
    const head = el('div', 'dock-head')
    const thumb = el('div', 'dock-thumb')
    thumb.append(iconImage(app))
    const meta = el('div', 'dock-copy')
    const title = el('p', 'dock-title')
    title.textContent = app.trackName
    title.title = app.trackName
    meta.append(title)
    if (app.artistName) {
      const artist = el('p', 'dock-meta')
      artist.textContent = app.artistName
      meta.append(artist)
    }
    if (app.primaryGenreName) {
      const genre = el('p', 'dock-meta')
      genre.textContent = app.primaryGenreName
      meta.append(genre)
    }
    head.append(thumb, meta)
    const button = el('button', 'primary')
    button.type = 'button'
    const label = el('span')
    button.append(label)
    button.addEventListener('click', () => this.insert(app))
    const rights = el('p', 'rights')
    rights.textContent = copy.rights
    const notice = el('p', 'notice')
    notice.setAttribute('role', 'status')
    this.dockButton = button
    this.dockLabel = label
    this.dockNotice = notice
    this.dock.append(head, button, rights, notice)
  }

  private syncDock() {
    if (!this.dockButton || !this.dockLabel || !this.dockNotice) return
    this.dockButton.disabled = this.busy
    this.dockLabel.textContent = this.busy ? copy.inserting : copy.insert
    this.dockNotice.dataset.tone = this.notice?.tone ?? 'idle'
    this.dockNotice.textContent = this.notice?.text ?? ''
  }

  private isStale(): boolean {
    const typed = this.query.trim()
    return typed.length > 0 && typed !== this.submitted.trim()
  }
}

function send(type: string, payload?: unknown) {
  if (payload === undefined) host.postMessage(type)
  else host.postMessage(type, payload)
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'object' && value !== null) return value as Record<string, unknown>
  return undefined
}

function readApps(value: unknown): AppIcon[] {
  if (!Array.isArray(value)) return []
  const apps: AppIcon[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const artwork = artworkUrl(row.artworkUrl)
    if (typeof row.trackId !== 'number' || typeof row.trackName !== 'string' || !artwork) continue
    apps.push({
      trackId: row.trackId,
      trackName: row.trackName.slice(0, 300),
      artistName: typeof row.artistName === 'string' ? row.artistName.slice(0, 300) : '',
      artworkUrl: artwork,
      primaryGenreName: typeof row.primaryGenreName === 'string' ? row.primaryGenreName.slice(0, 80) : undefined,
    })
  }
  return apps
}

function readInsertStatus(value: unknown): InsertStatus {
  if (value === 'inserted' || value === 'nodoc' || value === 'failed') return value
  return 'failed'
}

function iconImage(app: AppIcon): HTMLElement {
  const image = document.createElement('img')
  image.src = app.artworkUrl
  image.alt = ''
  image.width = 512
  image.height = 512
  image.decoding = 'async'
  image.draggable = false
  image.addEventListener('error', () => image.replaceWith(fallback(app.trackName)))
  return image
}

function fallback(name: string): HTMLElement {
  const node = el('span', 'thumb-fallback')
  node.setAttribute('aria-hidden', 'true')
  node.textContent = name.trim().charAt(0).toUpperCase() || '?'
  return node
}

function required<T extends HTMLElement>(ctor: new () => T, id: string): T {
  const node = document.getElementById(id)
  if (!(node instanceof ctor)) throw new Error(`Missing #${id}`)
  return node
}

function text(id: string, value: string) {
  const node = document.getElementById(id)
  if (node) node.textContent = value
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  return node
}

new AppView()
