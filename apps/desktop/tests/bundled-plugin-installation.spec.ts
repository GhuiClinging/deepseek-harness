/** Packaged plugins remain installation-owned and discoverable after user disabling. */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { prepareBundledPlugins } from '../scripts/prepare-bundled-plugins.ts'
import { createPluginProfile } from '../src/project-manager.ts'
import { runtimeFixture, writePackage } from './runtime-fixture.ts'
import { loadProfileDirectory, createRuntimeResolution } from '@deepseek-ai/dsh-app-boot'

it('declares packaged plugins at the Host installation anchor and retains inventory after disabling', async () => {
  const root = mkdtempSync(join(tmpdir(), 'desktop-bundled-installation-'))
  const runtime = join(root, 'runtime')
  runtimeFixture(runtime)
  const modules = join(runtime, 'node_modules')
  const plugin = writePackage(modules, '@xmanrui/dsh-im', { version: '5.10.0', dsh: { bundle: { patch: './patch.json' } } })
  writeFileSync(join(plugin, 'patch.json'), '[]\n')
  const anchor = join(modules, '@deepseek-ai/dsh/package.json')
  const before = JSON.parse(readFileSync(anchor, 'utf8')) as { dependencies: Record<string, string> }
  prepareBundledPlugins(runtime, [{ name: '@xmanrui/dsh-im', version: '5.10.0' }])
  const manifest = JSON.parse(readFileSync(anchor, 'utf8')) as { dependencies: Record<string, string> }
  expect(manifest.dependencies).toEqual({ ...before.dependencies, '@xmanrui/dsh-im': '5.10.0' })
  const profile = join(root, 'home/profiles/desktop')
  createPluginProfile(profile, ['@xmanrui/dsh-im'])
  const saved = JSON.parse(readFileSync(join(profile, 'package.json'), 'utf8')) as { dsh: { profile: { bundles: string[] } } }
  saved.dsh.profile.bundles = saved.dsh.profile.bundles.filter(name => name !== '@xmanrui/dsh-im')
  writeFileSync(join(profile, 'package.json'), JSON.stringify(saved))
  const loaded = loadProfileDirectory('test', profile, anchor)
  const resolution = await createRuntimeResolution({ installAnchor: anchor, profile: loaded, home: join(root, 'home') })
  expect(resolution.entries.find(entry => entry.name === '@xmanrui/dsh-im')).toMatchObject({ scope: 'installation', version: '5.10.0' })
})
