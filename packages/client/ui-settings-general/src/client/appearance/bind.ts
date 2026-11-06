/** DOM effects for regional brand presentation, reversible with the owning plugin. */
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { AppearancePreferences } from '../../types.ts'
import { AppearanceSource } from './source.ts'
import css from './Appearance.module.css'

/**
 * Connect a Host form to scoped photograph variables without changing global colors.
 * @param form - Existing accepted General settings.
 * @returns Source and cleanup restoring the document's prior presentation.
 */
export function bindAppearance(form: ConfigForm<AppearancePreferences>): { source: AppearanceSource; dispose(): void } {
  const root = document.documentElement
  const properties = ['--dsh-brand-chat-image', '--dsh-brand-sidebar-image'] as const
  const previous = properties.map(name => ({ name, value: root.style.getPropertyValue(name),
    priority: root.style.getPropertyPriority(name) }))
  const activeClass = css.active
  if (activeClass === undefined) throw new Error('brand appearance stylesheet is missing its active class')
  const hadClass = root.classList.contains(activeClass)
  const source = new AppearanceSource(form, {
    fetch: signal => fetch(new URL('api/brand-appearance/catalog', document.baseURI), { signal, credentials: 'same-origin' }),
    load: async (url) => { const image = new Image(); image.src = url; await image.decode() },
    show: (region, url) => { root.style.setProperty(`--dsh-brand-${region}-image`, `url("${url}")`) },
    activate: (enabled) => { root.classList.toggle(activeClass, enabled || hadClass) },
    random: Math.random,
  })
  return { source, dispose: () => {
    source.dispose()
    root.classList.toggle(activeClass, hadClass)
    for (const { name, value, priority } of previous) {
      if (value === '') root.style.removeProperty(name)
      else root.style.setProperty(name, value, priority)
    }
  } }
}
