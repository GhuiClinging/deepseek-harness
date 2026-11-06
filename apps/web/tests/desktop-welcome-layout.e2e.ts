/** Native Welcome geometry using its source renderer and stylesheet, without a Host or Electron launch. */
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { chromium, type Browser } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Welcome } from '../../desktop/src/client/WelcomePage.tsx'
import { resolveDesktopLocale } from '../../desktop/src/locale.ts'
import type { WelcomeApi } from '../../desktop/src/welcome-api.ts'

const material = readFileSync(new URL('../../desktop/renderer/assets/window-material.css', import.meta.url), 'utf8')
const css = readFileSync(new URL('../../desktop/renderer/welcome.css', import.meta.url), 'utf8')
  .replace("@import url('./assets/window-material.css');", material)
const greeting = '欢迎回来，主人。今天有什么事务交给我？'
const account = { links: { usageUrl: '', topUpUrl: '' }, status: 'signed-out', attempt: null } as const

function welcomeMarkup(text?: string): string {
  const api: WelcomeApi = {
    ...resolveDesktopLocale('zh-CN', text === undefined ? undefined : '辉总后宫智囊团'),
    ...(text === undefined ? {} : { authenticationMode: 'api-key', presentation: {
      name: '辉总后宫智囊团', wordmark: '辉总 · 后宫智囊团', mark: '辉', greeting: text,
    } } as const),
    analyticsEnabled: async () => false, takeNotice: async () => undefined,
    startSignIn: async () => account, cancelSignIn: async () => account, copySignInLink: async () => {},
    saveApiKey: async () => ({ ok: true }), skip: async () => {}, onAccountState: () => () => {},
  }
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>${css}</style></head><body><div id="root">${renderToStaticMarkup(createElement(Welcome, { api }))}</div></body></html>`
}

let browser: Browser
beforeAll(async () => { browser = await chromium.launch({ headless: true }) })
afterAll(async () => { await browser?.close() })

describe('600×700 native Welcome layout', () => {
  it.each([
    ['light', greeting], ['dark', greeting],
    ['light', greeting.repeat(12)], ['dark', greeting.repeat(12)],
  ] as const)('keeps brand, greeting, form and actions in order (%s, greeting=%s)', async (colorScheme, text) => {
    const page = await browser.newPage({ viewport: { width: 600, height: 700 }, colorScheme })
    try {
      await page.setContent(welcomeMarkup(text))
      const geometry = await page.evaluate(() => {
        const box = (selector: string) => {
          const element = document.querySelector(selector)
          if (element === null) throw new Error(`Missing Welcome element ${selector}`)
          const rect = element.getBoundingClientRect()
          return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, height: rect.height }
        }
        const message = document.querySelector('.brand-greeting')!
        return { brand: box('.brand-text'), greeting: box('.brand-greeting'), form: box('#key-form'),
          actions: box('#key-actions'), save: box('#save-key'), skip: box('#skip-key'),
          greetingScrolls: message.scrollHeight > message.clientHeight,
          greetingOverflow: getComputedStyle(message).overflowY }
      })
      expect(geometry.brand.bottom).toBeLessThanOrEqual(geometry.greeting.top)
      expect(geometry.greeting.bottom).toBeLessThanOrEqual(geometry.form.top)
      expect(geometry.form.bottom).toBeLessThanOrEqual(geometry.actions.top)
      for (const box of Object.values({ brand: geometry.brand, greeting: geometry.greeting, form: geometry.form,
        save: geometry.save, skip: geometry.skip })) {
        expect(box.height).toBeGreaterThan(0)
        expect(box.top).toBeGreaterThanOrEqual(0)
        expect(box.bottom).toBeLessThanOrEqual(700)
        expect(box.left).toBeGreaterThanOrEqual(0)
        expect(box.right).toBeLessThanOrEqual(600)
      }
      if (text !== greeting) {
        expect(geometry.greetingScrolls).toBe(true)
        expect(geometry.greetingOverflow).toBe('auto')
      }
    } finally {
      await page.close()
    }
  })

  it.each(['light', 'dark'] as const)('retains the unselected entry layout in %s mode', async (colorScheme) => {
    const page = await browser.newPage({ viewport: { width: 600, height: 700 }, colorScheme })
    try {
      await page.setContent(welcomeMarkup())
      expect(await page.locator('.brand-greeting').count()).toBe(0)
      const brand = await page.locator('.brand').boundingBox()
      const tagline = await page.locator('#tagline').boundingBox()
      const actions = await page.locator('#entry-actions').boundingBox()
      const last = await page.locator('#api-key').boundingBox()
      expect(brand).not.toBeNull()
      expect(tagline).not.toBeNull()
      expect(actions).not.toBeNull()
      expect(last).not.toBeNull()
      expect(brand!.y + brand!.height).toBeLessThanOrEqual(tagline!.y)
      expect(tagline!.y + tagline!.height).toBeLessThanOrEqual(actions!.y)
      expect(last!.y + last!.height).toBeLessThanOrEqual(700)
    } finally {
      await page.close()
    }
  })
})
