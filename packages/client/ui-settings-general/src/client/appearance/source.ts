/** Disposable regional image selection over the existing Host settings form. */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { AppearanceCatalog, AppearancePreferences } from '../../types.ts'

/** Independent photographic regions; standalone panels are deliberately absent. */
export type AppearanceRegion = 'chat' | 'sidebar'

/** Observable view and operation state. */
export interface AppearanceState {
  readonly count: number
  readonly current: Partial<Record<AppearanceRegion, string>>
  readonly paused: boolean
  readonly saving: boolean
  readonly problem?: 'folder' | 'empty' | 'range' | 'load'
  readonly notice?: { readonly sequence: number; readonly kind: 'saved' | 'failed' }
}

/** Browser effects supplied by the plugin owner, outside React components. */
export interface AppearanceEffects {
  fetch(signal: AbortSignal): Promise<Response>
  load(url: string): Promise<void>
  show(region: AppearanceRegion, url: string): void
  activate(enabled: boolean): void
  random(): number
}

function parseCatalog(value: unknown): AppearanceCatalog {
  if (typeof value !== 'object' || value === null || !('images' in value) || !Array.isArray(value.images)
    || value.images.length > 500 || value.images.some(url => typeof url !== 'string'
      || !/^\/api\/brand-appearance\/image\?key=[a-f0-9]{64}$/u.test(url))
    || !('unavailable' in value) || typeof value.unavailable !== 'boolean') throw new Error('invalid appearance catalog')
  return { images: value.images as string[], unavailable: value.unavailable }
}

/** Owns one form subscription, one current request and one deadline per region. */
export class AppearanceSource {
  /** Shared settings-editor and toast state. */
  readonly store = createSnapshotStore<AppearanceState>({ count: 0, current: {}, paused: false, saving: false })
  private readonly timers = new Map<AppearanceRegion, ReturnType<typeof setTimeout>>()
  private images: readonly string[] = []
  private request: AbortController | undefined
  private revision = 0
  private key = ''
  private live = true
  private sequence = 0
  private readonly unsubscribe: () => void

  /** @param form - Existing Host form. @param effects - Browser operations owned by the plugin. */
  constructor(readonly form: ConfigForm<AppearancePreferences>, private readonly effects: AppearanceEffects) {
    this.unsubscribe = form.subscribe(() => { void this.refresh() })
    void this.refresh()
  }

  private clearTimers(): void {
    for (const timer of this.timers.values()) clearTimeout(timer)
    this.timers.clear()
  }

  private isLive(): boolean { return this.live }

  private async refresh(force = false): Promise<void> {
    const value = this.form.getSnapshot().value
    if (!this.isLive() || value === undefined) return
    const key = JSON.stringify([value.backgroundFolder, value.backgroundMinSeconds, value.backgroundMaxSeconds])
    if (!force && key === this.key) return
    this.key = key
    const revision = ++this.revision
    this.clearTimers()
    this.request?.abort()
    this.effects.activate(true)
    if (value.backgroundMinSeconds < 5 || value.backgroundMaxSeconds > 86400
      || value.backgroundMinSeconds > value.backgroundMaxSeconds) {
      this.store.set({ ...this.store.getSnapshot(), problem: 'range' })
      return
    }
    const request = new AbortController()
    this.request = request
    try {
      const response = await this.effects.fetch(request.signal)
      if (!response.ok) throw new Error('appearance catalog unavailable')
      const body: unknown = await response.json()
      const { images, unavailable } = parseCatalog(body)
      if (!this.isLive() || revision !== this.revision) return
      if (unavailable || images.length === 0) {
        this.store.set({ ...this.store.getSnapshot(), problem: unavailable ? 'folder' : 'empty' })
        for (const region of ['chat', 'sidebar'] as const) this.schedule(region)
        return
      }
      this.images = images
      const { problem: _problem, ...state } = this.store.getSnapshot()
      this.store.set({ ...state, count: images.length })
      await Promise.all(['chat', 'sidebar'].map(region => this.next(region as AppearanceRegion)))
    } catch (_error) {
      // Accepted images remain visible while a directory or transport cannot be read.
      if (this.isLive() && revision === this.revision) {
        this.store.set({ ...this.store.getSnapshot(), problem: 'folder' })
        for (const region of ['chat', 'sidebar'] as const) this.schedule(region)
      }
    }
  }

  private schedule(region: AppearanceRegion): void {
    const value = this.form.getSnapshot().value
    if (!this.isLive() || this.store.getSnapshot().paused || value === undefined) return
    clearTimeout(this.timers.get(region))
    const seconds = value.backgroundMinSeconds + this.effects.random() * (value.backgroundMaxSeconds - value.backgroundMinSeconds)
    this.timers.set(region, setTimeout(() => { void this.rotate(region) }, seconds * 1000))
  }

