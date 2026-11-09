/** DOM effects for regional brand presentation, reversible with the owning plugin. */
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { AppearanceCatalog, AppearancePreferences, AppearanceRegion } from '../../types.ts'
import { AppearanceSource, parseAppearanceCatalog } from './source.ts'
import css from './Appearance.module.css'

/**
 * Connect a Host form to scoped photograph variables without changing global colors.
 * @param form - Existing accepted General settings.
 * @returns Source and cleanup restoring the document's prior presentation.
 */
export function bindAppearance(form: ConfigForm<AppearancePreferences>): {
  source: AppearanceSource
  previewFolder: (region: AppearanceRegion, folder: string, signal: AbortSignal) => Promise<AppearanceCatalog>
  dispose(): void
} {
  const root = document.documentElement
  const regions = ['chat', 'sidebar', 'unified'] as const
  const properties = regions.flatMap(region => ['image', 'fit', 'zoom', 'x', 'y', 'opacity'].map(field => `--dsh-brand-${region}-${field}`))
  const previous = properties.map(name => ({ name, value: root.style.getPropertyValue(name),
    priority: root.style.getPropertyPriority(name) }))
  const activeClass = css.active
  if (activeClass === undefined) throw new Error('brand appearance stylesheet is missing its active class')
  const hadClass = root.classList.contains(activeClass)
  const unifiedClass = css.unified
  if (unifiedClass === undefined) throw new Error('brand appearance stylesheet is missing its unified class')
  const hadUnifiedClass = root.classList.contains(unifiedClass)
  const source = new AppearanceSource(form, {
    fetch: (signal, region) => fetch(new URL(`api/brand-appearance/catalog?region=${region}`, document.baseURI), { signal, credentials: 'same-origin' }),
    load: async (url) => { const image = new Image(); image.src = url; await image.decode() },
    show: (region, url) => { root.style.setProperty(`--dsh-brand-${region}-image`, url === '' ? 'none' : `url("${url}")`) },
    activate: (layout) => {
      root.classList.toggle(activeClass, layout !== undefined || hadClass)
      root.classList.toggle(unifiedClass, layout?.mode === 'unified' || hadUnifiedClass)
      if (layout === undefined) return
      for (const region of regions) {
        const value = layout[region]
        for (const [field, setting] of Object.entries({ fit: value.fit, zoom: value.zoom / 100,
          x: `${value.x}%`, y: `${value.y}%`, opacity: value.opacity / 100 })) {
          root.style.setProperty(`--dsh-brand-${region}-${field}`, String(setting))
        }
      }
    },
    random: Math.random,
  })
  return { source, previewFolder: async (region, folder, signal) => {
    const response = await fetch(new URL('api/brand-appearance/preview', document.baseURI), {
      method: 'POST', credentials: 'same-origin', signal, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ region, folder }),
    })
    if (!response.ok) throw new Error('background preview unavailable')
    const body: unknown = await response.json()
    const catalog = parseAppearanceCatalog(body)
    const first = catalog.images[0]
    if (!catalog.unavailable && first !== undefined) {
      const image = new Image()
      image.src = first
      await image.decode()
    }
    return catalog
  }, dispose: () => {
    source.dispose()
    root.classList.toggle(activeClass, hadClass)
    root.classList.toggle(unifiedClass, hadUnifiedClass)
    for (const { name, value, priority } of previous) {
      if (value === '') root.style.removeProperty(name)
      else root.style.setProperty(name, value, priority)
    }
  } }
}
