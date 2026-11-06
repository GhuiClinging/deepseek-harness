/** Opt-in runtime identity and installation-external persona persistence. */
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseDesktopBrand } from '../src/brand.ts'
import { desktopBrandPaths, desktopBrandFromManifest, desktopBrandPresentation, prepareDesktopBrandProfile } from '../src/brand-profile.ts'

const descriptor = JSON.parse(await readFile(new URL('../brands/huigong/brand.json', import.meta.url), 'utf8')) as Record<string, unknown>
const { icons: _icons, ...metadata } = descriptor
const brand = { ...parseDesktopBrand(metadata), personaSource: 'local' as const }

describe('desktop brand runtime profile', () => {
  it('initializes the photographed brand without replacing an explicit IM visibility choice', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-brand-photo-'))
    const pictured = { ...brand, logo: '/api/brand-appearance/logo' as const }
    const prepared = await prepareDesktopBrandProfile(pictured, home, '/packaged/brand-assets')
    const path = join(home, 'integrations', 'dsh-im', 'sidebar-settings.json')
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ version: 1, mode: 'show' })
    const patch = JSON.parse(await readFile(prepared.patchPath, 'utf8')) as { id: string; disabled?: boolean; config?: object }[]
    expect(patch.find(row => row.id === 'theme-seabreeze')?.disabled).toBe(true)
    expect(patch.find(row => row.id === 'ui-settings-general')?.config).toEqual({
      brandAppearance: true, brandAssetsDirectory: '/packaged/brand-assets',
    })
    await writeFile(path, '{"version":1,"mode":"hide"}')
    await prepareDesktopBrandProfile(pictured, home, '/packaged/brand-assets')
    expect(await readFile(path, 'utf8')).toBe('{"version":1,"mode":"hide"}')
  })
  it('retains the unselected identity and rejects malformed selected metadata', () => {
    expect(desktopBrandFromManifest({ name: 'upstream' })).toBeUndefined()
    expect(() => desktopBrandFromManifest({ dshDesktopBrand: {} })).toThrow('desktop brand')
    expect(desktopBrandFromManifest({ dshDesktopBrand: metadata })).toMatchObject({ id: brand.id, persona: brand.persona })
    expect(desktopBrandPaths(brand, '/home/user', '/app-data')).toEqual({
      home: join('/home/user', '.huigong'), userData: join('/app-data', 'huigong'), logs: join('/app-data', 'huigong', 'logs'),
    })
  })

  it('initializes once and regenerates only its owned patch after persona edits', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-brand-'))
    await mkdir(join(home, 'profiles', 'desktop'), { recursive: true })
    const userPatch = join(home, 'profiles', 'desktop', 'cordis.patch.yml')
    await writeFile(userPatch, '# user plugin edits\n')
    await writeFile(join(home, '.credentials.yaml'), 'private fixture\n')
    const first = await prepareDesktopBrandProfile(brand, home)
    expect(JSON.parse(await readFile(first.personaPath, 'utf8'))).toEqual(brand.persona)
    const edited = { ...brand.persona, name: '自定义', address: '大人', greeting: '欢迎，主人。', instructions: '我的自定义角色。' }
    await writeFile(first.personaPath, JSON.stringify(edited))
    const second = await prepareDesktopBrandProfile(brand, home)
    expect(second.persona).toEqual(edited)
    const patches = JSON.parse(await readFile(second.patchPath, 'utf8')) as { id: string; disabled?: boolean }[]
    expect(second.personaPrefix).toContain(edited.instructions)
    expect(second.personaPrefix).toContain(edited.name)
    expect(second.personaPrefix).toContain(`称呼用户为${edited.address}`)
    expect(patches.some(row => row.id === 'system-prompt')).toBe(false)
    for (const id of ['deepseek-account', 'llm-deepseek-account', 'account-controller', 'ui-settings-account', 'product-analytics', 'desktop-product-telemetry', 'session-telemetry-otel']) {
      expect(patches.find(row => row.id === id)?.disabled).toBe(true)
    }
    expect(await readFile(userPatch, 'utf8')).toBe('# user plugin edits\n')
    expect(await readFile(join(home, '.credentials.yaml'), 'utf8')).toBe('private fixture\n')
  })

  it.each(['{broken', '{}', '{"name":""}'])('rejects invalid editable persona without replacing it: %s', async (content) => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-brand-invalid-'))
    await writeFile(join(home, 'persona.json'), content)
    await expect(prepareDesktopBrandProfile(brand, home)).rejects.toThrow(/persona.json/u)
    expect(await readFile(join(home, 'persona.json'), 'utf8')).toBe(content)
  })

  it.each(['{broken', JSON.stringify({ ...brand.persona, name: '旧角色', completion: '旧完成用语' })])(
    'uses the packaged persona and preserves a retained local file: %s', async (content) => {
      const home = await mkdtemp(join(tmpdir(), 'dsh-brand-bundled-'))
      const path = join(home, 'persona.json')
      await writeFile(path, content)
      const bundled = { ...brand, personaSource: 'bundled' as const }
      const first = await prepareDesktopBrandProfile(bundled, home)
      expect(first.persona).toEqual(bundled.persona)
      const next = { ...bundled, persona: { ...bundled.persona, name: '新版角色', completion: '新版完成用语' } }
      const second = await prepareDesktopBrandProfile(next, home)
      expect(second.persona).toEqual(next.persona)
      expect(second.personaPrefix).toContain('新版完成用语')
      expect(await readFile(path, 'utf8')).toBe(content)
    },
  )

  it('uses the packaged persona on a clean home without creating an editable role file', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-brand-bundled-new-'))
    const prepared = await prepareDesktopBrandProfile({ ...brand, personaSource: 'bundled' }, home)
    expect(prepared.persona).toEqual(brand.persona)
    await expect(readFile(join(home, 'persona.json'))).rejects.toMatchObject({ code: 'ENOENT' })
  })
})


it('publishes a copied frozen snapshot without role instructions or credential fields', () => {
  const persona = { ...brand.persona }
  const presentation = desktopBrandPresentation(brand, persona)
  persona.greeting = 'later mutation'
  expect(presentation.persona.greeting).toBe(brand.persona.greeting)
  expect(Object.isFrozen(presentation)).toBe(true)
  expect(Object.isFrozen(presentation.persona)).toBe(true)
  expect(presentation.persona).not.toHaveProperty('instructions')
  expect(presentation.persona).not.toHaveProperty('completion')
})
