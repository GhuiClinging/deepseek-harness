/** Real Host/browser acceptance of scoped photographs and opaque standalone surfaces. */
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser } from 'playwright'
import { expect, it, onTestFinished } from 'vitest'
import { launchWebScaffold, type WebScaffold } from './scaffold.ts'
import { openSettings } from './support.ts'
import { loadDesktopBrand } from '../../desktop/scripts/desktop-brand.mjs'
import { prepareDesktopBrandProfile } from '../../desktop/src/brand-profile.ts'
import { prepareDesktopBrandAssets } from '../../desktop/scripts/prepare-brand-assets.ts'

it('rotates scoped images, protects files, and keeps Settings opaque', async () => {
  const resources: { browser?: Browser; scaffold?: WebScaffold } = {}
  onTestFinished(async () => {
    try { await resources.browser?.close() } finally { await resources.scaffold?.close() }
  })
  const home = await mkdtemp(join(tmpdir(), 'huigong-appearance-web-'))
  const assets = join(home, 'brand-assets')
  const selected = loadDesktopBrand(fileURLToPath(new URL('../../desktop/brands/huigong/brand.json', import.meta.url)))
  await prepareDesktopBrandAssets(home, selected)
  const customFolder = join(home, 'custom-backgrounds')
  await mkdir(customFolder)
  await writeFile(join(customFolder, 'custom.png'), await readFile(selected.icons.mac))
  const brand = selected.brand
  const prepared = await prepareDesktopBrandProfile(brand, home, assets)
  const overlay = JSON.parse(await readFile(prepared.patchPath, 'utf8')) as { id: string; config?: Record<string, unknown> }[]
  overlay.push({ id: 'ui-settings-general', config: { backgroundMinSeconds: 5, backgroundMaxSeconds: 5 } })
  await writeFile(prepared.patchPath, JSON.stringify(overlay))
  const previousAssetsDirectory = process.env.DSH_BRAND_ASSETS_DIRECTORY
  process.env.DSH_BRAND_ASSETS_DIRECTORY = assets
  let scaffold: WebScaffold
  try {
    scaffold = await launchWebScaffold({ harnessHome: home, extraOverlayPath: prepared.patchPath, profile: { packages: [] } })
  } finally {
    if (previousAssetsDirectory === undefined) delete process.env.DSH_BRAND_ASSETS_DIRECTORY
    else process.env.DSH_BRAND_ASSETS_DIRECTORY = previousAssetsDirectory
  }
  resources.scaffold = scaffold
  const origin = new URL(scaffold.authenticatedUrl).origin
  expect((await fetch(new URL('/api/brand-appearance/catalog', origin))).status).toBe(401)
  expect((await fetch(new URL('/api/brand-appearance/preview', origin), { method: 'POST', body: '{}' })).status).toBe(401)
  const channel = process.env.DSH_WEB_TEST_BROWSER_CHANNEL
  const browser = await chromium.launch({ headless: true, ...(channel === undefined ? {} : { channel }) })
  resources.browser = browser
  const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: 1440, height: 960 } })
  const page = await context.newPage()
  const imageRequests: { path: string; status?: number; failure?: string | null }[] = []
  page.on('response', (response) => {
    const url = new URL(response.url())
    if (url.pathname.startsWith('/api/brand-appearance/')) imageRequests.push({ path: url.pathname + url.search, status: response.status() })
  })
  page.on('requestfailed', (request) => {
    const url = new URL(request.url())
    if (url.pathname.startsWith('/api/brand-appearance/')) imageRequests.push({ path: url.pathname + url.search, failure: request.failure()?.errorText ?? null })
  })
  page.on('console', (message) => { if (message.type() === 'error') console.error('background browser console', message.text()) })
  await page.goto(scaffold.authenticatedUrl)
  const currentImage = () => page.evaluate(() => document.documentElement.style.getPropertyValue('--dsh-brand-unified-image'))
  try { await expect.poll(currentImage).toContain('/api/brand-appearance/image') }
  catch (error) {
    const catalog = await page.request.get(new URL('/api/brand-appearance/catalog?region=unified', origin).href)
    console.error('appearance browser diagnostics', { catalog: catalog.status(), body: await catalog.text(),
      page: (await page.locator('body').innerText()).slice(0, 1800), classes: await page.locator('html').getAttribute('class'), imageRequests })
    await page.screenshot({ path: fileURLToPath(new URL('../../../.dsh-build/huigong/appearance/browser-failure.png', import.meta.url)) })
    throw error
  }
  const first = await currentImage()
  await expect.poll(currentImage, { timeout: 12_000 }).not.toBe(first)
  for (const [region, directory, count] of [['chat', 'horizontal', 10], ['sidebar', 'vertical', 22], ['unified', 'horizontal', 10]] as const) {
    const catalog = await page.request.get(new URL(`/api/brand-appearance/catalog?region=${region}`, origin).href)
    expect(catalog.status()).toBe(200)
    const listed = await catalog.json() as { images: string[]; unavailable: boolean }
    expect(listed.unavailable).toBe(false)
    expect(listed.images).toHaveLength(count)
    const url = listed.images[0]
    if (url === undefined) throw new Error('missing gallery image')
    if (region === 'unified') expect(listed.images).toContain((await currentImage()).slice(5, -2))
    const photograph = await page.request.get(new URL(url, origin).href)
    expect(photograph.status()).toBe(200)
    const folder = join(assets, 'backgrounds', directory)
    const hashes = await Promise.all((await readdir(folder)).map(async name => createHash('sha256').update(await readFile(join(folder, name))).digest('hex')))
    expect(hashes).toContain(createHash('sha256').update(await photograph.body()).digest('hex'))
  }
  expect((await page.request.get(new URL('/api/brand-appearance/catalog?region=invalid', origin).href)).status()).toBe(400)
  expect(await page.locator('img[src="/api/brand-appearance/logo"]').count()).toBeGreaterThan(0)
  expect(await page.locator('[data-brand-sidebar-content]').evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
  const logo = await page.request.get(new URL('/api/brand-appearance/logo', origin).href)
  expect(logo.status()).toBe(200)
  expect(await logo.body()).toEqual(await readFile(selected.icons.mac))
  expect(await page.locator('[data-brand-frame]').evaluate(element => getComputedStyle(element, '::after').backgroundImage))
    .toContain('/api/brand-appearance/image')
  expect(await page.locator('[data-brand-sidebar]').evaluate(element => getComputedStyle(element, '::before').display)).toBe('none')
  const screenshots = fileURLToPath(new URL('../../../.dsh-build/huigong/appearance/', import.meta.url))
  await mkdir(screenshots, { recursive: true })
  await page.screenshot({ path: join(screenshots, 'home-material.png'), fullPage: true })
  await openSettings(page, 'zh')
  await page.getByRole('button', { name: '背景', exact: true }).click()
  await page.getByRole('region', { name: '背景图片', exact: true }).waitFor()
  const color = await page.getByRole('dialog').evaluate(element => getComputedStyle(element).backgroundColor)
  expect(color).toMatch(/^rgb\(/u)
  const editor = page.getByRole('region', { name: '背景图片', exact: true })
  expect(await editor.getByRole('tab', { name: '整窗连续背景', exact: true }).getAttribute('aria-selected')).toBe('true')
  await editor.getByRole('tab', { name: '分别设置', exact: true }).click()
  expect(await editor.getByRole('tab', { name: '侧边栏', exact: true }).getAttribute('aria-selected')).toBe('true')
  expect(await editor.getByRole('tab', { name: '完整显示', exact: true }).getAttribute('aria-selected')).toBe('true')
  await editor.getByRole('textbox', { name: '图片文件夹', exact: true }).fill(customFolder)
  await editor.getByRole('button', { name: '选择目录', exact: true }).click()
  const picker = editor.getByRole('region', { name: '选择目录', exact: true })
  try { await picker.waitFor({ timeout: 5000 }) }
  catch (error) {
    console.error('background picker state', await editor.innerText())
    await page.screenshot({ path: join(screenshots, 'picker-failure.png'), fullPage: true })
    throw error
  }
  await picker.getByRole('button', { name: '使用此目录', exact: true }).click()
  const preview = editor.getByRole('img', { name: '背景预览', exact: true }).locator('div').first()
  await expect.poll(async () => {
    const style = await preview.getAttribute('style')
    const url = style?.match(/url\("([^"]+)"\)/u)?.[1]
    if (url === undefined) return false
    const response = await page.request.get(new URL(url, origin).href)
    return response.status() === 200 && (await response.body()).equals(await readFile(selected.icons.mac))
  }).toBe(true)
  await editor.getByRole('slider', { name: '图片不透明度', exact: true }).press('End')
  await editor.getByRole('button', { name: '保存外观', exact: true }).click()
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--dsh-brand-sidebar-opacity'))).toBe('1')
  await editor.getByRole('tab', { name: '整窗连续背景', exact: true }).click()
  await editor.getByRole('tab', { name: '固定图片', exact: true }).click()
  await editor.locator('input[type="file"]').setInputFiles(selected.icons.mac)
  await expect.poll(() => editor.getByRole('img', { name: '背景预览', exact: true }).locator('div').first().getAttribute('style')).toContain('data:image/webp;')
  await editor.getByRole('slider', { name: '水平位置', exact: true }).press('Home')
  await editor.getByRole('slider', { name: '垂直位置', exact: true }).press('End')
  await editor.getByRole('slider', { name: '缩放', exact: true }).press('End')
  await editor.getByRole('slider', { name: '图片不透明度', exact: true }).press('End')
  await editor.getByRole('button', { name: '保存外观', exact: true }).click()
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--dsh-brand-unified-image'))).toContain('data:image/webp;')
  const placement = await page.evaluate(() => {
    const root = document.documentElement.style
    const frame = document.querySelector('[data-brand-frame]')
    const sidebar = document.querySelector('[data-brand-sidebar]')
    if (frame === null || sidebar === null) throw new Error('missing background regions')
    return { x: root.getPropertyValue('--dsh-brand-unified-x'), y: root.getPropertyValue('--dsh-brand-unified-y'),
      zoom: root.getPropertyValue('--dsh-brand-unified-zoom'), opacity: root.getPropertyValue('--dsh-brand-unified-opacity'),
      frameImage: getComputedStyle(frame, '::after').backgroundImage.startsWith('url("data:image/webp;'),
      sidebarImageDisplay: getComputedStyle(sidebar, '::before').display,
      sidebarColor: getComputedStyle(sidebar).backgroundColor }
  })
  expect(placement).toMatchInlineSnapshot(`
    {
      "frameImage": true,
      "opacity": "1",
      "sidebarColor": "rgba(0, 0, 0, 0)",
      "sidebarImageDisplay": "none",
      "x": "0%",
      "y": "100%",
      "zoom": "3",
    }
  `)
  await page.reload()
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--dsh-brand-unified-zoom'))).toBe('3')
  await openSettings(page, 'zh')
  await page.getByRole('button', { name: '背景', exact: true }).click()
  await editor.getByRole('tab', { name: '分别设置', exact: true }).click()
  expect(await editor.getByRole('textbox', { name: '图片文件夹', exact: true }).inputValue()).toBe(customFolder)
  expect(await editor.getByRole('slider', { name: '图片不透明度', exact: true }).inputValue()).toBe('100')
  await editor.getByRole('tab', { name: '主页', exact: true }).click()
  expect(await editor.getByRole('slider', { name: '图片不透明度', exact: true }).inputValue()).toBe('40')
  expect(await editor.getByRole('tab', { name: '铺满区域', exact: true }).getAttribute('aria-selected')).toBe('true')
  await editor.getByRole('button', { name: '保存外观', exact: true }).click()
  await expect.poll(() => editor.getByRole('img', { name: '背景预览', exact: true }).getAttribute('aria-busy')).toBe('false')
  const screenshot = fileURLToPath(new URL('../../../.dsh-build/huigong/appearance/browser-light.png', import.meta.url))
  await page.screenshot({ path: screenshot, fullPage: true })
  await page.emulateMedia({ colorScheme: 'dark' })
  expect(await page.getByRole('dialog').evaluate(element => getComputedStyle(element).backgroundColor)).toMatch(/^rgb\(/u)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.getByRole('dialog').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
})
