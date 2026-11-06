/** Browser raster decoding and bounded PNG normalization for local avatars. */

/**
 * Convert an explicitly selected raster image to a small square PNG.
 * @param file - PNG, JPEG, or WebP input of at most two MiB.
 * @returns PNG data URL within the Host profile field limit.
 * @throws When input, decoding, drawing, or output size is unsupported.
 */
export async function normalizeLocalAvatar(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
    throw new Error('local profile: unsupported avatar file')
  }
  const bitmap = await createImageBitmap(file)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const context = canvas.getContext('2d')
    if (context === null || bitmap.width === 0 || bitmap.height === 0) throw new Error('local profile: avatar decoding failed')
    const side = Math.min(bitmap.width, bitmap.height)
    context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 128, 128)
    const result = canvas.toDataURL('image/png')
    if (!result.startsWith('data:image/png;base64,') || result.length > 100_000) throw new Error('local profile: avatar exceeds storage limit')
    return result
  } finally { bitmap.close() }
}