  private async rotate(region: AppearanceRegion): Promise<void> {
    const request = this.request
    if (!this.isLive() || request === undefined || request.signal.aborted) return
    const revision = this.revision
    try {
      const response = await this.effects.fetch(request.signal)
      if (!response.ok) throw new Error('appearance catalog unavailable')
      const body: unknown = await response.json()
      const catalog = parseCatalog(body)
      if (!this.isLive() || revision !== this.revision) return
      if (catalog.unavailable || catalog.images.length === 0) {
        this.store.set({ ...this.store.getSnapshot(), problem: catalog.unavailable ? 'folder' : 'empty' })
        this.schedule(region)
        return
      }
      this.images = catalog.images
      const { problem: _problem, ...state } = this.store.getSnapshot()
      this.store.set({ ...state, count: catalog.images.length })
      await this.next(region)
    } catch (_error) {
      // A failed rescan retains the accepted image and retries at the next regional deadline.
      if (this.isLive() && revision === this.revision) {
        this.store.set({ ...this.store.getSnapshot(), problem: 'folder' })
        this.schedule(region)
      }
    }
  }

  private async next(region: AppearanceRegion): Promise<void> {
    if (!this.isLive() || this.images.length === 0) return
    clearTimeout(this.timers.get(region))
    const revision = this.revision
    const previous = this.store.getSnapshot().current[region]
    const alternatives = this.images.filter(url => url !== previous)
    const candidates = alternatives.length > 0 ? alternatives : this.images
    const url = candidates[Math.floor(this.effects.random() * candidates.length)]
    if (url === undefined) return
    try {
      if (url !== previous) await this.effects.load(url)
      if (!this.isLive() || revision !== this.revision) return
      this.effects.show(region, url)
      this.store.set({ ...this.store.getSnapshot(), current: { ...this.store.getSnapshot().current, [region]: url } })
    } catch (_error) {
      // Failed decoding leaves this region's accepted image in place.
      if (this.isLive() && revision === this.revision) this.store.set({ ...this.store.getSnapshot(), problem: 'load' })
    }
    if (revision === this.revision) this.schedule(region)
  }

  /** Reload the folder before manually choosing the next image for both regions. */
  async shuffle(): Promise<void> { await this.refresh(true) }

  /** Pause or resume this client's automatic background changes. */
  togglePaused(): void {
    const paused = !this.store.getSnapshot().paused
    ++this.revision
    this.clearTimers()
    this.store.set({ ...this.store.getSnapshot(), paused })
    if (!paused) for (const region of ['chat', 'sidebar'] as const) this.schedule(region)
  }

  /**
   * Save directory and interval together through the existing form.
   * @param value - User-selected folder and bounded delay range.
   * @returns Whether the Host accepted all three values.
   */
  async save(value: AppearancePreferences): Promise<boolean> {
    if (!this.isLive() || this.store.getSnapshot().saving) return false
    this.store.set({ ...this.store.getSnapshot(), saving: true })
    let accepted = false
    try {
      accepted = await this.form.mutate([
        { op: 'set', path: ['backgroundFolder'], value: value.backgroundFolder.trim() },
        { op: 'set', path: ['backgroundMinSeconds'], value: value.backgroundMinSeconds },
        { op: 'set', path: ['backgroundMaxSeconds'], value: value.backgroundMaxSeconds },
      ])
      const saved = this.form.getSnapshot().value
      accepted = accepted && saved?.backgroundFolder === value.backgroundFolder.trim()
        && saved.backgroundMinSeconds === value.backgroundMinSeconds && saved.backgroundMaxSeconds === value.backgroundMaxSeconds
    } catch (_error) {
      // ConfigForm owns recovery; no unconfirmed write is presented as saved.
    }
    if (this.isLive()) this.store.set({ ...this.store.getSnapshot(), saving: false,
      notice: { sequence: ++this.sequence, kind: accepted ? 'saved' : 'failed' } })
    return accepted
  }

  /** Dismiss only the operation whose app-wide toast completed.
   * @param sequence - Operation identity.
   */
  dismiss(sequence: number): void {
    const state = this.store.getSnapshot()
    if (state.notice?.sequence !== sequence) return
    const { notice: _notice, ...rest } = state
    this.store.set(rest)
  }

  /** Drain subscriptions and retire every pending image and deadline. */
  dispose(): void {
    this.live = false
    ++this.revision
    this.unsubscribe()
    this.request?.abort()
    this.clearTimers()
    this.effects.activate(false)
  }
}
