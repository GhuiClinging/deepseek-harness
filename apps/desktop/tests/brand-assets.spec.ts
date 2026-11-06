import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { prepareDesktopBrandAssets } from '../scripts/prepare-brand-assets.ts'
import { loadDesktopBrand } from '../scripts/desktop-brand.mjs'

it('stages fixed artwork and optional curated photos independently of public metadata', async () => {
  const root = await mkdtemp(join(tmpdir(), 'brand-assets-'))
  const photos = join(root, 'photos')
  await mkdir(photos)
  await writeFile(join(photos, 'photo.jpg'), Buffer.from([0xff, 0xd8, 0xff]))
  await writeFile(join(photos, 'ignored.txt'), 'not an image')
  const selected = loadDesktopBrand(new URL('../brands/huigong/brand.json', import.meta.url).pathname)
  const selection = { ...selected, backgrounds: photos }
  await prepareDesktopBrandAssets(root, selection)
  expect(await readFile(join(root, 'brand-assets', 'logo.png'))).toEqual(await readFile(selection.icons.mac))
  expect(await readFile(join(root, 'brand-assets', 'backgrounds', 'photo.jpg'))).toEqual(Buffer.from([0xff, 0xd8, 0xff]))
  await expect(readFile(join(root, 'brand-assets', 'backgrounds', 'ignored.txt'))).rejects.toMatchObject({ code: 'ENOENT' })
})
