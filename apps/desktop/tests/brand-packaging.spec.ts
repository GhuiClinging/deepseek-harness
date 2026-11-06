import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { AppInfo, Packager } from 'app-builder-lib'
import { parseDesktopBrand } from '../src/brand.ts'
import { afterAll, expect, it } from 'vitest'
import { parseDesktopPackageInvocation } from '../scripts/package-target.ts'
import { localMacOSPackageEnvironment } from '../scripts/desktop-package-environment.mjs'
import { desktopTargetBuildPaths } from '../scripts/desktop-build-paths.mjs'
import { createElectronBuilderConfig } from '../scripts/electron-builder-config.mjs'
import { resolveClientBuildEnvironment, assertClientBuildEnvironment, writeClientBuildRecord, readClientBuildRecord } from '../../../scripts/client-build-environment.ts'

const brand = {
  id: 'huigong', name: '辉总后宫智囊团', wordmark: '辉总 · 后宫智囊团', appId: 'com.guohui.huigong',
  protocol: 'huigong', storageNamespace: 'huigong', mark: '辉',
  persona: { name: '彤答应', address: '主人', greeting: '欢迎回来，主人。今天有什么事务交给我？',
    instructions: '你是女仆长彤答应。', completion: '主人，结果已经整理好了，请过目。' },
}
const icon = resolve(import.meta.dirname, '../resources/icon-macos.png')
const selected = { brand, icons: { mac: icon, windows: icon } }
const carrier = JSON.stringify(selected)

// These temporary roots hold only this suite's descriptor and build-record fixtures.
const root = mkdtempSync(join(tmpdir(), 'dsh-brand-tests-'))
afterAll(() => { rmSync(root, { recursive: true, force: true }) })

it('selects an explicit descriptor only for local unsigned macOS packaging', () => {
  expect(parseDesktopPackageInvocation(['mac-arm64', '--unsigned', '--brand', 'brand.json'], 'darwin', 'arm64'))
    .toMatchObject({ brandFile: 'brand.json', unsigned: true })
  expect(() => parseDesktopPackageInvocation(['mac-arm64', '--brand', 'brand.json'], 'darwin', 'arm64')).toThrow(/brand.*unsigned/u)
  expect(() => parseDesktopPackageInvocation(['win-x64', '--unsigned', '--brand', 'brand.json'], 'win32', 'x64')).toThrow(/brand.*macOS/u)
})

it('applies only explicitly selected public identity and drops ambient identity', () => {
  expect(localMacOSPackageEnvironment({ DSH_DESKTOP_BRAND: carrier }).DSH_DESKTOP_BRAND).toBeUndefined()
  expect(localMacOSPackageEnvironment({ DSH_DESKTOP_AUTO_UPDATE_ENV: 'production', APPLE_API_KEY: 'secret' }, selected))
    .toMatchObject({ DSH_DESKTOP_APP_ID: 'com.guohui.huigong', DSH_DESKTOP_BRAND: carrier, DSH_DESKTOP_UNSIGNED: '1' })
})

it('separates two brands target outputs while sharing download caches', () => {
  const upstream = desktopTargetBuildPaths('mac-arm64', {})
  const first = desktopTargetBuildPaths('mac-arm64', { DSH_DESKTOP_BRAND: carrier })
  const second = desktopTargetBuildPaths('mac-arm64', { DSH_DESKTOP_BRAND: JSON.stringify({ ...selected, brand: { ...brand, id: 'customer-two' } }) })
  expect(first.root).toContain('/brands/huigong/targets/mac-arm64')
  expect(first.root).not.toBe(second.root)
  expect(first.root).not.toBe(upstream.root)
  expect(first.downloads).toBe(upstream.downloads)
})

