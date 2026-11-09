/** Welcome acknowledgement stored in the plugin configuration. */
import type {} from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-client-connection'
import { AppearanceGallery } from './appearance/gallery.ts'
import { resolveBackgroundLayout } from './appearance/preferences.ts'
import type { BackgroundLayout } from './types.ts'

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
  /** External flat image folder or parent of horizontal/vertical galleries; empty uses packaged backgrounds. */
  backgroundFolder: Volatile<string>
  /** Lower random rotation delay in seconds. */
  backgroundMinSeconds: Volatile<number>
  /** Upper random rotation delay in seconds. */
  backgroundMaxSeconds: Volatile<number>
  /** Optional regional sources, placement, and continuous-window mode; absent uses the shared preferences. */
  backgroundLayout: Volatile<BackgroundLayout | undefined>
}

const background = z.object({
  source: z.union(['gallery', 'image', 'none']).required(),
  folder: z.string().max(4096).pattern(/^[^\u0000-\u001f\u007f]*$/u).required(),
  image: z.string().max(1_400_000).pattern(/^(?:|data:image\/webp;base64,UklGR[A-Za-z0-9+/]*={0,2})$/u).required(),
  fit: z.union(['contain', 'cover']).required(),
  zoom: z.number().min(25).max(300).required(),
  x: z.number().min(0).max(100).required(),
  y: z.number().min(0).max(100).required(),
  opacity: z.number().min(0).max(100).required(),
  minimumSeconds: z.natural().min(5).max(86400).required(),
  maximumSeconds: z.natural().min(5).max(86400).required(),
})

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
  backgroundLayout: z.union([z.object({ mode: z.union(['separate', 'unified']).required(),
    chat: background.required(), sidebar: background.required(), unified: background.required() }), z.const(undefined)]).volatile(),
})

/** The browser consumes the configuration form projection.
 * @param ctx Plugin context used for optional settings presentation.
 * @param config Accepted settings and application-owned artwork directory.
 */
export function apply(ctx: Context, config: Config): void {
  ctx.inject(['settings'], (child) => { child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)) })
  const brandAssetsDirectory = process.env.DSH_BRAND_ASSETS_DIRECTORY ?? config.brandAssetsDirectory
  if (!config.brandAppearance && brandAssetsDirectory === '') return
  const gallery = new AppearanceGallery((region) => {
    const layout = config.backgroundLayout.get()
    return { folder: resolveBackgroundLayout({
      backgroundFolder: config.backgroundFolder.get(), backgroundMinSeconds: config.backgroundMinSeconds.get(),
      backgroundMaxSeconds: config.backgroundMaxSeconds.get(), ...(layout === undefined ? {} : { backgroundLayout: layout }),
    })[region].folder, builtinDirectory: brandAssetsDirectory }
  })
  ctx.inject(['connection'], (child) => {
    for (const [path, fetch] of [
      ['/api/brand-appearance/catalog', async (request: Request) => {
        const region = new URL(request.url).searchParams.get('region') ?? 'chat'
        if (region !== 'chat' && region !== 'sidebar' && region !== 'unified') return new Response(null, { status: 400 })
        return Response.json(await gallery.catalog(region))
      }],
      ['/api/brand-appearance/image', (request: Request) => gallery.image(request)],
      ['/api/brand-appearance/logo', () => gallery.logo()],
    ] as const) {
      child.effect(() => child.connection.fetch.register({ path, methods: ['GET'], requestBody: 'buffered', fetch }),
        `brand appearance: ${path}`)
    }
    child.effect(() => child.connection.fetch.register({ path: '/api/brand-appearance/preview', methods: ['POST'], requestBody: 'buffered',
      fetch: async (request: Request) => {
        let input: unknown
        try { input = await request.json() }
        catch (_error) { return new Response(null, { status: 400 }) }
        if (typeof input !== 'object' || input === null || !('region' in input) || !('folder' in input)
          || (input.region !== 'chat' && input.region !== 'sidebar' && input.region !== 'unified')
          || typeof input.folder !== 'string' || input.folder.length > 4096 || /[\u0000-\u001f\u007f]/u.test(input.folder)) {
          return new Response(null, { status: 400 })
        }
        return Response.json(await gallery.preview(input.region, input.folder.trim()))
      },
    }), 'brand appearance: draft preview')
  })
}
