/** Local display identity persists through the real Web profile and reaches another authenticated client. */
import { mkdir, mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser } from 'playwright'
import { expect, it, onTestFinished } from 'vitest'
import { launchWebScaffold, type WebScaffold } from './scaffold.ts'
import { loadDesktopBrand } from '../../desktop/scripts/desktop-brand.mjs'
import { prepareDesktopBrandProfile } from '../../desktop/src/brand-profile.ts'

it('shares a saved local nickname and normalized avatar across two clients and a reload', async () => {
  const resources: { browser?: Browser; scaffold?: WebScaffold } = {}
  onTestFinished(async () => {
    try { await resources.browser?.close() } finally { await resources.scaffold?.close() }
  })
  const home = await mkdtemp(join(tmpdir(), 'huigong-local-profile-web-'))
  const brand = loadDesktopBrand(fileURLToPath(new URL('../../desktop/brands/huigong/brand.json', import.meta.url))).brand
  const prepared = await prepareDesktopBrandProfile(brand, home)
  const scaffold = await launchWebScaffold({ harnessHome: home, extraOverlayPath: prepared.patchPath, profile: { packages: [] } })
  resources.scaffold = scaffold
  const channel = process.env.DSH_WEB_TEST_BROWSER_CHANNEL
  const browser = await chromium.launch({ headless: true, ...(channel === undefined ? {} : { channel }) })
  resources.browser = browser
  const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: 1440, height: 960 } })
  const first = await context.newPage()
  const second = await context.newPage()
  const errors: string[] = []
  first.on('pageerror', error => errors.push(error.message))
  second.on('pageerror', error => errors.push(error.message))
  await first.goto(scaffold.authenticatedUrl)
  await second.goto(scaffold.authenticatedUrl)
  await first.getByRole('button', { name: '设置', exact: true }).waitFor()
  await first.getByRole('button', { name: '设置', exact: true }).click()
  const editor = first.getByRole('region', { name: '本机资料', exact: true })
  await editor.waitFor()
  await editor.getByRole('textbox', { name: '昵称', exact: true }).fill('验收用户')
  await editor.locator('input[type="file"]').setInputFiles(fileURLToPath(new URL('../../desktop/brands/huigong/icon.png', import.meta.url)))
  await editor.locator('img[src^="data:image/png;base64,"]').waitFor()
  await editor.getByRole('button', { name: '保存资料', exact: true }).click()
  await first.getByText('本机资料已保存', { exact: true }).waitFor()
  await expect.poll(() => second.getByRole('button', { name: '设置', exact: true }).textContent()).toContain('验收用户')
  const profile = join(home, 'profiles/scaffold/cordis.patch.yml')
  await expect.poll(async () => (await readFile(profile, 'utf8')).includes('验收用户')).toBe(true)
  const screenshots = fileURLToPath(new URL('../../../.dsh-build/huigong/extensions-screenshots/', import.meta.url))
  await mkdir(screenshots, { recursive: true })
  await first.screenshot({ path: join(screenshots, 'local-profile-light.png'), fullPage: true })
  await first.emulateMedia({ colorScheme: 'dark' })
  await first.screenshot({ path: join(screenshots, 'local-profile-dark.png'), fullPage: true })
  await first.setViewportSize({ width: 390, height: 844 })
  expect(await editor.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await first.screenshot({ path: join(screenshots, 'local-profile-narrow.png'), fullPage: true })
  await second.reload()
  await expect.poll(() => second.getByRole('button', { name: '设置', exact: true }).textContent()).toContain('验收用户')
  expect(await second.getByRole('button', { name: '设置', exact: true }).locator('img').getAttribute('src')).toMatch(/^data:image\/png;base64,/u)
  expect(errors).toEqual([])
})
