/** Bounded local raster resources exposed only through authenticated Connection routes. */
import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { lstat, open, readdir, realpath } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, extname, join, resolve } from 'node:path'
import type { AppearanceCatalog } from '../types.ts'

const MAX_BYTES = 20 * 1024 * 1024
const MAX_IMAGES = 500
const IMAGE_ROUTE = '/api/brand-appearance/image'

/** Directories selected by accepted Host configuration. */
export interface AppearanceDirectories {
  readonly folder: string
  readonly builtinDirectory: string
}

interface ImageEntry {
  readonly path: string
  readonly root: string
  readonly selection: string
  readonly version: string
}

function mediaType(bytes: Uint8Array): string | undefined {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'image/png'
  if (Buffer.from(bytes.subarray(0, 4)).toString() === 'RIFF'
    && Buffer.from(bytes.subarray(8, 12)).toString() === 'WEBP') return 'image/webp'
  return undefined
}

function expandFolder(path: string): string {
  return resolve(path.startsWith('~/') ? join(homedir(), path.slice(2)) : path)
}

/** Local folder inventory and version-bound, non-following file reads. */
export class AppearanceGallery {
  private entries = new Map<string, ImageEntry>()

  /** @param directories - Current accepted configuration, read again before every resource access. */
  constructor(private readonly directories: () => AppearanceDirectories) {}

  private selection(): string | undefined {
    const { folder, builtinDirectory } = this.directories()
    const selected = folder.trim()
    return selected !== '' ? expandFolder(selected) : builtinDirectory === '' ? undefined : join(builtinDirectory, 'backgrounds')
  }

  /** Scan accepted raster files without publishing local diagnostic paths.
   * @returns Current bounded inventory, or an unavailable state.
   */
  async catalog(): Promise<AppearanceCatalog> {
    const selection = this.selection()
    if (selection === undefined) return { images: [], unavailable: false }
    try {
      const info = await lstat(selection)
      if (!info.isDirectory() || info.isSymbolicLink()) return { images: [], unavailable: true }
      const root = await realpath(selection)
      const names = await readdir(root, { withFileTypes: true })
      const next = new Map<string, ImageEntry>()
      for (const item of names.sort((a, b) => a.name.localeCompare(b.name))) {
        if (next.size >= MAX_IMAGES) break
        if (!item.isFile() || !/^\.(?:png|jpe?g|webp)$/iu.test(extname(item.name))) continue
        const path = join(root, item.name)
        const metadata = await lstat(path)
        if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > MAX_BYTES) continue
        const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
        let header: Buffer
        try {
          header = Buffer.alloc(12)
          await handle.read(header, 0, header.length, 0)
        } finally { await handle.close() }
        if (mediaType(header) === undefined) continue
        const version = `${metadata.dev}:${metadata.ino}:${metadata.size}:${metadata.mtimeMs}:${metadata.ctimeMs}`
        const digest = createHash('sha256').update(`${path}\0${version}`).digest('hex')
        next.set(digest, { path, root, selection, version })
      }
      if (selection !== this.selection()) return { images: [], unavailable: true }
      this.entries = next
      return { images: [...next.keys()].map(key => `${IMAGE_ROUTE}?key=${key}`), unavailable: false }
    } catch (_error) {
      // A changing or unreadable folder is reported without publishing a partial replacement.
      return { images: [], unavailable: true }
    }
  }

  /**
   * Read an inventoried file without accepting client-supplied filesystem paths.
   * @param request - Authenticated request carrying only the opaque resource digest.
   * @returns Raster response, or 404 when the file or selected folder changed.
   */
  async image(request: Request): Promise<Response> {
    const key = new URL(request.url).searchParams.get('key') ?? ''
    const entry = /^[a-f0-9]{64}$/u.test(key) ? this.entries.get(key) : undefined
    if (entry === undefined || entry.selection !== this.selection()) return new Response(null, { status: 404 })
    return this.read(entry.path, entry.root, entry.version)
  }

  /** Read the fixed logo independently of the rotating folder.
   * @returns The packaged brand image, or an unavailable response.
   */
  async logo(): Promise<Response> {
    const directory = this.directories().builtinDirectory
    if (directory === '') return new Response(null, { status: 404 })
    return this.read(join(directory, 'logo.png'), directory)
  }

  private async read(path: string, directory: string, version?: string): Promise<Response> {
    try {
      const root = await realpath(directory)
      const info = await lstat(path)
      if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_BYTES
        || await realpath(path) !== join(root, basename(path)) || dirname(await realpath(path)) !== root) {
        return new Response(null, { status: 404 })
      }
      const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
      try {
        const current = await handle.stat()
        const revision = `${current.dev}:${current.ino}:${current.size}:${current.mtimeMs}:${current.ctimeMs}`
        if (current.dev !== info.dev || current.ino !== info.ino || current.size > MAX_BYTES
          || (version !== undefined && revision !== version)) return new Response(null, { status: 404 })
        const bytes = Buffer.alloc(current.size)
        let offset = 0
        while (offset < bytes.length) {
          const read = await handle.read(bytes, offset, bytes.length - offset, offset)
          if (read.bytesRead === 0) return new Response(null, { status: 404 })
          offset += read.bytesRead
        }
        const mime = mediaType(bytes)
        if (mime === undefined) return new Response(null, { status: 404 })
        return new Response(new Uint8Array(bytes), { headers: {
          'content-type': mime, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff',
        } })
      } finally { await handle.close() }
    } catch (_error) {
      // Removed, replaced, or unreadable images remain unavailable; no arbitrary-path fallback.
      return new Response(null, { status: 404 })
    }
  }
}
