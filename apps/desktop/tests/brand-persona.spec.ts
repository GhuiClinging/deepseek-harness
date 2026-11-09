/** Keyless shipped-preset persona assembly and durable model-request evidence. */
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { afterEach, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader, { interpolate, type EntryOptions } from '@deepseek-ai/cordis-plugin-loader'
import { composeEntries, loadOverlayPatches } from '@deepseek-ai/dsh-app-boot'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import LlmRuntime, { createUserMessage } from '@deepseek-ai/dsh-llm'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import type { Config as PersonaConfig } from '@deepseek-ai/dsh-persona'
import * as Persona from '@deepseek-ai/dsh-persona'
import * as NativeExecutor from '@deepseek-ai/dsh-tool-executor-native'
import { MockAdapter, textResponse } from '../../../packages/core/agent-loop/tests/mock-adapter.ts'
import { parseDesktopBrand } from '../src/brand.ts'
import { prepareDesktopBrandProfile } from '../src/brand-profile.ts'

const bundle = fileURLToPath(new URL('../../../packages/bundle/', import.meta.url))
const descriptor = JSON.parse(await readFile(new URL('../brands/huigong/brand.json', import.meta.url), 'utf8')) as Record<string, unknown>
const { icons: _icons, backgrounds: _backgrounds, ...metadata } = descriptor
const brand = { ...parseDesktopBrand(metadata), personaSource: 'local' as const }
const load = (path: string) => loadOverlayPatches('brand test', path)
afterEach(() => { vi.unstubAllEnvs() })

function presetPersona(preset: string): EntryOptions {
  const declaration = composeEntries([load(join(bundle, `web-app/presets/${preset}.patch.yml`))])[0]!
  const config = declaration.config as { plugins: EntryOptions[] }
  return config.plugins.find(row => row.id === 'persona')!
}

it.each(['standard', 'ptc', 'minimal', 'cordis'])('records edited role instructions from the effective %s scoped persona', async (preset) => {
  const home = await mkdtemp(join(tmpdir(), 'dsh-brand-prompt-'))
  const edited = { ...brand.persona, name: '编辑后的角色', instructions: '本机编辑的指示，保持审批要求。' }
  await writeFile(join(home, 'persona.json'), JSON.stringify(edited))
  const prepared = await prepareDesktopBrandProfile(brand, home)
  const prefix = prepared.personaPrefix
  vi.stubEnv('DSH_DESKTOP_PERSONA_PREFIX', prefix)
  const ctx = new Context()
  try {
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionProjectionRegistry)
    await ctx.plugin(SystemPrompt, { personaPrefix: 'shadowed upstream identity' })
    await ctx.plugin(ToolRuntime)
    await ctx.plugin(NativeExecutor)
    await ctx.plugin(AgentRegistry)
    await ctx.plugin(AgentLoop, { agents: [] })
    await ctx.plugin(Loader)
    const adapter = new MockAdapter([textResponse('主人，已整理。')])
    ctx.llm.registerAdapter(['mock'], adapter)
    const row = presetPersona(preset)
    const { agent } = await ctx.agents.create({
      sessionId: SessionId(`brand-${preset}`), agentOptions: { provider: 'mock', model: 'mock' },
      async setup(scope) {
        // The real loader evaluates the scoped row before the Persona plugin validates it.
        await scope.plugin(Persona, interpolate(scope, row.config) as PersonaConfig)
      },
    })
    agent.followup(createUserMessage({ content: [{ type: 'text', text: '请整理' }], source: { kind: 'user' } }))
    await agent.whenIdle()
    expect(adapter.requests).toHaveLength(1)
    const system = adapter.requests[0]!.messages.filter(message => message.role === 'system')
    const text = system.flatMap(message => message.content).filter(block => block.type === 'text').map(block => block.text).join('\n')
    expect(text).toContain(edited.name)
    expect(text).toContain(edited.instructions)
    expect(text).not.toContain('shadowed upstream identity')
    expect(agent.session.deriveMessages().filter(message => message.role === 'system')).toEqual(system)
    const events = agent.session.snapshotEvents().filter(event => event.type === 'system/message')
    expect(events).toHaveLength(1)
    if (preset === 'minimal') {
      expect(row.config).toMatchObject({ complete: true, includeRuntimeContext: false })
      expect(text).not.toContain('You are an AI agent powered by DeepSeek Harness.')
    }
  } finally { await ctx.fiber.dispose() }
})

it.each(['standard', 'ptc', 'minimal', 'cordis'])('keeps the original unselected %s prefix and explicit user preset edits', async (preset) => {
  vi.stubEnv('DSH_DESKTOP_PERSONA_PREFIX', undefined)
  const row = presetPersona(preset)
  const configValue = interpolate({}, row.config) as PersonaConfig
  expect(configValue.prefix).toBe(preset === 'minimal'
    ? 'You are a helpful software engineer assistant.' : 'You are a coding agent powered by the {{model}} model.')
  const home = await mkdtemp(join(tmpdir(), 'dsh-brand-compose-'))
  const prepared = await prepareDesktopBrandProfile(brand, home)
  const layers = [load(join(bundle, 'base/cordis.patch.yml')), load(join(bundle, 'web-app/cordis.patch.yml')),
    load(join(bundle, `web-app/presets/${preset}.patch.yml`))]
  const original = composeEntries(layers).find(entry => entry.id === `preset-${preset}`)!
  const config = { ...original.config as object, name: 'User preset', plugins: [row, { id: 'custom-tool', name: 'custom-plugin' }] }
  const effective = composeEntries([...layers, [{ id: original.id, config }, { id: 'system-prompt', config: { personaPrefix: 'user global prefix', personaSuffix: 'user instructions' } }], load(prepared.patchPath)])
  expect(effective.find(entry => entry.id === original.id)?.config).toEqual(config)
  expect(effective.find(entry => entry.id === 'system-prompt')?.config).toEqual({ personaPrefix: 'user global prefix', personaSuffix: 'user instructions' })
  expect(effective.find(entry => entry.id === 'llm-deepseek')?.disabled).not.toBe(true)
  expect(effective.find(entry => entry.id === 'settings-controller')?.disabled).not.toBe(true)
})
