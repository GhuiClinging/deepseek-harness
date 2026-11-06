import type { DesktopBrand } from '../src/brand.ts'

/** Build-only selection; icon paths are absolute and readable. */
export interface DesktopBrandSelection {
  readonly brand: DesktopBrand
  readonly icons: { readonly mac: string, readonly windows?: string }
  readonly backgrounds?: string
}
/**
 * Read and validate explicitly selected JSON and its artwork files.
 * @param file Descriptor filename; artwork paths resolve beside it.
 * @returns Validated public metadata and absolute artwork paths.
 */
export function loadDesktopBrand(file: string): DesktopBrandSelection
/**
 * Validate the internal subprocess carrier; undefined means no selected brand.
 * @param environment Packaging environment.
 * @returns Validated selection or undefined.
 */
export function resolveDesktopBrandEnvironment(environment?: NodeJS.ProcessEnv): DesktopBrandSelection | undefined
/**
 * Resolve names shared by the builder and fixed-name packaging consumers.
 * @param environment Packaging environment.
 * @returns Application name and artifact prefix.
 */
export function desktopPackageIdentity(environment?: NodeJS.ProcessEnv): { name: string, artifactPrefix: string }
