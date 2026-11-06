/** The isolated welcome preload exposes public copy while retaining upstream defaults. */
import { afterEach, expect, it, vi } from 'vitest'
import type { WelcomeApi } from '../src/welcome-api.ts'

const electron = vi.hoisted(() => ({
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: { invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn() },
}))
vi.mock('electron', () => electron)

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); vi.clearAllMocks() })

it('decodes current public identity and greeting without account defaults', async () => {
  const presentation = { name: '辉总后宫智囊团', wordmark: '辉总 · 后宫智囊团', mark: '辉', greeting: '主人，今天也请交给我。' }
  vi.stubGlobal('process', { ...process, argv: ['--dsh-welcome-locale=zh-CN', '--dsh-welcome-authentication=api-key',
    ...Object.entries(presentation).map(([key, value]) => `--dsh-welcome-brand-${key}=${encodeURIComponent(value)}`)] })
  await import('../src/preload-welcome.ts')
  const api = electron.contextBridge.exposeInMainWorld.mock.calls[0]?.[1] as WelcomeApi
  expect(api.authenticationMode).toBe('api-key')
  expect(api.messages.welcomeTitle).toBe('辉总后宫智囊团')
  expect(api.presentation).toEqual(presentation)
  expect(Object.isFrozen(api.presentation)).toBe(true)
})

it('retains the unselected locale and account mode', async () => {
  vi.stubGlobal('process', { ...process, argv: ['--dsh-welcome-locale=en'] })
  await import('../src/preload-welcome.ts')
  const api = electron.contextBridge.exposeInMainWorld.mock.calls[0]?.[1] as WelcomeApi
  expect(api.authenticationMode).toBe('account')
  expect(api.messages.welcomeTitle).toBe('DeepSeek Harness')
  expect(api.presentation).toBeUndefined()
})

it('rejects an incomplete selected presentation before exposing the API', async () => {
  vi.stubGlobal('process', { ...process, argv: ['--dsh-welcome-locale=en', '--dsh-welcome-brand-name=Brand'] })
  await expect(import('../src/preload-welcome.ts')).rejects.toThrow('incomplete brand presentation')
  expect(electron.contextBridge.exposeInMainWorld).not.toHaveBeenCalled()
})