it('embeds one public descriptor and uses its names, protocol, icons and app ID', () => {
  const config = createElectronBuilderConfig({ DSH_DESKTOP_BRAND: carrier, DSH_DESKTOP_APP_ID: brand.appId, DSH_DESKTOP_UNSIGNED: '1' }, 'darwin', 'arm64')
  expect(config).toMatchObject({ appId: 'com.guohui.huigong', productName: '辉总后宫智囊团',
    protocols: [{ name: '辉总后宫智囊团', schemes: ['huigong'] }], extraMetadata: { dshDesktopBrand: brand },
    mac: { icon }, publish: null })
  expect(config.extraMetadata.dshDesktopBrand).not.toHaveProperty('icons')
  expect(config.artifactName).toBe('huigong-${version}-${os}-${arch}-unsigned.${ext}')
  expect(config.directories.output).toContain('/brands/huigong/targets/mac-arm64/unsigned-artifacts')
  expect(config.extraResources[1]).toEqual({ from: icon, to: 'icon.png' })
  expect(() => createElectronBuilderConfig({ DSH_DESKTOP_BRAND: carrier, DSH_DESKTOP_APP_ID: 'com.wrong.product', DSH_DESKTOP_UNSIGNED: '1' }, 'darwin', 'arm64')).toThrow(/app.*[Ii][Dd]/u)
})

it('binds the brand public environment to recorded artifacts and rejects a substituted identity', () => {
  const env = { DSH_DESKTOP_BRAND: carrier, DSH_CLIENT_COMMIT_HASH: 'abcdef0', DSH_CLIENT_VERSION: '0.2.2-alpha.3', DSH_CLIENT_TITLE: 'inherited', DSH_CLIENT_UNRELATED: 'discard' }
  const actual = resolveClientBuildEnvironment(env, 'brand')
  expect(actual).toEqual({ DSH_CLIENT_BUILD_PROFILE: 'brand', DSH_CLIENT_COMMIT_HASH: 'abcdef0', DSH_CLIENT_VERSION: '0.2.2-alpha.3',
    DSH_CLIENT_TITLE: '辉总后宫智囊团', DSH_CLIENT_BRAND_WORDMARK: '辉总 · 后宫智囊团', DSH_CLIENT_BRAND_MARK: '辉', DSH_CLIENT_GREETING: brand.persona.greeting })
  expect(() => resolveClientBuildEnvironment({ ...env, DSH_DESKTOP_BRAND: undefined }, 'brand')).toThrow(/brand/u)
  mkdirSync(join(root, 'apps/web/dist'), { recursive: true })
  writeFileSync(join(root, 'apps/web/dist/index.html'), '<html>fixture</html>')
  writeClientBuildRecord(root, actual)
  expect(readClientBuildRecord(root, actual).environment).toEqual(actual)
  expect(() => readClientBuildRecord(root, { ...actual, DSH_CLIENT_TITLE: 'Another customer' })).toThrow(/DSH_CLIENT_TITLE/u)
  expect(() => { assertClientBuildEnvironment({ ...actual, DSH_CLIENT_TITLE: 'Another customer' }, actual) }).toThrow(/DSH_CLIENT_TITLE/u)
})

it('validates descriptor files and resolves icon paths before builds', async () => {
  const { parseDesktopBrand } = await import('../src/brand.ts')
  const { loadDesktopBrand, resolveDesktopBrandEnvironment } = await import('../scripts/desktop-brand.mjs')
  expect(parseDesktopBrand(brand)).toEqual(brand)
  for (const invalid of [null, { ...brand, id: '../escape' }, { ...brand, name: 'Invalid/App' }, { ...brand, appId: 'bad' }, { ...brand, storageNamespace: '..' }, { ...brand, name: '' }, { ...brand, protocol: 'DSH' }, { ...brand, persona: {} }, { ...brand, secret: 'private' }]) {
    expect(() => parseDesktopBrand(invalid)).toThrow(/brand/u)
  }
  const path = join(root, 'brand.json')
  writeFileSync(path, JSON.stringify({ ...brand, icons: { mac: icon, windows: icon } }))
  expect(loadDesktopBrand(path)).toEqual(selected)
  writeFileSync(path, JSON.stringify({ ...brand, icons: { mac: icon } }))
  expect(loadDesktopBrand(path)).toEqual({ brand, icons: { mac: icon } })
  expect(resolveDesktopBrandEnvironment({ DSH_DESKTOP_BRAND: carrier })).toEqual(selected)
  expect(() => resolveDesktopBrandEnvironment({ DSH_DESKTOP_BRAND: '{broken' })).toThrow(/JSON/u)
  expect(() => resolveDesktopBrandEnvironment({ DSH_DESKTOP_BRAND: JSON.stringify({ ...selected, icons: { mac: 'relative.png' } }) })).toThrow(/icon/u)
  writeFileSync(path, JSON.stringify({ ...brand, icons: { mac: './missing.png', windows: icon } }))
  expect(() => loadDesktopBrand(path)).toThrow(/icon/u)
  writeFileSync(path, '{broken')
  expect(() => loadDesktopBrand(path)).toThrow(/JSON/u)
  expect(() => loadDesktopBrand(join(root, 'absent.json'))).toThrow(/read/u)
})

