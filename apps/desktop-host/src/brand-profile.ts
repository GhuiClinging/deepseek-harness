/** Private Desktop-to-Host brand patch, artwork directory, and persona inputs. */
import { isAbsolute } from 'node:path'
import { loadOverlayPatches } from '@deepseek-ai/dsh-app-boot'

/**
 * Resolve the explicit application overlay without accepting an ambient persona alone.
 * @param environment - parent-owned Host environment.
 * @returns ordered runProfile overlays and the shipped presets' internal persona input.
 */
export function desktopBrandProfileOptions(environment: NodeJS.ProcessEnv): {
  patchFiles: string[]
  personaPrefix: string | undefined
  appearanceAssetsDirectory: string | undefined
} {
  const path = environment.DSH_DESKTOP_BRAND_PATCH
  if (path === undefined) return { patchFiles: [], personaPrefix: undefined, appearanceAssetsDirectory: undefined }
  if (!isAbsolute(path)) throw new Error('desktop brand: DSH_DESKTOP_BRAND_PATCH must be absolute')
  loadOverlayPatches('desktop brand', path)
  const personaPrefix = environment.DSH_DESKTOP_PERSONA_PREFIX
  if (personaPrefix === undefined || personaPrefix.trim().length === 0) {
    throw new Error('desktop brand: DSH_DESKTOP_PERSONA_PREFIX must be nonempty with a selected patch')
  }
  const appearanceAssetsDirectory = environment.DSH_BRAND_ASSETS_DIRECTORY
  if (appearanceAssetsDirectory !== undefined && !isAbsolute(appearanceAssetsDirectory)) {
    throw new Error('desktop brand: DSH_BRAND_ASSETS_DIRECTORY must be absolute')
  }
  return { patchFiles: [path], personaPrefix, appearanceAssetsDirectory }
}
