/** Atomic local display-profile edits over the existing Host settings form. */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { LocalProfile } from '../types.ts'

/** Save status shared by the editor and its shell-owned toast. */
export interface LocalProfileSaveState {
  readonly saving: boolean
  readonly notice?: { readonly sequence: number; readonly kind: 'saved' | 'failed' }
}

/** Does not create an account or modify model credentials. */
export class LocalProfileSource {
  /** Shared framework-observed operation status. */
  readonly store = createSnapshotStore<LocalProfileSaveState>({ saving: false })
  private live = true
  private sequence = 0

  /** @param form - Host-owned settings form shared by every client of this Host. */
  constructor(readonly form: ConfigForm<LocalProfile>) {}

  /**
   * Persist both fields in one revision-fenced mutation.
   * @param value - User-selected nickname and normalized avatar.
   * @returns Whether the Host accepted both values; failures leave accepted data visible.
   */
  async save(value: LocalProfile): Promise<boolean> {
    if (!this.isLive() || this.store.getSnapshot().saving) return false
    const localNickname = value.localNickname.trim()
    this.store.set({ ...this.store.getSnapshot(), saving: true })
    let accepted = false
    try {
      accepted = await this.form.mutate([
        { op: 'set', path: ['localNickname'], value: localNickname },
        { op: 'set', path: ['localAvatar'], value: value.localAvatar },
      ])
      const saved = this.form.getSnapshot().value
      accepted = accepted && saved?.localNickname === localNickname && saved.localAvatar === value.localAvatar
    } catch (_error) {
      // The shared form owns a recovery read; this operation reports no confirmed save.
    }
    if (this.isLive()) this.store.set({ saving: false, notice: { sequence: ++this.sequence, kind: accepted ? 'saved' : 'failed' } })
    return accepted
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

  /** Ignore late save outcomes after the owning plugin unloads. */
  dispose(): void { this.live = false }

  private isLive(): boolean { return this.live }
}
