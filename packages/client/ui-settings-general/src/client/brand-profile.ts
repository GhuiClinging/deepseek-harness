/**
 * Detect a Client running with selected brand metadata.
 * @returns Whether a branded build or runtime profile is active.
 */
export function isBrandedClient(): boolean {
  return process.env.DSH_CLIENT_BUILD_PROFILE === 'brand'
    || (globalThis as typeof globalThis & { dshDesktopBrand?: object }).dshDesktopBrand !== undefined
}
