/** One token-free desktop browser subscription shared by the footer and operation toast. */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { DesktopWebBridge, DesktopWebState } from '../types.ts'

/** Current Host status and the latest user-requested browser launch outcome. */
export interface DesktopWebSnapshot {
  readonly host?: DesktopWebState
  readonly opening: boolean
  readonly failed: boolean
  readonly notice?: { readonly sequence: number; readonly kind: 'failed' | 'unavailable' }
}

/** Observes Electron without retaining an authenticated URL in the client. */
export class DesktopWebSource {
  /** Shared framework-observed entry and feedback state. */
  readonly store = createSnapshotStore<DesktopWebSnapshot>({ opening: false, failed: false })
  private live = true
  private received = false
  private sequence = 0
  private readonly unsubscribe: () => void

  /** @param bridge - Isolated Electron API available only to the main application document. */
  constructor(private readonly bridge: DesktopWebBridge) {
    this.unsubscribe = bridge.subscribe((host) => {
      if (!this.live) return
      this.received = true
      this.store.set({ ...this.store.getSnapshot(), host, failed: false })
    })
    void bridge.status().then((host) => {
      if (this.live && !this.received) this.store.set({ ...this.store.getSnapshot(), host })
    }, () => {
      if (this.live && !this.received) this.store.set({ ...this.store.getSnapshot(), failed: true })
    })
  }

  /**
   * Open the current Host once for this explicit action.
   * @returns Completion of one launch request; concurrent clicks do not open duplicate windows.
   */
  async open(): Promise<void> {
    if (!this.isLive() || this.store.getSnapshot().opening) return
    this.store.set({ ...this.store.getSnapshot(), opening: true })
    let result: 'opened' | 'failed' | 'unavailable'
    try { result = await this.bridge.open() }
    catch (_error) { result = 'failed' }
    if (!this.isLive()) return
    this.store.set({ ...this.store.getSnapshot(), opening: false,
      ...(result === 'opened' ? {} : { notice: { sequence: ++this.sequence, kind: result } }),
    })
  }

  /** Dismiss the outcome whose toast completed.
   * @param sequence - Outcome identity captured by the toast.
   */
  dismiss(sequence: number): void {
    const current = this.store.getSnapshot()
    if (current.notice?.sequence !== sequence) return
    const { notice: _notice, ...next } = current
    this.store.set(next)
  }

  /** Release subscriptions and ignore late asynchronous results. */
  dispose(): void { this.live = false; this.unsubscribe() }

  private isLive(): boolean { return this.live }
}
