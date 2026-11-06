/** Copy explicitly selected brand artwork before the runtime integrity inventory is sealed. */
import { copyFile, lstat, mkdir, readdir, readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import type { DesktopBrandSelection } from './desktop-brand.mjs'

/**
 * Stage a fixed PNG logo and the selected test or curated gallery without following links.
 * @param root - Materialized Desktop runtime.
 * @param selection - Validated build-only image sources.
 * @returns Resolves after the complete selected image set is copied.
 */
export async function prepareDesktopBrandAssets(root: string, selection: DesktopBrandSelection): Promise<void> {
  const assets = join(root, 'brand-assets')
  await mkdir(join(assets, 'backgrounds'), { recursive: true })
  const icon = await readFile(selection.icons.mac)
  if (icon.length > 20 * 1024 * 1024 || !icon.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
    throw new Error('desktop brand: photographic logo requires a PNG icon no larger than 20 MiB')
  }
  await copyFile(selection.icons.mac, join(assets, 'logo.png'))
  if (selection.backgrounds === undefined) return
  const source = await lstat(selection.backgrounds)
  if (!source.isDirectory() || source.isSymbolicLink()) throw new Error('desktop brand: background source must be an ordinary directory')
  let count = 0
  let total = 0
  for (const entry of await readdir(selection.backgrounds, { withFileTypes: true })) {
    if (!/^\.(?:png|jpe?g|webp)$/iu.test(extname(entry.name))) continue
    if (!entry.isFile()) throw new Error('desktop brand: background images must be ordinary files')
    const path = join(selection.backgrounds, entry.name)
    const stat = await lstat(path)
    total += stat.size
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 20 * 1024 * 1024
      || ++count > 500 || total > 200 * 1024 * 1024) throw new Error('desktop brand: selected gallery exceeds the bounded raster image budget')
    await copyFile(path, join(assets, 'backgrounds', entry.name))
  }
}
