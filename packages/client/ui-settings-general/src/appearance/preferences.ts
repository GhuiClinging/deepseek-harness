/** Resolve saved regional preferences, including installations using the original shared folder. */
import type { AppearancePreferences, BackgroundLayout, BackgroundSettings } from '../types.ts'

/**
 * Resolve omitted layout settings from the original folder and interval; saved layouts stay unchanged.
 * @param preferences - Accepted General preferences.
 * @returns Complete settings using one continuous-window background until a layout is saved.
 */
export function resolveBackgroundLayout(preferences: AppearancePreferences): BackgroundLayout {
  if (preferences.backgroundLayout !== undefined) return preferences.backgroundLayout
  const common: BackgroundSettings = { source: 'gallery', folder: preferences.backgroundFolder, image: '',
    fit: 'cover', zoom: 100, x: 50, y: 50, opacity: 40,
    minimumSeconds: preferences.backgroundMinSeconds, maximumSeconds: preferences.backgroundMaxSeconds }
  return { mode: 'unified', chat: { ...common }, unified: { ...common },
    sidebar: { ...common, fit: 'contain', opacity: 65 } }
}
