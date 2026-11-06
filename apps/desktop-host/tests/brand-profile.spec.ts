/** Host consumes only an explicit absolute application-owned patch. */
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { desktopBrandProfileOptions } from '../src/brand-profile.ts'

it('selects the internal patch and requires an explicit nonempty scoped persona bridge', async () => {
  const environment = { DSH_DESKTOP_PERSONA_PREFIX: 'ambient should not select a brand' }
  expect(desktopBrandProfileOptions(environment)).toEqual({ patchFiles: [], personaPrefix: undefined })
  const home = await mkdtemp(join(tmpdir(), 'dsh-host-brand-'))
  const path = join(home, 'brand.patch.yml')
  await writeFile(path, JSON.stringify([{ id: 'deepseek-account', disabled: true }]))
  expect(desktopBrandProfileOptions({ DSH_DESKTOP_BRAND_PATCH: path, DSH_DESKTOP_PERSONA_PREFIX: '当前角色' })).toEqual({ patchFiles: [path], personaPrefix: '当前角色' })
  expect(() => desktopBrandProfileOptions({ DSH_DESKTOP_BRAND_PATCH: 'relative.yml' })).toThrow('absolute')
  await writeFile(path, JSON.stringify([{ id: 'system-prompt', config: {} }]))
  expect(() => desktopBrandProfileOptions({ DSH_DESKTOP_BRAND_PATCH: path })).toThrow('DSH_DESKTOP_PERSONA_PREFIX')
})
