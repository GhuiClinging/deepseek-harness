/** Real Host/browser acceptance of scoped photographs and opaque standalone surfaces. */
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser } from 'playwright'
import { expect, it, onTestFinished } from 'vitest'
import { launchWebScaffold, type WebScaffold } from './scaffold.ts'
import { loadDesktopBrand } from '../../desktop/scripts/desktop-brand.mjs'
import { prepareDesktopBrandProfile } from '../../desktop/src/brand-profile.ts'

it('rotates scoped images, protects files, and keeps Settings opaque', async () => {
  const resources: { browser?: Browser; scaffold?: WebScaffold } = {}
  onTestFinished(async () => {
    try { await resources.browser?.close() } finally { await resources.scaffold?.close() }
  })
  const home = await mkdtemp(join(tmpdir(), 'huigong-appearance-web-'))
  const assets = join(home, 'brand-assets')
  await mkdir(join(assets, 'backgrounds'), { recursive: true })
  const icon = fileURLToPath(new URL('../../desktop/brands/huigong/icon.png', import.meta.url))
  await copyFile(icon, join(assets, 'logo.png'))
  await copyFile(icon, join(assets, 'backgrounds', 'first.png'))
  await copyFile(icon, join(assets, 'backgrounds', 'second.png'))
  const brand = loadDesktopBrand(fileURLToPath(new URL('../../desktop/brands/huigong/brand.json', import.meta.url))).brand
  const prepared = await prepareDesktopBrandProfile(brand, home, assets)
  const overlay = JSON.parse(await readFile(prepared.patchPath, 'utf8')) as { id: string; config?: Record<string, unknown> }[]
  const general = overlay.find(row => row.id === 'ui-settings-general')
  if (general?.config === undefined) throw new Error('missing brand appearance overlay')
  Object.assign(general.config, { backgroundMinSeconds: 5, backgroundMaxSeconds: 5 })
  await writeFile(prepared.patchPath, JSON.stringify(overlay))
  const scaffold = await launchWebScaffold({ harnessHome: home, extraOverlayPath: prepared.patchPath, profile: { packages: [] } })
  resources.scaffold = scaffold
  const origin = new URL(scaffold.authenticatedUrl).origin
  expect((await fetch(new URL('/api/brand-appearance/catalog', origin))).status).toBe(401)
  const channel = process.env.DSH_WEB_TEST_BROWSER_CHANNEL
  const browser = await chromium.launch({ headless: true, ...(channel === undefined ? {} : { channel }) })
  resources.browser = browser
  const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: 1440, height: 960 } })
  const page = await context.newPage()
  await page.goto(scaffold.authenticatedUrl)
  const currentImage = () => page.evaluate(() => document.documentElement.style.getPropertyValue('--dsh-brand-chat-image'))
  try { await expect.poll(currentImage).toContain('/api/brand-appearance/image') }
  catch (error) {
    const catalog = await page.request.get(new URL('/api/brand-appearance/catalog', origin).href)
    console.error('appearance browser diagnostics', { catalog: catalog.status(), body: await catalog.text(),
      page: (await page.locator('body').innerText()).slice(0, 1800), classes: await page.locator('html').getAttribute('class') })
    await page.screenshot({ path: fileURLToPath(new URL('../../../.dsh-build/huigong/appearance/browser-failure.png', import.meta.url)) })
    throw error
  }
  const first = await currentImage()
  await expect.poll(currentImage, { timeout: 12_000 }).not.toBe(first)
  expect(await page.locator('img[src="/api/brand-appearance/logo"]').count()).toBeGreaterThan(0)
  const logo = await page.request.get(new URL('/api/brand-appearance/logo', origin).href)
  expect(logo.status()).toBe(200)
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await page.getByRole('region', { name: '背景图片', exact: true }).waitFor()
  const color = await page.getByRole('dialog').evaluate(element => getComputedStyle(element).backgroundColor)
  expect(color).toMatch(/^rgb\(/u)
  const screenshot = fileURLToPath(new URL('../../../.dsh-build/huigong/appearance/browser-light.png', import.meta.url))
  await page.screenshot({ path: screenshot, fullPage: true })
  await page.emulateMedia({ colorScheme: 'dark' })
  expect(await page.getByRole('dialog').evaluate(element => getComputedStyle(element).backgroundColor)).toMatch(/^rgb\(/u)
})
