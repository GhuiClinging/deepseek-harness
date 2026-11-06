/** Welcome acknowledgement stored in the plugin configuration. */
import type {} from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-client-connection'
import { AppearanceGallery } from './appearance/gallery.ts'

import type { Volatile, Context } from '@deepseek-ai/cordis'

import z from '@deepseek-ai/schemastery'

/** Runtime preferences projected to the browser. */
export interface Config {
  /** Last acknowledged welcome notice version. */
  welcomeNoticeVersion: Volatile<string | undefined>
  /** Local display name, independent of remote accounts and model credentials. */
  localNickname: Volatile<string>
  /** Bounded PNG data URL; empty selects the built-in user icon. */
  localAvatar: Volatile<string>
  /** Enables the selected brand's scoped photograph presentation. */
  brandAppearance: boolean
  /** Immutable packaged artwork directory, supplied by Desktop composition. */
  brandAssetsDirectory: string
  /** External image folder; empty uses packaged backgrounds. */
  backgroundFolder: Volatile<string>
  /** Lower random rotation delay in seconds. */
  backgroundMinSeconds: Volatile<number>
  /** Upper random rotation delay in seconds. */
  backgroundMaxSeconds: Volatile<number>
}

/** Live welcome preference. */
export const Config = z.object({
  welcomeNoticeVersion: z.string().volatile(),
  localNickname: z.string().max(64).pattern(/^[^\u0000-\u001f\u007f]*$/u).default('').volatile(),
  localAvatar: z.string().max(100_000).pattern(/^(?:|data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2})$/u).default('').volatile(),
  brandAppearance: z.boolean().default(false),
  brandAssetsDirectory: z.string().default(''),
  backgroundFolder: z.string().max(4096).pattern(/^[^\u0000-\u001f\u007f]*$/u).default('').volatile(),
  backgroundMinSeconds: z.natural().min(5).max(86400).default(300).volatile(),
  backgroundMaxSeconds: z.natural().min(5).max(86400).default(900).volatile(),
})

/** The browser consumes the configuration form projection.
 * @param ctx Plugin context used for optional settings presentation.
 * @param config Accepted settings and application-owned artwork directory.
 */
export function apply(ctx: Context, config: Config): void {
  ctx.inject(['settings'], (child) => { child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)) })
  if (!config.brandAppearance) return
  const gallery = new AppearanceGallery(() => ({ folder: config.backgroundFolder.get(), builtinDirectory: config.brandAssetsDirectory }))
  ctx.inject(['connection'], (child) => {
    for (const [path, fetch] of [
      ['/api/brand-appearance/catalog', async () => Response.json(await gallery.catalog())],
      ['/api/brand-appearance/image', (request: Request) => gallery.image(request)],
      ['/api/brand-appearance/logo', () => gallery.logo()],
    ] as const) {
      child.effect(() => child.connection.fetch.register({ path, methods: ['GET'], requestBody: 'buffered', fetch }),
        `brand appearance: ${path}`)
    }
  })
}
