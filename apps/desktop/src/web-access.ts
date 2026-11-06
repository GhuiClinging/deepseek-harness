/** Main-owned authenticated browser launch with token-free renderer status. */
import type { DesktopWebState, DesktopWebOpenResult } from '@deepseek-ai/dsh-client-ui-settings-general/types'

/** The current Host is the only browser destination accepted by the desktop shell. */
export class DesktopWebAccess {
  private url: string | undefined
  private state: DesktopWebState = { phase: 'starting' }

  /**
   * @param launch - system browser opener owned by Electron.
   * @param publish - sends token-free state to owned documents.
   */
  constructor(private readonly launch: (url: string) => Promise<void>, private readonly publish: (state: DesktopWebState) => void) {}

  /** @returns Current address without authentication data. */
  status(): DesktopWebState { return this.state }

  /**
   * Accept the owned Host's ready message; malformed process data stops startup.
   * @param value - current authenticated root URL supplied by the Host process.
   */
  ready(value: string): void {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.hostname !== '127.0.0.1'
      || url.username !== '' || url.password !== '' || url.pathname !== '/' || url.hash !== ''
      || url.searchParams.get('token') === null || url.searchParams.get('token') === '') {
      throw new Error('desktop browser: invalid Host launch address')
    }
    this.url = url.href
    this.state = { phase: 'ready', address: `${url.origin}/` }
    this.publish(this.state)
  }

  /**
   * Retire the address before restart, shutdown, or an unexpected Host exit.
   * @param phase - replacement lifecycle state.
   */
  reset(phase: 'starting' | 'unavailable'): void {
    this.url = undefined
    this.state = { phase }
    this.publish(this.state)
  }

  /** @returns Browser launch result; no URL can be selected by the renderer. */
  async open(): Promise<DesktopWebOpenResult> {
    if (this.url === undefined) return 'unavailable'
    try { await this.launch(this.url) }
    catch (_error) { return 'failed' }
    return 'opened'
  }
}
