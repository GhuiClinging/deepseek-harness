import { afterEach, expect, it, vi } from 'vitest'
import { AppearanceSource } from '../src/client/appearance/source.ts'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { AppearancePreferences, AppearanceRegion } from '../src/types.ts'
import { resolveBackgroundLayout } from '../src/appearance/preferences.ts'

afterEach(() => { vi.useRealTimers() })
const first = `/api/brand-appearance/image?key=${'a'.repeat(64)}`
const second = `/api/brand-appearance/image?key=${'b'.repeat(64)}`

function separate(preferences: AppearancePreferences): AppearancePreferences {
  return { ...preferences, backgroundLayout: { ...resolveBackgroundLayout(preferences), mode: 'separate' } }
}

it.each(['healthy', 'failing'] as const)('retains a failed region when the %s request completes last', async (delayed) => {
  vi.useFakeTimers()
  const preferences = createSnapshotStore({ value: separate({ backgroundFolder: '/pictures', backgroundMinSeconds: 5, backgroundMaxSeconds: 5 }) })
  const form: ConfigForm<AppearancePreferences> = {
    getSnapshot: () => ({ ...preferences.getSnapshot(), status: 'ready', writable: true, revision: 1, base: {}, user: {} }),
    subscribe: listener => preferences.subscribe(listener), set: async () => false, unset: async () => false, mutate: async () => false,
  }
  let release = (): void => {}
  const barrier = new Promise<void>((resolve) => { release = resolve })
  const source = new AppearanceSource(form, {
    fetch: async (_signal, region) => {
      if ((region === 'chat') === (delayed === 'failing')) await barrier
      return Response.json({ images: region === 'chat' ? [] : [first], unavailable: region === 'chat' })
    }, load: async () => {}, show: vi.fn(), activate: vi.fn(), random: () => 0,
  })
  await vi.waitFor(() => {
    if (delayed === 'healthy') expect(source.store.getSnapshot().problem).toBe('folder')
    else expect(source.store.getSnapshot().current.sidebar).toBe(first)
  })
  release()
  await vi.waitFor(() => {
    expect(source.store.getSnapshot().problem).toBe('folder')
    expect(source.store.getSnapshot().current.sidebar).toBe(first)
  })
  source.dispose()
})

it('defaults to one rotating image for the whole window and restores saved independent region settings', async () => {
  vi.useFakeTimers()
  const original: AppearancePreferences = { backgroundFolder: '', backgroundMinSeconds: 5, backgroundMaxSeconds: 5 }
  const layout = resolveBackgroundLayout(original)
  const preferences = createSnapshotStore<{ value: AppearancePreferences }>({
    value: original,
  })
  const form: ConfigForm<AppearancePreferences> = {
    getSnapshot: () => ({ ...preferences.getSnapshot(), status: 'ready', writable: true, revision: 1, base: {}, user: {} }),
    subscribe: listener => preferences.subscribe(listener), set: async () => false, unset: async () => false, mutate: async () => false,
  }
  const fetch = vi.fn(async (_signal: AbortSignal, _region: AppearanceRegion) =>
    Response.json({ images: [first, second], unavailable: false }))
  const source = new AppearanceSource(form, { fetch, load: async () => {}, show: vi.fn(), activate: vi.fn(), random: () => 0 })
  await vi.waitFor(() => { expect(source.store.getSnapshot().current.unified).toBe(first) })
  expect(fetch.mock.calls.map(call => call[1])).toEqual(['unified'])
  await vi.advanceTimersByTimeAsync(5000)
  expect(source.store.getSnapshot().current.unified).toBe(second)
  preferences.set({ value: { ...original, backgroundLayout: { ...layout, mode: 'separate' } } })
  await vi.waitFor(() => { expect(source.store.getSnapshot().current.sidebar).toBe(first) })
  expect(preferences.getSnapshot().value.backgroundLayout?.sidebar.fit).toBe('contain')
  expect(preferences.getSnapshot().value.backgroundLayout?.sidebar.opacity).toBe(65)
  source.dispose()
})

