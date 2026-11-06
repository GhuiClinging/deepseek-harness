import { afterEach, expect, it, vi } from 'vitest'
import { AppearanceSource } from '../src/client/appearance/source.ts'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { AppearancePreferences } from '../src/types.ts'

afterEach(() => { vi.useRealTimers() })
const first = `/api/brand-appearance/image?key=${'a'.repeat(64)}`
const second = `/api/brand-appearance/image?key=${'b'.repeat(64)}`

it.each(['empty', 'folder', 'network'] as const)('recovers automatically after an initial %s failure', async (failure) => {
  vi.useFakeTimers()
  const preferences = createSnapshotStore({ value: { backgroundFolder: '/pictures', backgroundMinSeconds: 5, backgroundMaxSeconds: 5 } })
  const form: ConfigForm<AppearancePreferences> = {
    getSnapshot: () => ({ ...preferences.getSnapshot(), status: 'ready', writable: true, revision: 1, base: {}, user: {} }),
    subscribe: listener => preferences.subscribe(listener), set: async () => false, unset: async () => false, mutate: async () => false,
  }
  let available = false
  const source = new AppearanceSource(form, {
    fetch: async () => {
      if (!available && failure === 'network') throw new Error('offline')
      return Response.json({ images: available ? [first] : [], unavailable: !available && failure === 'folder' })
    }, load: async () => {}, show: vi.fn(), activate: vi.fn(), random: () => 0,
  })
  await vi.waitFor(() => { expect(source.store.getSnapshot().problem).toBe(failure === 'empty' ? 'empty' : 'folder') })
  available = true
  preferences.set({ value: { ...preferences.getSnapshot().value } })
  await vi.advanceTimersByTimeAsync(5000)
  expect(source.store.getSnapshot().current.chat).toBe(first)
  source.dispose()
})

it('discovers photographs added to the same folder at the next automatic deadline', async () => {
  vi.useFakeTimers()
  const preferences = createSnapshotStore({ value: {
    brandAppearance: true, backgroundFolder: '/pictures', backgroundMinSeconds: 5, backgroundMaxSeconds: 5,
  } })
  const form: ConfigForm<AppearancePreferences> = {
    getSnapshot: () => ({ ...preferences.getSnapshot(), status: 'ready', writable: true, revision: 1, base: {}, user: {} }),
    subscribe: listener => preferences.subscribe(listener), set: async () => false, unset: async () => false, mutate: async () => false,
  }
  const catalog = vi.fn(async () => Response.json({ images: [first], unavailable: false }))
  const source = new AppearanceSource(form, { fetch: catalog, load: async () => {}, show: vi.fn(), activate: vi.fn(), random: () => 0 })
  await vi.waitFor(() => { expect(source.store.getSnapshot().current.chat).toBe(first) })
  catalog.mockImplementation(async () => Response.json({ images: [first, second], unavailable: false }))
  await vi.advanceTimersByTimeAsync(5000)
  expect(source.store.getSnapshot().current.chat).toBe(second)
  source.dispose()
})

it('rotates two regions without immediate repetition and stops timers on disposal', async () => {
  vi.useFakeTimers()
  const preferences = createSnapshotStore({ value: {
    brandAppearance: true, backgroundFolder: '/pictures', backgroundMinSeconds: 5, backgroundMaxSeconds: 5,
  } })
  const form: ConfigForm<AppearancePreferences> = {
    getSnapshot: () => ({ ...preferences.getSnapshot(), status: 'ready', writable: true, revision: 1, base: {}, user: {} }),
    subscribe: listener => preferences.subscribe(listener), set: async () => false, unset: async () => false, mutate: async () => false,
  }
  const show = vi.fn()
  const source = new AppearanceSource(form, {
    fetch: async () => Response.json({ images: [first, second], unavailable: false }),
    load: async () => {}, show, activate: vi.fn(), random: () => 0,
  })
  await vi.waitFor(() => { expect(source.store.getSnapshot().count).toBe(2) })
  expect(source.store.getSnapshot().current).toEqual({ chat: first, sidebar: first })
  await vi.advanceTimersByTimeAsync(5000)
  expect(source.store.getSnapshot().current).toEqual({ chat: second, sidebar: second })
  const count = show.mock.calls.length
  source.dispose()
  await vi.advanceTimersByTimeAsync(30_000)
  expect(show).toHaveBeenCalledTimes(count)
})

it('retains accepted pictures on a directory failure and ignores late completion after disposal', async () => {
  vi.useFakeTimers()
  const preferences = createSnapshotStore({ value: {
    brandAppearance: true, backgroundFolder: '/pictures', backgroundMinSeconds: 5, backgroundMaxSeconds: 10,
  } })
  const form: ConfigForm<AppearancePreferences> = {
    getSnapshot: () => ({ ...preferences.getSnapshot(), status: 'ready', writable: true, revision: 1, base: {}, user: {} }),
    subscribe: listener => preferences.subscribe(listener), set: async () => false, unset: async () => false, mutate: async () => false,
  }
  const catalog = vi.fn(async () => Response.json({ images: [first], unavailable: false }))
  const show = vi.fn()
  const source = new AppearanceSource(form, { fetch: catalog, load: async () => {}, show, activate: vi.fn(), random: () => 0 })
  await vi.waitFor(() => { expect(source.store.getSnapshot().current.chat).toBe(first) })
  catalog.mockImplementation(async () => Response.json({ images: [], unavailable: true }))
  preferences.set({ value: { ...preferences.getSnapshot().value, backgroundFolder: '/missing' } })
  await vi.waitFor(() => { expect(source.store.getSnapshot().problem).toBe('folder') })
  expect(source.store.getSnapshot().current.chat).toBe(first)
  catalog.mockImplementation(async () => Response.json({ images: [second], unavailable: false }))
  await vi.advanceTimersByTimeAsync(5000)
  expect(source.store.getSnapshot().current.chat).toBe(second)
  source.dispose()
  const count = show.mock.calls.length
  await vi.advanceTimersByTimeAsync(30_000)
  expect(show).toHaveBeenCalledTimes(count)
})