it('rejects branded signed or Windows builder configuration before credentials or updates', () => {
  expect(() => createElectronBuilderConfig({ DSH_DESKTOP_BRAND: carrier, DSH_DESKTOP_APP_ID: brand.appId }, 'darwin', 'arm64')).toThrow(/brand.*unsigned/u)
  expect(() => createElectronBuilderConfig({ DSH_DESKTOP_BRAND: carrier, DSH_DESKTOP_APP_ID: brand.appId, DSH_DESKTOP_UNSIGNED: '1' }, 'win32', 'x64')).toThrow(/brand.*macOS/u)
})

it.each(['辉总?后宫智囊团', '辉总后宫智囊团.', 'CON', 'con.txt', '...', '辉'.repeat(86)])('rejects application name %j before descriptor loading can reach a build', async (name) => {
  const { loadDesktopBrand } = await import('../scripts/desktop-brand.mjs')
  expect(() => parseDesktopBrand({ ...brand, name })).toThrow(/filename/u)
  const file = join(root, 'invalid-name.json')
  writeFileSync(file, JSON.stringify({ ...brand, name, icons: { mac: icon } }))
  expect(() => loadDesktopBrand(file)).toThrow(/filename/u)
})

it.each(['辉总后宫智囊团', 'Acme.App 2', '辉'.repeat(83)])('keeps accepted name %j equal to the installed builder filename', (name) => {
  const parsed = parseDesktopBrand({ ...brand, name })
  const packager = new Packager({ projectDir: root })
  Object.defineProperties(packager, {
    config: { value: { productName: parsed.name } },
    metadata: { value: { name: 'brand-fixture', version: '1.0.0' } },
  })
  expect(new AppInfo(packager, undefined).productFilename).toBe(name)
})

it('ships the owner-selected persona name without changing address or greeting', async () => {
  const { loadDesktopBrand } = await import('../scripts/desktop-brand.mjs')
  const shipped = loadDesktopBrand(resolve(import.meta.dirname, '../brands/huigong/brand.json')).brand
  expect(shipped.persona.name).toBe('彤答应')
  expect(shipped.persona.instructions).toContain('辉总后宫智囊团的女仆长')
  expect(shipped.persona.instructions).not.toContain(shipped.persona.name)
  expect(shipped.persona.instructions).not.toContain(shipped.persona.address)
  expect(shipped.persona.address).toBe('主人')
  expect(shipped.persona.greeting).toBe('欢迎回来，主人。今天有什么事务交给我？')
  expect(shipped.persona.completion).toBe('主人，您的吩咐奴婢已经完成了，请过目。')
  expect(shipped.personaSource).toBe('bundled')
})

it('accepts exact bundled plugin versions and rejects unsafe or ambiguous dependency specifications', () => {
  const bundledPlugins = [{ name: '@xmanrui/dsh-im', version: '5.10.0' }]
  expect(parseDesktopBrand({ ...brand, bundledPlugins }).bundledPlugins).toEqual(bundledPlugins)
  for (const invalid of [
    [{ name: '@xmanrui/dsh-im', version: '^5.10.0' }],
    [{ name: '@xmanrui/dsh-im', version: 'file:/private/local' }],
    [{ name: '../escape', version: '5.10.0' }],
    [{ name: '@deepseek-ai/dsh', version: '5.10.0' }],
    [...bundledPlugins, ...bundledPlugins],
  ]) expect(() => parseDesktopBrand({ ...brand, bundledPlugins: invalid })).toThrow(/brand/u)
  expect(() => parseDesktopBrand({ ...brand, personaSource: 'guess' })).toThrow(/personaSource/u)
})
