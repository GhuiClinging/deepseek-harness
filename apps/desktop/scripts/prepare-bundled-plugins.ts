/** Declare branded bundles at the immutable Host installation anchor before integrity sealing. */
import { accessSync, constants, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { bundlePatchPaths, readProfileManifest } from '@deepseek-ai/dsh-app-boot'
import type { DesktopBundledPlugin } from '../src/brand.ts'

/**
 * Validate staged bundles and expose them to installation inventory and dependency resolution.
 * @param runtime - writable staging directory, never an installed application or user profile.
 * @param plugins - exact packages already materialized by the production install.
 * @throws When any selected package, version, bundle declaration, or patch is missing.
 */
export function prepareBundledPlugins(runtime: string, plugins: readonly DesktopBundledPlugin[]): void {
  if (plugins.length === 0) return
  const modules = join(runtime, 'node_modules')
  for (const plugin of plugins) {
    const directory = join(modules, plugin.name)
    const installed = readProfileManifest('desktop bundled plugins', directory)
    const bundle = installed.dsh?.bundle
    if (installed.name !== plugin.name || installed.version !== plugin.version || bundle === undefined) {
      throw new Error(`desktop bundled plugins: expected bundle ${plugin.name}@${plugin.version}`)
    }
    for (const path of bundlePatchPaths(directory, bundle)) accessSync(path, constants.R_OK)
  }
  const directory = join(modules, '@deepseek-ai/dsh')
  const manifest = readProfileManifest('desktop bundled plugins', directory)
  const dependencies = { ...manifest.dependencies, ...Object.fromEntries(plugins.map(plugin => [plugin.name, plugin.version])) }
  writeFileSync(join(directory, 'package.json'), `${JSON.stringify({ ...manifest, dependencies }, null, 2)}\n`)
}
