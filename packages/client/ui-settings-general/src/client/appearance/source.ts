/** Disposable regional image selection over the existing Host settings form. */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { AppearanceCatalog, AppearancePreferences, AppearanceRegion, BackgroundLayout } from '../../types.ts'
import { resolveBackgroundLayout } from '../../appearance/preferences.ts'

/** Independent photographic regions; standalone panels are deliberately absent. */
export type { AppearanceRegion } from '../../types.ts'

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
  fetch(signal: AbortSignal, region: AppearanceRegion): Promise<Response>
  load(url: string): Promise<void>
  show(region: AppearanceRegion, url: string): void
  /** Undefined removes the presentation; a layout applies all regional parameters. */
  activate(layout: BackgroundLayout | undefined): void
  random(): number
}

/**
 * Validate the authenticated catalog response before assigning browser image URLs.
 * @param value - Untrusted Host JSON.
 * @returns Validated opaque image references.
 * @throws For invalid catalog fields or URLs.
 */
export function parseAppearanceCatalog(value: unknown): AppearanceCatalog {
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
  private readonly images: Record<AppearanceRegion, readonly string[]> = { chat: [], sidebar: [], unified: [] }
  private readonly problems = new Map<AppearanceRegion, NonNullable<AppearanceState['problem']>>()
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

  private problem(region: AppearanceRegion, problem?: NonNullable<AppearanceState['problem']>): void {
    if (problem === undefined) this.problems.delete(region)
    else this.problems.set(region, problem)
    const value = this.form.getSnapshot().value
    if (value === undefined) return
    const regions: readonly AppearanceRegion[] = resolveBackgroundLayout(value).mode === 'unified' ? ['unified'] : ['chat', 'sidebar']
    const issue = regions.map(name => this.problems.get(name)).find(item => item !== undefined)
    const { problem: _previous, ...state } = this.store.getSnapshot()
    this.store.set(issue === undefined ? state : { ...state, problem: issue })
  }

  private async refresh(force = false): Promise<void> {
    const value = this.form.getSnapshot().value
    if (!this.isLive() || value === undefined) return
    const layout = resolveBackgroundLayout(value)
    const key = JSON.stringify(layout)
    if (!force && key === this.key) return
    this.key = key
    ++this.revision
    this.clearTimers()
    this.request?.abort()
    this.effects.activate(layout)
    const regions: readonly AppearanceRegion[] = layout.mode === 'unified' ? ['unified'] : ['chat', 'sidebar']
    if (regions.some(region => layout[region].minimumSeconds < 5 || layout[region].maximumSeconds > 86400
      || layout[region].minimumSeconds > layout[region].maximumSeconds)) {
      this.store.set({ ...this.store.getSnapshot(), problem: 'range' })
      return
    }
    const request = new AbortController()
    this.request = request
    await Promise.all(regions.map(region => this.rotate(region)))
  }

  private schedule(region: AppearanceRegion): void {
    const value = this.form.getSnapshot().value
    if (!this.isLive() || this.store.getSnapshot().paused || value === undefined) return
    const background = resolveBackgroundLayout(value)[region]
    if (background.source !== 'gallery') return
    clearTimeout(this.timers.get(region))
    const seconds = background.minimumSeconds + this.effects.random() * (background.maximumSeconds - background.minimumSeconds)
    this.timers.set(region, setTimeout(() => { void this.rotate(region) }, seconds * 1000))
  }

  private async rotate(region: AppearanceRegion): Promise<void> {
    const request = this.request
    if (!this.isLive() || request === undefined || request.signal.aborted) return
    const revision = this.revision
    try {
      const value = this.form.getSnapshot().value
      if (value === undefined) return
      const background = resolveBackgroundLayout(value)[region]
      if (background.source !== 'gallery') {
        this.problem(region)
        this.images[region] = background.source === 'image' && background.image !== '' ? [background.image] : []
        if (this.images[region].length > 0) await this.next(region)
        else {
          this.effects.show(region, '')
          this.store.set({ ...this.store.getSnapshot(), current: { ...this.store.getSnapshot().current, [region]: '' } })
        }
        return
      }
      const response = await this.effects.fetch(request.signal, region)
      if (!response.ok) throw new Error('appearance catalog unavailable')
      const body: unknown = await response.json()
      const catalog = parseAppearanceCatalog(body)
      if (!this.isLive() || revision !== this.revision) return
      if (catalog.unavailable || catalog.images.length === 0) {
        this.problem(region, catalog.unavailable ? 'folder' : 'empty')
        this.schedule(region)
        return
      }
      this.images[region] = catalog.images
      this.problem(region)
      this.store.set({ ...this.store.getSnapshot(), count: new Set(Object.values(this.images).flat()).size })
      await this.next(region)
    } catch (_error) {
      // A failed rescan retains the accepted image and retries at the next regional deadline.
      if (this.isLive() && revision === this.revision) {
        this.problem(region, 'folder')
        this.schedule(region)
      }
    }
  }

  private async next(region: AppearanceRegion): Promise<void> {
    const images = this.images[region]
    if (!this.isLive() || images.length === 0) return
    clearTimeout(this.timers.get(region))
    const revision = this.revision
    const previous = this.store.getSnapshot().current[region]
    const alternatives = images.filter(url => url !== previous)
    const candidates = alternatives.length > 0 ? alternatives : images
    const url = candidates[Math.floor(this.effects.random() * candidates.length)]
    if (url === undefined) return
    try {
      if (url !== previous) await this.effects.load(url)
      if (!this.isLive() || revision !== this.revision) return
      this.effects.show(region, url)
      this.problem(region)
      this.store.set({ ...this.store.getSnapshot(), current: { ...this.store.getSnapshot().current, [region]: url } })
    } catch (_error) {
      // Failed decoding leaves this region's accepted image in place.
      if (this.isLive() && revision === this.revision) this.problem(region, 'load')
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
    const value = this.form.getSnapshot().value
    if (!paused && value !== undefined) {
      const regions: readonly AppearanceRegion[] = resolveBackgroundLayout(value).mode === 'unified' ? ['unified'] : ['chat', 'sidebar']
      for (const region of regions) this.schedule(region)
    }
  }

  /**
   * Save sources, placement, and intervals atomically through the existing form.
   * @param value - User-selected appearance preferences.
   * @returns Whether the Host accepted the complete preferences.
   */
  async save(value: AppearancePreferences): Promise<boolean> {
    if (!this.isLive() || this.store.getSnapshot().saving) return false
    this.store.set({ ...this.store.getSnapshot(), saving: true })
    let accepted = false
    try {
      const layout = value.backgroundLayout
      const serialized = layout === undefined ? undefined : {
        mode: layout.mode, chat: { ...layout.chat }, sidebar: { ...layout.sidebar }, unified: { ...layout.unified },
      }
      accepted = await this.form.mutate([
        { op: 'set', path: ['backgroundFolder'], value: value.backgroundFolder.trim() },
        { op: 'set', path: ['backgroundMinSeconds'], value: value.backgroundMinSeconds },
        { op: 'set', path: ['backgroundMaxSeconds'], value: value.backgroundMaxSeconds },
        ...(serialized === undefined ? [] : [{ op: 'set' as const, path: ['backgroundLayout'], value: serialized }]),
      ])
      const saved = this.form.getSnapshot().value
      accepted = accepted && saved?.backgroundFolder === value.backgroundFolder.trim()
        && saved.backgroundMinSeconds === value.backgroundMinSeconds && saved.backgroundMaxSeconds === value.backgroundMaxSeconds
        && JSON.stringify(saved.backgroundLayout) === JSON.stringify(value.backgroundLayout)
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
    this.effects.activate(undefined)
  }
}
