/** Browser launch authority remains in the owning Electron process. */
import { expect, it, vi } from 'vitest'
import { DesktopWebAccess } from '../src/web-access.ts'

it('publishes a clean address and opens only the current authenticated Host URL', async () => {
  const open = vi.fn(async (_url: string) => {})
  const publish = vi.fn()
  const access = new DesktopWebAccess(open, publish)
  expect(access.status()).toEqual({ phase: 'starting' })
  await expect(access.open()).resolves.toBe('unavailable')
  access.ready('http://127.0.0.1:3080/?token=private-first')
  expect(access.status()).toEqual({ phase: 'ready', address: 'http://127.0.0.1:3080/' })
  expect(JSON.stringify(publish.mock.calls)).not.toContain('private-first')
  await expect(access.open()).resolves.toBe('opened')
  expect(open).toHaveBeenLastCalledWith('http://127.0.0.1:3080/?token=private-first')
  access.reset('starting')
  await expect(access.open()).resolves.toBe('unavailable')
  access.ready('http://127.0.0.1:55400/?token=private-second')
  await access.open()
  expect(open).toHaveBeenLastCalledWith('http://127.0.0.1:55400/?token=private-second')
  access.reset('unavailable')
  expect(access.status()).toEqual({ phase: 'unavailable' })
})

it('reports a browser launch failure without exposing the URL or claiming success', async () => {
  const access = new DesktopWebAccess(async () => { throw new Error('native failure') }, () => {})
  access.ready('http://127.0.0.1:3080/?token=private')
  await expect(access.open()).resolves.toBe('failed')
  expect(access.status().phase).toBe('ready')
})

it('preserves an owned HTTPS loopback Host address', async () => {
  const launch = vi.fn(async (_url: string) => {})
  const access = new DesktopWebAccess(launch, () => {})
  access.ready('https://127.0.0.1:3443/?token=private')
  expect(access.status()).toEqual({ phase: 'ready', address: 'https://127.0.0.1:3443/' })
  await expect(access.open()).resolves.toBe('opened')
  expect(launch).toHaveBeenCalledWith('https://127.0.0.1:3443/?token=private')
})

it.each([['http:', '80'], ['https:', '443']])('accepts the owned Host on the default %s port', (protocol, port) => {
  const access = new DesktopWebAccess(async () => {}, () => {})
  access.ready(`${protocol}//127.0.0.1:${port}/?token=private`)
  expect(access.status()).toEqual({ phase: 'ready', address: `${protocol}//127.0.0.1/` })
})

it.each(['https://example.com/?token=private', 'file:///etc/passwd', 'http://user:pass@127.0.0.1:3080/?token=private', 'http://127.0.0.1:3080/'])('rejects a non-Host browser launch address: %s', (url) => {
  const access = new DesktopWebAccess(async () => {}, () => {})
  expect(() =>{  access.ready(url) }).toThrow()
  expect(access.status()).toEqual({ phase: 'starting' })
})
