/** Normalize user-selected wallpaper for bounded persistence without changing its aspect ratio. */

/**
 * Decode a raster image, preserve its aspect ratio, and bound the saved WebP data URL.
 * @param file - PNG, JPEG, or WebP selected by the user, no larger than 20 MiB.
 * @returns A WebP data URL no longer than 1,400,000 characters, with a longest side of at most 2560 pixels.
 * @throws When decoding fails or the bounded representation cannot be produced.
 */
export async function normalizeBackgroundImage(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024) {
    throw new Error('background: unsupported image')
  }
  const bitmap = await createImageBitmap(file)
  try {
    const canvas = document.createElement('canvas')
    const ratio = Math.min(1, 2560 / Math.max(bitmap.width, bitmap.height))
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio))
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio))
    const context = canvas.getContext('2d')
    if (context === null || bitmap.width === 0 || bitmap.height === 0) throw new Error('background: image cannot be decoded')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    for (const quality of [0.85, 0.7, 0.5]) {
      const result = canvas.toDataURL('image/webp', quality)
      if (result.startsWith('data:image/webp;base64,UklGR') && result.length <= 1_400_000) return result
    }
    throw new Error('background: image exceeds storage limit')
  } finally { bitmap.close() }
}