it('displays a fixed image without catalog requests or rotation timers', async () => {
  vi.useFakeTimers()
  const original: AppearancePreferences = { backgroundFolder: '', backgroundMinSeconds: 5, backgroundMaxSeconds: 5 }
  const layout = resolveBackgroundLayout(original)
  const fixed = { ...layout.unified, source: 'image' as const, image: 'data:image/webp;base64,UklGRfixture' }
  const preferences = createSnapshotStore({ value: { ...original, backgroundLayout: { ...layout, mode: 'unified' as const, unified: fixed } } })
  const form: ConfigForm<AppearancePreferences> = {
    getSnapshot: () => ({ ...preferences.getSnapshot(), status: 'ready', writable: true, revision: 1, base: {}, user: {} }),
    subscribe: listener => preferences.subscribe(listener), set: async () => false, unset: async () => false, mutate: async () => false,
  }
  const fetch = vi.fn()
  const show = vi.fn()
  const source = new AppearanceSource(form, { fetch, load: async () => {}, show, activate: vi.fn(), random: () => 0 })
  await vi.waitFor(() => { expect(source.store.getSnapshot().current.unified).toBe(fixed.image) })
  await vi.advanceTimersByTimeAsync(30_000)
  expect(fetch).not.toHaveBeenCalled()
  expect(show).toHaveBeenCalledTimes(1)
  source.dispose()
})

it('rotates each region only within its own gallery', async () => {
  vi.useFakeTimers()
  const portrait = `/api/brand-appearance/image?key=${'c'.repeat(64)}`
  const nextPortrait = `/api/brand-appearance/image?key=${'d'.repeat(64)}`
  const preferences = createSnapshotStore({ value: separate({ backgroundFolder: '/pictures', backgroundMinSeconds: 5, backgroundMaxSeconds: 5 }) })
  const form: ConfigForm<AppearancePreferences> = {
    getSnapshot: () => ({ ...preferences.getSnapshot(), status: 'ready', writable: true, revision: 1, base: {}, user: {} }),
    subscribe: listener => preferences.subscribe(listener), set: async () => false, unset: async () => false, mutate: async () => false,
  }
  const source = new AppearanceSource(form, {
    fetch: async (_signal, region) => Response.json({ images: region === 'chat' ? [first, second] : [portrait, nextPortrait], unavailable: false }),
    load: async () => {}, show: vi.fn(), activate: vi.fn(), random: () => 0,
  })
  await vi.waitFor(() => { expect(source.store.getSnapshot().current).toEqual({ chat: first, sidebar: portrait }) })
  await vi.advanceTimersByTimeAsync(5000)
  expect(source.store.getSnapshot().current).toEqual({ chat: second, sidebar: nextPortrait })
  source.dispose()
})

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
  expect(source.store.getSnapshot().current.unified).toBe(first)
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
  await vi.waitFor(() => { expect(source.store.getSnapshot().current.unified).toBe(first) })
  catalog.mockImplementation(async () => Response.json({ images: [first, second], unavailable: false }))
  await vi.advanceTimersByTimeAsync(5000)
  expect(source.store.getSnapshot().current.unified).toBe(second)
  source.dispose()
})

it('rotates two regions without immediate repetition and stops timers on disposal', async () => {
  vi.useFakeTimers()
  const preferences = createSnapshotStore({ value: separate({
    backgroundFolder: '/pictures', backgroundMinSeconds: 5, backgroundMaxSeconds: 5,
  }) })
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
  await vi.waitFor(() => { expect(source.store.getSnapshot().current.unified).toBe(first) })
  catalog.mockImplementation(async () => Response.json({ images: [], unavailable: true }))
  preferences.set({ value: { ...preferences.getSnapshot().value, backgroundFolder: '/missing' } })
  await vi.waitFor(() => { expect(source.store.getSnapshot().problem).toBe('folder') })
  expect(source.store.getSnapshot().current.unified).toBe(first)
  catalog.mockImplementation(async () => Response.json({ images: [second], unavailable: false }))
  await vi.advanceTimersByTimeAsync(5000)
  expect(source.store.getSnapshot().current.unified).toBe(second)
  source.dispose()
  const count = show.mock.calls.length
  await vi.advanceTimersByTimeAsync(30_000)
  expect(show).toHaveBeenCalledTimes(count)
})
