/** Onboarding state uses live Config fields. */
import { Context } from '@deepseek-ai/cordis'
import { expect, it, onTestFinished } from 'vitest'
import * as HostPlugin from '../src/index.ts'
import { liveConfig, omitsGeneratedPage } from '../../../settings/settings/tests/live-config.ts'
import { plainConfig } from '../../../settings/settings/src/schema.ts'
import * as General from '../src/index.ts'
import { resolveBackgroundLayout } from '../src/appearance/preferences.ts'

it('validates and updates onboarding preferences without remounting', async () => {
  const ctx = new Context()
  onTestFinished(() => ctx.fiber.dispose())
  const configuration = await liveConfig(ctx, General)
  await configuration.update({ welcomeNoticeVersion: 'v1' })
  expect(plainConfig(configuration.fiber.effectiveConfig)).toMatchObject({ welcomeNoticeVersion: 'v1' })
  expect(configuration.entry.fiber).toBe(configuration.fiber)
})

it('keeps its own instance off the generated Settings pages', () => omitsGeneratedPage(ctx => ctx.plugin(HostPlugin)))

it('updates local profile fields live without changing onboarding state', async () => {
  const ctx = new Context()
  onTestFinished(() => ctx.fiber.dispose())
  const configuration = await liveConfig(ctx, General, { welcomeNoticeVersion: 'v1' })
  expect(plainConfig(configuration.fiber.effectiveConfig)).toMatchObject({ localNickname: '', localAvatar: '' })
  await configuration.update({ localNickname: '郭辉', localAvatar: '' })
  expect(plainConfig(configuration.fiber.effectiveConfig)).toMatchObject({
    localNickname: '郭辉', localAvatar: '', welcomeNoticeVersion: 'v1',
  })
  expect(configuration.entry.fiber).toBe(configuration.fiber)
})

it.each([
  { localNickname: 'x'.repeat(65) },
  { localNickname: 'name\ncontrol' },
  { localAvatar: 'https://example.com/avatar.png' },
  { localAvatar: 'data:image/svg+xml,<svg onload="bad()" />' },
  { localAvatar: `data:image/png;base64,iVBORw0KGgo${'A'.repeat(100_000)}` },
])('rejects invalid local profile configuration %#', (value) => {
  expect(() => General.Config(value)).toThrow()
})

it('keeps photographic presentation opt-in and validates bounded live folder preferences', () => {
  expect(General.Config({})).toMatchObject({ brandAppearance: false, brandAssetsDirectory: '' })
  expect(() => General.Config({ backgroundFolder: 'bad\0path' })).toThrow()
  expect(() => General.Config({ backgroundMinSeconds: 0 })).toThrow()
  expect(() => General.Config({ backgroundMaxSeconds: 86401 })).toThrow()
})

it('accepts saved regional placement and rejects external or executable image references', () => {
  const layout = resolveBackgroundLayout({ backgroundFolder: '', backgroundMinSeconds: 300, backgroundMaxSeconds: 900 })
  expect(General.Config({ backgroundLayout: layout }).backgroundLayout.get()).toEqual(layout)
  for (const image of ['https://example.com/image.png', 'data:image/svg+xml,<svg/>']) {
    expect(() => General.Config({ backgroundLayout: { ...layout, sidebar: { ...layout.sidebar, image } } })).toThrow()
  }
  expect(() => General.Config({ backgroundLayout: { ...layout, unified: { ...layout.unified, opacity: 101 } } })).toThrow()
  expect(() => General.Config({ backgroundLayout: { ...layout, chat: { ...layout.chat, zoom: 0 } } })).toThrow()
})
