// @vitest-environment jsdom
/** Local profile writes share the existing Host configuration form and survive editor disposal. */
import { expect, it, vi } from 'vitest'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import { LocalProfileSource } from '../src/client/local-profile-source.ts'
import { normalizeLocalAvatar } from '../src/client/local-avatar.ts'
import type { LocalProfile } from '../src/types.ts'

it('saves nickname and avatar atomically and does not treat a refused write as saved', async () => {
  let stored: LocalProfile = { localNickname: '', localAvatar: '' }
  let accept = true
  const form: ConfigForm<LocalProfile> = {
    getSnapshot: () => ({ value: stored, status: 'ready', writable: true, revision: 1, base: {}, user: {} }),
    subscribe: () => () => {}, set: async () => true, unset: async () => true,
    mutate: async (ops) => {
      if (!accept) return false
      const next = { ...stored }
      for (const op of ops) {
        if (op.op === 'set' && op.path[0] === 'localNickname' && typeof op.value === 'string') next.localNickname = op.value
        if (op.op === 'set' && op.path[0] === 'localAvatar' && typeof op.value === 'string') next.localAvatar = op.value
      }
      stored = next
      return true
    },
  }
  const source = new LocalProfileSource(form)
  await expect(source.save({ localNickname: ' 郭辉 ', localAvatar: '' })).resolves.toBe(true)
  expect(stored.localNickname).toBe('郭辉')
  expect(source.store.getSnapshot().notice?.kind).toBe('saved')
  accept = false
  await expect(source.save({ localNickname: '未保存', localAvatar: '' })).resolves.toBe(false)
  expect(stored.localNickname).toBe('郭辉')
  expect(source.store.getSnapshot().notice?.kind).toBe('failed')
  source.dispose()
})

it('rejects unsupported or oversized avatar files before decoding', async () => {
  vi.stubGlobal('createImageBitmap', vi.fn())
  try {
    await expect(normalizeLocalAvatar(new File(['<svg/>'], 'avatar.svg', { type: 'image/svg+xml' }))).rejects.toThrow()
    await expect(normalizeLocalAvatar(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }))).rejects.toThrow()
    expect(createImageBitmap).not.toHaveBeenCalled()
  } finally { vi.unstubAllGlobals() }
})
