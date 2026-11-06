/** Application-owned bundle activation retains the user's package manager and disabling choices. */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { expect, it } from 'vitest'
import { createPluginProfile } from '../src/project-manager.ts'

const bundled = ['@xmanrui/dsh-im']
function manifest(root: string) {
  return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
    dependencies: Record<string, string>
    dsh: { profile: { bundles: string[] } }
  }
}

it('activates a packaged bundle offline on a clean profile without adding profile dependencies', () => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-brand-plugins-'))
  createPluginProfile(root, bundled)
  expect(manifest(root).dsh.profile.bundles.filter(name => name === bundled[0])).toHaveLength(1)
  expect(manifest(root).dependencies).toEqual({})
  createPluginProfile(root, bundled)
  expect(manifest(root).dsh.profile.bundles.filter(name => name === bundled[0])).toHaveLength(1)
})

it('adopts an existing installation once and preserves package specs, patches, lockfiles and disabled bundles', () => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-brand-plugins-existing-'))
  createPluginProfile(root)
  const before = manifest(root)
  before.dependencies['@xmanrui/dsh-im'] = '^5.10.0'
  before.dependencies.theme = 'link:/owner/theme'
  before.dsh.profile.bundles.push('theme', ...bundled)
  writeFileSync(join(root, 'package.json'), JSON.stringify(before))
  writeFileSync(join(root, 'cordis.patch.yml'), '# retained patch\n')
  writeFileSync(join(root, 'pnpm-lock.yaml'), 'retained lockfile\n')
  createPluginProfile(root, bundled)
  expect(manifest(root)).toEqual(before)
  const disabled = manifest(root)
  disabled.dsh.profile.bundles = disabled.dsh.profile.bundles.filter(name => name !== bundled[0])
  writeFileSync(join(root, 'package.json'), JSON.stringify(disabled))
  createPluginProfile(root, bundled)
  expect(manifest(root)).toEqual(disabled)
  expect(readFileSync(join(root, 'cordis.patch.yml'), 'utf8')).toBe('# retained patch\n')
  expect(readFileSync(join(root, 'pnpm-lock.yaml'), 'utf8')).toBe('retained lockfile\n')
})

it('adds a newly bundled plugin to an older profile without enabling a previously disabled bundled plugin', () => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-brand-plugins-upgrade-'))
  createPluginProfile(root, bundled)
  const disabled = manifest(root)
  disabled.dsh.profile.bundles = disabled.dsh.profile.bundles.filter(name => name !== bundled[0])
  writeFileSync(join(root, 'package.json'), JSON.stringify(disabled))
  createPluginProfile(root, [...bundled, 'customer-tool'])
  expect(manifest(root).dsh.profile.bundles).toContain('customer-tool')
  expect(manifest(root).dsh.profile.bundles).not.toContain(bundled[0])
})
