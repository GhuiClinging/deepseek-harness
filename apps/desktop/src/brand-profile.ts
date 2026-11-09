/** Installation-external identity, editable persona, and application-owned composition. */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseDesktopBrand, type DesktopBrand, type DesktopBrandPersona } from './brand.ts'

/** Non-secret renderer snapshot; role edits become visible after application restart. */
export interface DesktopBrandPresentation {
  readonly name: string
  readonly wordmark: string
  readonly mark: string
  readonly logo?: '/api/brand-appearance/logo'
  readonly authenticationMode: 'account'
  readonly updates: 'manual'
  readonly persona: Pick<DesktopBrandPersona, 'name' | 'address' | 'greeting'>
}

/** @param manifest - installed application metadata. @returns selected validated brand, or undefined for upstream. */
export function desktopBrandFromManifest(manifest: unknown): DesktopBrand | undefined {
  if (typeof manifest !== 'object' || manifest === null) throw new Error('desktop brand: invalid application manifest')
  return 'dshDesktopBrand' in manifest ? parseDesktopBrand(manifest.dshDesktopBrand) : undefined
}

/**
 * @param brand - validated identity.
 * @param userHome - OS home.
 * @param appData - Electron application-data root.
 * @returns isolated data roots.
 */
export function desktopBrandPaths(
  brand: DesktopBrand, userHome: string, appData: string,
): {
  home: string
  userData: string
  logs: string
} {
  const userData = join(appData, brand.storageNamespace)
  return { home: join(userHome, `.${brand.storageNamespace}`), userData, logs: join(userData, 'logs') }
}

/**
 * @param brand - installed public identity.
 * @param persona - validated editable role.
 * @returns frozen public metadata without instructions or secrets.
 */
export function desktopBrandPresentation(brand: DesktopBrand, persona: DesktopBrandPersona): DesktopBrandPresentation {
  return Object.freeze({ name: brand.name, wordmark: brand.wordmark, mark: brand.mark,
    ...(brand.logo === undefined ? {} : { logo: brand.logo }),
    authenticationMode: 'account', updates: 'manual',
    persona: Object.freeze({ name: persona.name, address: persona.address, greeting: persona.greeting }) })
}

/**
 * Select packaged role metadata or a retained local role and regenerate only the owned overlay.
 * @param brand - validated packaged brand defaults.
 * @param home - isolated Harness home, never the shared upstream home.
 * @param assetsDirectory - Packaged artwork directory, when the selected brand carries images.
 * @returns selected persona and absolute runtime overlay paths.
 * @throws when local mode selects an invalid saved role; the original file remains untouched.
 */
export async function prepareDesktopBrandProfile(brand: DesktopBrand, home: string, assetsDirectory = ''): Promise<{
  persona: DesktopBrandPersona
  personaPath: string
  patchPath: string
  personaPrefix: string
  appearanceAssetsDirectory: string | undefined
}> {
  await mkdir(home, { recursive: true })
  const personaPath = join(home, 'persona.json')
  let persona = brand.persona
  if (brand.personaSource !== 'bundled') {
    try { await writeFile(personaPath, `${JSON.stringify(brand.persona, null, 2)}\n`, { flag: 'wx', mode: 0o600 }) }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error }
    try {
      const value: unknown = JSON.parse(await readFile(personaPath, 'utf8'))
      persona = parseDesktopBrand({ ...brand, persona: value }).persona
    } catch (error) { throw new Error(`desktop brand: invalid persona.json at ${personaPath}; correct the file and restart`, { cause: error }) }
  }
  const prefix = `你是${persona.name}，称呼用户为${persona.address}。\n${persona.instructions}\n完成事务时的语气示例：${persona.completion}`
  const patches = ['product-analytics', 'desktop-product-telemetry', 'session-telemetry-otel']
    .map(id => ({ id, disabled: true }))
  if (brand.logo !== undefined) {
    const preferencesDirectory = join(home, 'integrations', 'dsh-im')
    await mkdir(preferencesDirectory, { recursive: true })
    const preferences = join(preferencesDirectory, 'sidebar-settings.json')
    try { await writeFile(preferences, '{"version":1,"mode":"show"}\n', { flag: 'wx', mode: 0o600 }) }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error }
    const saved: unknown = JSON.parse(await readFile(preferences, 'utf8'))
    if (typeof saved !== 'object' || saved === null || !('version' in saved) || saved.version !== 1
      || !('mode' in saved) || !['auto', 'show', 'hide'].includes(String(saved.mode))) {
      throw new Error('desktop brand: invalid saved IM sidebar preference')
    }
    patches.push({ id: 'theme-seabreeze', disabled: true })
  }
  const patchPath = join(home, 'desktop-brand.patch.json')
  await writeFile(patchPath, `${JSON.stringify(patches, null, 2)}\n`, { mode: 0o600 })
  return { persona, personaPath, patchPath, personaPrefix: prefix,
    appearanceAssetsDirectory: brand.logo === undefined || assetsDirectory === '' ? undefined : assetsDirectory }
}
