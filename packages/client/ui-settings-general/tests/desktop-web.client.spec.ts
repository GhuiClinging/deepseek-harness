/** Browser entry observation remains fresh across Host changes and plugin disposal. */
import { expect, it, vi } from 'vitest'
import type { DesktopWebBridge, DesktopWebState } from '../src/types.ts'
import { DesktopWebSource } from '../src/client/desktop-web-source.ts'

it('retains a newer pushed address when the initial status read settles late', async () => {
  let finish!: (state: DesktopWebState) => void
  let publish!: (state: DesktopWebState) => void
  const unsubscribe = vi.fn()
  const bridge: DesktopWebBridge = {
    status: () => new Promise((resolve) => { finish = resolve }),
    subscribe: (listener) => { publish = listener; return unsubscribe },
    open: async () => 'opened',
  }
  const source = new DesktopWebSource(bridge)
  publish({ phase: 'ready', address: 'http://127.0.0.1:50000/' })
  finish({ phase: 'ready', address: 'http://127.0.0.1:3080/' })
  await Promise.resolve()
  expect(source.store.getSnapshot().host).toEqual({ phase: 'ready', address: 'http://127.0.0.1:50000/' })
  source.dispose()
  publish({ phase: 'unavailable' })
  expect(unsubscribe).toHaveBeenCalledOnce()
  expect(source.store.getSnapshot().host?.phase).toBe('ready')
})

it('serializes browser actions and exposes a dismissable failure outcome', async () => {
  let finish!: (result: 'failed') => void
  const open = vi.fn(() => new Promise<'failed'>((resolve) => { finish = resolve }))
  const source = new DesktopWebSource({ status: async () => ({ phase: 'ready', address: 'http://127.0.0.1:3080/' }),
    subscribe: () => () => {}, open })
  await Promise.resolve()
  const pending = source.open()
  await source.open()
  expect(open).toHaveBeenCalledOnce()
  finish('failed')
  await pending
  expect(source.store.getSnapshot()).toMatchObject({ opening: false, notice: { kind: 'failed' } })
  const sequence = source.store.getSnapshot().notice!.sequence
  source.dismiss(sequence)
  expect(source.store.getSnapshot().notice).toBeUndefined()
  source.dispose()
})
