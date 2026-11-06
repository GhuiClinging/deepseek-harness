/** Public product identity persisted in a branded Desktop application's manifest. */

/** Persona defaults; model instructions must enter the existing logged prompt assembly. */
export interface DesktopBrandPersona {
  readonly name: string
  readonly address: string
  readonly greeting: string
  readonly instructions: string
  readonly completion: string
}

/** Exact third-party bundle carried by the immutable application runtime. */
export interface DesktopBundledPlugin {
  readonly name: string
  readonly version: string
}

/** Public metadata only; artwork paths and credentials never belong in this object. */
export interface DesktopBrand {
  readonly id: string
  readonly name: string
  readonly wordmark: string
  readonly appId: string
  readonly protocol: string
  readonly storageNamespace: string
  readonly mark: string
  /** Optional fixed brand image served by the application-owned appearance resource. */
  readonly logo?: '/api/brand-appearance/logo'
  readonly persona: DesktopBrandPersona
  /** Omitted or local reads the retained role file; bundled uses this application's metadata. */
  readonly personaSource?: 'local' | 'bundled'
  /** Omitted means the application carries only the upstream bundles. */
  readonly bundledPlugins?: readonly DesktopBundledPlugin[]
}

function record(value: unknown, fields: readonly string[], subject: string, optional: readonly string[] = []): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)
    || Object.keys(value).some(field => !fields.includes(field) && !optional.includes(field))
    || fields.some(field => !Object.hasOwn(value, field))) {
    throw new Error(`desktop brand: ${subject} must contain exactly ${fields.join(', ')}`)
  }
  return value as Record<string, unknown>
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) {
    throw new Error(`desktop brand: ${field} must be nonempty text without control characters or surrounding whitespace`)
  }
  return value
}

function identifier(value: unknown, field: string, pattern = /^[a-z][a-z0-9-]*$/u): string {
  const result = text(value, field)
  if (!pattern.test(result)) throw new Error(`desktop brand: invalid ${field}`)
  return result
}

/**
 * Validate public JSON metadata without importing Electron, filesystem APIs, or application state.
 * @param value - Public descriptor read from JSON or a packaged manifest.
 * @returns Validated metadata with no unknown fields.
 * @throws When a required field is missing, malformed, or unsafe for application filenames.
 */
export function parseDesktopBrand(value: unknown): DesktopBrand {
  const data = record(value, ['id', 'name', 'wordmark', 'appId', 'protocol', 'storageNamespace', 'mark', 'persona'], 'metadata', ['personaSource', 'bundledPlugins', 'logo'])
  if (data.logo !== undefined && data.logo !== '/api/brand-appearance/logo') throw new Error('desktop brand: invalid logo resource')
  if (data.personaSource !== undefined && data.personaSource !== 'local' && data.personaSource !== 'bundled') {
    throw new Error('desktop brand: personaSource must be local or bundled')
  }
  let bundledPlugins: DesktopBundledPlugin[] | undefined
  if (data.bundledPlugins !== undefined) {
    if (!Array.isArray(data.bundledPlugins)) throw new Error('desktop brand: bundledPlugins must be an array')
    const names = new Set<string>()
    bundledPlugins = data.bundledPlugins.map((value: unknown) => {
      const plugin = record(value, ['name', 'version'], 'bundled plugin')
      const name = identifier(plugin.name, 'plugin.name', /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u)
      const version = identifier(plugin.version, 'plugin.version', /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/u)
      if (name.startsWith('@deepseek-ai/') || names.has(name)) throw new Error('desktop brand: bundled plugins must be unique third-party packages')
      names.add(name)
      return { name, version }
    })
  }
  const persona = record(data.persona, ['name', 'address', 'greeting', 'instructions', 'completion'], 'persona')
  const name = text(data.name, 'name')
  // Keep the display name unchanged in electron-builder filenames and reserve the .app suffix.
  if (!/^[\p{L}\p{N}][\p{L}\p{N}\p{M} ._-]*$/u.test(name) || name.endsWith('.')
    || /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/iu.test(name)
    || new TextEncoder().encode(name).byteLength > 251) {
    throw new Error('desktop brand: name must be a safe application filename (letters, numbers, spaces, dots, underscores, hyphens; at most 251 UTF-8 bytes)')
  }
  return {
    id: identifier(data.id, 'id'), name,
    wordmark: text(data.wordmark, 'wordmark'),
    appId: identifier(data.appId, 'appId', /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/u),
    protocol: identifier(data.protocol, 'protocol'),
    storageNamespace: identifier(data.storageNamespace, 'storageNamespace'),
    mark: text(data.mark, 'mark'),
    ...(data.logo === undefined ? {} : { logo: data.logo }),
    ...(data.personaSource === undefined ? {} : { personaSource: data.personaSource }),
    ...(bundledPlugins === undefined ? {} : { bundledPlugins }),
    persona: {
      name: text(persona.name, 'persona.name'), address: text(persona.address, 'persona.address'),
      greeting: text(persona.greeting, 'persona.greeting'), instructions: text(persona.instructions, 'persona.instructions'),
      completion: text(persona.completion, 'persona.completion'),
    },
  }
}
