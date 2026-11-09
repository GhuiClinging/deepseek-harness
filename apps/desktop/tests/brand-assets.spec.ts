import { mkdtemp, mkdir, readFile, writeFile, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { prepareDesktopBrandAssets } from '../scripts/prepare-brand-assets.ts'
import { loadDesktopBrand } from '../scripts/desktop-brand.mjs'

async function artwork(root: string) {
  const selected = loadDesktopBrand(new URL('../brands/huigong/brand.json', import.meta.url).pathname)
  const icon = join(root, 'icon-source.png')
  // Staging copies bytes; real raster decoding and the complete brand icon are exercised by browser acceptance.
  await writeFile(icon, Buffer.from('89504e470d0a1a0a00000000', 'hex'))
  return { ...selected, icons: { mac: icon } }
}

it('stages fixed artwork and optional curated photos independently of public metadata', async () => {
  const root = await mkdtemp(join(tmpdir(), 'brand-assets-'))
  const photos = join(root, 'photos')
  await mkdir(photos)
  await writeFile(join(photos, 'photo.jpg'), Buffer.from([0xff, 0xd8, 0xff]))
  await writeFile(join(photos, 'ignored.txt'), 'not an image')
  const selected = await artwork(root)
  const selection = { ...selected, backgrounds: photos }
  await prepareDesktopBrandAssets(root, selection)
  expect(await readFile(join(root, 'brand-assets', 'logo.png'))).toEqual(await readFile(selection.icons.mac))
  expect(await readFile(join(root, 'brand-assets', 'backgrounds', 'photo.jpg'))).toEqual(Buffer.from([0xff, 0xd8, 0xff]))
  await expect(readFile(join(root, 'brand-assets', 'backgrounds', 'ignored.txt'))).rejects.toMatchObject({ code: 'ENOENT' })
})

it('packages the horizontal and vertical galleries without following directory links', async () => {
  const root = await mkdtemp(join(tmpdir(), 'brand-assets-regions-'))
  const photos = join(root, 'photos')
  for (const region of ['horizontal', 'vertical']) {
    await mkdir(join(photos, region), { recursive: true })
    await writeFile(join(photos, region, 'photo.jpg'), region)
  }
  const selected = await artwork(root)
  await prepareDesktopBrandAssets(root, { ...selected, backgrounds: photos })
  for (const region of ['horizontal', 'vertical']) {
    expect(await readFile(join(root, 'brand-assets', 'backgrounds', region, 'photo.jpg'), 'utf8')).toBe(region)
  }
  const linked = join(root, 'linked-photos')
  await mkdir(linked)
  await symlink(join(photos, 'vertical'), join(linked, 'vertical'))
  await expect(prepareDesktopBrandAssets(root, { ...selected, backgrounds: linked })).rejects.toThrow('ordinary directory')
})
