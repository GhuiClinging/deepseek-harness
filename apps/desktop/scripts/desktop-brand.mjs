/** Load explicitly selected public branding and resolve its build-only artwork files. */
import { accessSync, constants, readFileSync, statSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { parseDesktopBrand } from '../src/brand.ts'

function object(value, keys, subject, optional = []) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)
    || Object.keys(value).some(key => !keys.includes(key) && !optional.includes(key))
    || keys.some(key => !Object.hasOwn(value, key))) {
    throw new Error(`desktop brand: invalid ${subject}`)
  }
  return value
}

function icons(value, directory) {
  if (typeof value !== 'object' || value === null || Array.isArray(value) || !Object.hasOwn(value, 'mac')
    || Object.keys(value).some(key => key !== 'mac' && key !== 'windows')) throw new Error('desktop brand: icons requires mac and optional windows')
  const data = value
  return Object.fromEntries(Object.keys(data).map(platform => {
    const file = data[platform]
    if (typeof file !== 'string' || !file.trim() || file.includes('\0') || (directory === undefined && !isAbsolute(file))) {
      throw new Error(`desktop brand: ${platform} icon must identify a readable file`)
    }
    const path = directory === undefined ? file : resolve(directory, file)
    try {
      if (!statSync(path).isFile()) throw new Error('not a file')
      accessSync(path, constants.R_OK)
    } catch {
      throw new Error(`desktop brand: missing or unreadable ${platform} icon ${path}`)
    }
    return [platform, path]
  }))
}

function parseJSON(contents, subject) {
  try { return JSON.parse(contents) }
  catch { throw new Error(`desktop brand: invalid JSON in ${subject}`) }
}

function backgrounds(value, directory) {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !value.trim() || value.includes('\0')
    || (directory === undefined && !isAbsolute(value))) throw new Error('desktop brand: invalid backgrounds directory')
  const path = directory === undefined ? value : resolve(directory, value)
  if (!statSync(path).isDirectory()) throw new Error('desktop brand: backgrounds must identify a directory')
  accessSync(path, constants.R_OK)
  return path
}

/**
 * Load a descriptor before starting builds; relative artwork paths resolve beside the descriptor.
 * @param {string} file Explicit descriptor filename.
 * @returns {{ brand: import('../src/brand.ts').DesktopBrand, icons: { mac: string, windows?: string }, backgrounds?: string }} Public metadata and resolved artwork.
 */
export function loadDesktopBrand(file) {
  const path = resolve(file)
  let contents
  try { contents = readFileSync(path, 'utf8') }
  catch { throw new Error(`desktop brand: cannot read descriptor ${path}`) }
  const data = object(parseJSON(contents, path), ['id', 'name', 'wordmark', 'appId', 'protocol', 'storageNamespace', 'mark', 'persona', 'icons'], 'descriptor', ['personaSource', 'bundledPlugins', 'logo', 'backgrounds'])
  const { icons: artwork, backgrounds: images, ...metadata } = data
  const folder = backgrounds(images, dirname(path))
  return { brand: parseDesktopBrand(metadata), icons: icons(artwork, dirname(path)), ...(folder === undefined ? {} : { backgrounds: folder }) }
}

/**
 * Read the project-owned serialized carrier passed to packaging subprocesses.
 * @param {NodeJS.ProcessEnv} environment Selected packaging environment.
 * @returns {{ brand: import('../src/brand.ts').DesktopBrand, icons: { mac: string, windows?: string }, backgrounds?: string } | undefined} Validated selection, or undefined when unselected.
 */
export function resolveDesktopBrandEnvironment(environment = process.env) {
  if (environment.DSH_DESKTOP_BRAND === undefined) return undefined
  const data = object(parseJSON(environment.DSH_DESKTOP_BRAND, 'DSH_DESKTOP_BRAND'), ['brand', 'icons'], 'serialized selection', ['backgrounds'])
  const folder = backgrounds(data.backgrounds)
  return { brand: parseDesktopBrand(data.brand), icons: icons(data.icons), ...(folder === undefined ? {} : { backgrounds: folder }) }
}

/**
 * Resolve the installed application name and artifact prefix for fixed-name packaging consumers.
 * @param {NodeJS.ProcessEnv} environment Selected packaging environment.
 * @returns {{ name: string, artifactPrefix: string }} Names matching electron-builder configuration.
 */
export function desktopPackageIdentity(environment = process.env) {
  const selected = resolveDesktopBrandEnvironment(environment)
  return { name: selected?.brand.name ?? 'DeepSeek Harness', artifactPrefix: selected?.brand.id ?? 'deepseek-harness' }
}
