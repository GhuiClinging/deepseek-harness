import { mkdtemp, mkdir, writeFile, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { AppearanceGallery } from '../src/appearance/gallery.ts'

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])

it('serves only bounded raster files from the selected folder through opaque references', async () => {
  const root = await mkdtemp(join(tmpdir(), 'brand-gallery-'))
  await writeFile(join(root, 'photo.jpg'), jpeg)
  await writeFile(join(root, 'bad.jpg'), 'not an image')
  await writeFile(join(root, 'script.svg'), '<svg/>')
  const outside = join(await mkdtemp(join(tmpdir(), 'outside-gallery-')), 'secret.jpg')
  await writeFile(outside, jpeg)
  await symlink(outside, join(root, 'linked.jpg'))
  let folder = root
  const gallery = new AppearanceGallery(() => ({ folder, builtinDirectory: '' }))
  const first = await gallery.catalog()
  expect(first.unavailable).toBe(false)
  expect(first.images).toHaveLength(1)
  expect(first.images[0]).not.toContain(root)
  expect((await gallery.catalog()).images).toEqual(first.images)
  const request = new Request(`http://local${first.images[0]}`)
  const response = await gallery.image(request)
  expect(response.status).toBe(200)
  expect(response.headers.get('content-type')).toBe('image/jpeg')
  expect(Buffer.from(await response.arrayBuffer())).toEqual(jpeg)
  expect((await gallery.image(new Request('http://local/api/brand-appearance/image?key=../secret.jpg'))).status).toBe(404)
  folder = await mkdtemp(join(tmpdir(), 'new-gallery-'))
  expect((await gallery.image(request)).status).toBe(404)
})

it('rejects a file replaced by a link after listing and reports unavailable directories', async () => {
  const root = await mkdtemp(join(tmpdir(), 'brand-gallery-change-'))
  const path = join(root, 'photo.jpg')
  await writeFile(path, jpeg)
  const gallery = new AppearanceGallery(() => ({ folder: root, builtinDirectory: '' }))
  const listed = await gallery.catalog()
  await writeFile(path, 'changed')
  expect((await gallery.image(new Request(`http://local${listed.images[0]}`))).status).toBe(404)
  const missing = new AppearanceGallery(() => ({ folder: join(root, 'missing'), builtinDirectory: '' }))
  expect(await missing.catalog()).toEqual({ images: [], unavailable: true })
})

it('uses bundled backgrounds when no external folder is selected and serves the fixed logo', async () => {
  const root = await mkdtemp(join(tmpdir(), 'brand-gallery-bundled-'))
  await mkdir(join(root, 'backgrounds'))
  await writeFile(join(root, 'backgrounds', 'photo.jpg'), jpeg)
  const png = Buffer.from('89504e470d0a1a0a00000000', 'hex')
  await writeFile(join(root, 'logo.png'), png)
  const gallery = new AppearanceGallery(() => ({ folder: '', builtinDirectory: root }))
  expect((await gallery.catalog()).images).toHaveLength(1)
  const logo = await gallery.logo()
  expect(logo.status).toBe(200)
  expect(logo.headers.get('content-type')).toBe('image/png')
})

it('keeps portrait and landscape images in separate inventories that remain readable together', async () => {
  const root = await mkdtemp(join(tmpdir(), 'brand-gallery-regions-'))
  for (const directory of ['horizontal', 'vertical']) {
    await mkdir(join(root, directory))
    await writeFile(join(root, directory, 'photo.jpg'), Buffer.concat([jpeg, Buffer.from(directory)]))
  }
  const gallery = new AppearanceGallery(() => ({ folder: root, builtinDirectory: '' }))
  const chat = await gallery.catalog('chat')
  const sidebar = await gallery.catalog('sidebar')
  expect(chat.images).toHaveLength(1)
  expect(sidebar.images).toHaveLength(1)
  expect(sidebar.images).not.toEqual(chat.images)
  for (const [catalog, directory] of [[chat, 'horizontal'], [sidebar, 'vertical']] as const) {
    const response = await gallery.image(new Request(`http://local${catalog.images[0]}`))
    expect(response.status).toBe(200)
    expect(Buffer.from(await response.arrayBuffer())).toEqual(Buffer.concat([jpeg, Buffer.from(directory)]))
  }
})

it('reports a missing or linked orientation folder without using photographs from the other orientation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'brand-gallery-missing-region-'))
  await mkdir(join(root, 'horizontal'))
  await writeFile(join(root, 'horizontal', 'photo.jpg'), jpeg)
  const gallery = new AppearanceGallery(() => ({ folder: root, builtinDirectory: '' }))
  expect(await gallery.catalog('sidebar')).toEqual({ images: [], unavailable: true })
  await symlink(join(root, 'horizontal'), join(root, 'vertical'))
  expect(await gallery.catalog('sidebar')).toEqual({ images: [], unavailable: true })
})

it('keeps concurrent draft previews separate from active images and bounds retained inventories', async () => {
  const active = await mkdtemp(join(tmpdir(), 'brand-gallery-active-'))
  const draft = await mkdtemp(join(tmpdir(), 'brand-gallery-draft-'))
  await writeFile(join(active, 'active.jpg'), jpeg)
  await writeFile(join(draft, 'draft.jpg'), Buffer.concat([jpeg, Buffer.from('draft')]))
  const gallery = new AppearanceGallery(() => ({ folder: active, builtinDirectory: '' }))
  const accepted = await gallery.catalog('sidebar')
  const preview = await gallery.preview('sidebar', draft)
  expect(preview.images).toHaveLength(1)
  expect(preview.images).not.toEqual(accepted.images)
  const request = new Request(`http://local${preview.images[0]}`)
  expect(Buffer.from(await (await gallery.image(request)).arrayBuffer())).toEqual(Buffer.concat([jpeg, Buffer.from('draft')]))
  expect((await gallery.catalog('sidebar')).images).toEqual(accepted.images)
  expect(await gallery.preview('sidebar', join(draft, 'missing'))).toEqual({ images: [], unavailable: true })
  expect((await gallery.image(request)).status).toBe(200)
  for (let index = 0; index < 8; index++) await gallery.preview('sidebar', active)
  expect((await gallery.image(request)).status).toBe(404)
})
