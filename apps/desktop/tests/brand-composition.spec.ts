/** Disabled brand exporter/account chains settle without missing-service consumers. */
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import { auditStartupEntries, composeEntries, loadOverlayPatches } from '@deepseek-ai/dsh-app-boot'
import { captureStartupComposition } from '../../../packages/boot/app-boot/src/startup-diagnostics.ts'
import { expect, it } from 'vitest'
import { parseDesktopBrand } from '../src/brand.ts'
import { prepareDesktopBrandProfile } from '../src/brand-profile.ts'

it('disables telemetry without disabling the selected account services', async () => {
  const descriptor = JSON.parse(await readFile(new URL('../brands/huigong/brand.json', import.meta.url), 'utf8')) as Record<string, unknown>
  const { icons: _icons, backgrounds: _backgrounds, ...metadata } = descriptor
  const home = await mkdtemp(join(tmpdir(), 'dsh-brand-services-'))
  const prepared = await prepareDesktopBrandProfile(parseDesktopBrand(metadata), home)
  const bundle = fileURLToPath(new URL('../../../packages/bundle/', import.meta.url))
  const load = (path: string) => loadOverlayPatches('brand test', path)
  const patches = load(prepared.patchPath)
  const ids = new Set(patches.filter(row => row.disabled).map(row => row.id))
  expect(ids.has('product-analytics')).toBe(true)
  expect(ids.has('desktop-product-telemetry')).toBe(true)
  expect(ids.has('session-telemetry-otel')).toBe(true)
  for (const id of ['deepseek-account', 'llm-deepseek-account', 'account-controller', 'ui-settings-account']) {
    expect(ids.has(id)).toBe(false)
  }
  const entries = composeEntries([load(join(bundle, 'base/cordis.patch.yml')), load(join(bundle, 'web-app/cordis.patch.yml')), patches])
  const ctx = new Context()
  try {
    await ctx.plugin(Loader)
    await ctx.loader.root.update(entries.filter(row => ids.has(row.id)))
    await ctx.loader.await()
    const warnings: string[] = []
    await auditStartupEntries(ctx, 'brand test', line => warnings.push(line))
    expect(warnings).toEqual([])
    expect([...ctx.loader.entries()].map(row => row.disabled)).toEqual(entries.filter(row => ids.has(row.id)).map(() => true))
    expect(captureStartupComposition(ctx).services).toEqual([])
    expect(ctx.get('productTelemetry')).toBeUndefined()
  } finally { await ctx.fiber.dispose() }
})
