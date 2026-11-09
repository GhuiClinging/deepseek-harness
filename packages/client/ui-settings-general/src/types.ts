/** Type-only Electron update declarations shared by the settings UI and Desktop compatibility checks. */

/** Local display data; it neither signs in nor grants access to a Host. */
export interface LocalProfile {
  readonly localNickname: string
  readonly localAvatar: string
}

/** Public browser access status; authentication data stays in Electron. */
export type DesktopWebState =
  | { readonly phase: 'starting' | 'unavailable' }
  | { readonly phase: 'ready'; readonly address: string }

/** Explicit outcome of asking the operating system to open the current Host. */
export type DesktopWebOpenResult = 'opened' | 'unavailable' | 'failed'

/** Optional isolated preload API for the current desktop-owned Host. */
export interface DesktopWebBridge {
  /** @returns The current token-free address and lifecycle status. */
  status(): Promise<DesktopWebState>
  /** @returns Browser launch outcome for the current Host; callers cannot provide a URL. */
  open(): Promise<DesktopWebOpenResult>
  /** @param listener - Receives current Host transitions. @returns Removes this document's subscription. */
  subscribe(listener: (state: DesktopWebState) => void): () => void
}

/** Classified failure copy selected by the Web locale without exposing raw updater diagnostics. */
export type DesktopUpdateFailureKind =
  | 'configuration'
  | 'check'
  | 'check-network'
  | 'download'
  | 'download-network'
  | 'download-space'
  | 'download-permission'
  | 'download-busy'
  | 'install'
  | 'install-network'
  | 'stop-failed'
  | 'tasks-changed'
  | 'tasks-unavailable'
  | 'fullscreen-timeout'

/** Public semantic preload fields consumed by the settings row. */
export interface DesktopUpdatePresentation {
  readonly phase: 'idle' | 'checking' | 'available' | 'downloading' | 'verifying' | 'installing' | 'ready' | 'error'
  readonly version?: string
  readonly percent?: number
  readonly failure?: DesktopUpdateFailureKind
  readonly configurationError?: DesktopChannelState['error']
}

/** Optional carrier API; it cannot select artifacts or authorize installation. */
export interface DesktopUpdateBridge {
  readonly channels?: DesktopChannelBridge
  status(): Promise<DesktopUpdatePresentation>
  open(): Promise<void>
  subscribe(listener: (state: DesktopUpdatePresentation) => void): () => void
}

/** Shared carrier status for the account row and collapsed sidebar badge. */
export interface DesktopUpdateView {
  readonly presentation?: DesktopUpdatePresentation
  readonly failed: boolean
  readonly opening: boolean
}

/** Shell-owned channel choices exposed through the isolated preload. */
export type DesktopUpdateChannel = 'nightly' | 'stable'

/** Current runtime selection and application status; failure never implies a successful switch. */
export interface DesktopChannelState {
  readonly channel: DesktopUpdateChannel | null
  readonly packagedChannel: DesktopUpdateChannel
  readonly changing: boolean
  readonly error?: 'read' | 'format' | 'channel' | 'cleanup'
}

/** Outcome of one UI action; failures are not global updater state. */
export type DesktopChannelChangeResult =
  | { readonly kind: 'applied' | 'unchanged'; readonly state: DesktopChannelState }
  | { readonly kind: 'failed'; readonly state: DesktopChannelState; readonly reason: 'save' | 'format' | 'permission' | 'apply' | 'uncertain' }

/** UI choices persist in the shell configuration, independently of Host settings. */
export interface DesktopChannelBridge {
  /** @returns Current shell selection and application status, without reading disk again. */
  get(): Promise<DesktopChannelState>
  /**
   * @param channel - Explicit user choice to persist and apply.
   * @returns The resulting selection or failure; it does not authorize installation.
   */
  set(channel: DesktopUpdateChannel): Promise<DesktopChannelChangeResult>
  /**
   * @param listener - Receives changes made from any Desktop window.
   * @returns Removes this window's subscription.
   */
  subscribe(listener: (state: DesktopChannelState) => void): () => void
}
/** Accepted local photograph settings shared by every client of one Host. */
export interface AppearancePreferences {
  readonly backgroundFolder: string
  readonly backgroundMinSeconds: number
  readonly backgroundMaxSeconds: number
  /** Absent uses the original folder and interval with regional defaults. */
  readonly backgroundLayout?: BackgroundLayout
}

/** Independently rotating photograph locations. */
export type AppearanceRegion = 'chat' | 'sidebar' | 'unified'

/** Saved source and placement for one background. Uploaded images are bounded raster data URLs. */
export interface BackgroundSettings {
  /** Rotate a directory, display the saved image, or omit the photograph. */
  readonly source: 'gallery' | 'image' | 'none'
  /** Host directory; empty selects bundled images for this region. */
  readonly folder: string
  /** Bounded WebP data URL for a fixed image; empty for other sources. */
  readonly image: string
  /** Preserve the complete image or fill the region with proportional cropping. */
  readonly fit: 'contain' | 'cover'
  /** Scale relative to the fitted image, from 25 to 300 percent. */
  readonly zoom: number
  /** Horizontal alignment and scaling origin, from 0 to 100 percent. */
  readonly x: number
  /** Vertical alignment and scaling origin, from 0 to 100 percent. */
  readonly y: number
  /** Image visibility, from 0 (transparent) to 100 (opaque). */
  readonly opacity: number
  /** Shortest rotation delay in seconds, at least five and no longer than the maximum. */
  readonly minimumSeconds: number
  /** Longest rotation delay in seconds, no longer than 86400. */
  readonly maximumSeconds: number
}

/** Both modes retain their own settings when the user switches between them. */
export interface BackgroundLayout {
  /** Independent regional photographs or one continuous window photograph. */
  readonly mode: 'separate' | 'unified'
  /** Home and Conversation preferences retained in separate mode. */
  readonly chat: BackgroundSettings
  /** Sidebar preferences retained in separate mode. */
  readonly sidebar: BackgroundSettings
  /** Continuous-window preferences retained independently of separate mode. */
  readonly unified: BackgroundSettings
}

/** Authenticated browser-safe image references for one region; filesystem paths stay in the Host. */
export interface AppearanceCatalog {
  readonly images: readonly string[]
  readonly unavailable: boolean
}
