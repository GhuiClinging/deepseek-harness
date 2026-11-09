/** A draft-directory preview; loading or failure never presents a photograph from a different directory. */
import { useEffect, useState } from 'react'
import type { AppearanceCatalog, AppearanceRegion, BackgroundSettings } from '../../types.ts'
import css from './Appearance.module.css'

/** Local preview inputs and already-localized labels. */
export interface BackgroundPreviewProps {
  readonly region: AppearanceRegion
  readonly background: BackgroundSettings
  readonly label: string
  readonly failureLabel: string
  readonly emptyLabel: string
  readonly previewFolder: (region: AppearanceRegion, folder: string, signal: AbortSignal) => Promise<AppearanceCatalog>
}

/**
 * @param props - Selected draft source, placement, and authenticated directory reader.
 * @returns Regional preview and retained failure guidance.
 */
export function BackgroundPreview({ region, background, label, failureLabel, emptyLabel, previewFolder }: BackgroundPreviewProps) {
  const [preview, setPreview] = useState<{ readonly key: string; readonly image?: string; readonly problem?: 'folder' | 'empty' }>()
  const key = `${region}\0${background.folder}`
  useEffect(() => {
    if (background.source !== 'gallery') return
    const controller = new AbortController()
    // Pace directory typing; request identity and cancellation retire stale results independently of this delay.
    const timer = setTimeout(() => {
      void previewFolder(region, background.folder, controller.signal).then((catalog) => {
        if (controller.signal.aborted) return
        const image = catalog.images[0]
        setPreview(catalog.unavailable ? { key, problem: 'folder' } : image === undefined ? { key, problem: 'empty' } : { key, image })
      }, () => { if (!controller.signal.aborted) setPreview({ key, problem: 'folder' }) })
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [region, background.folder, background.source, key, previewFolder])
  const current = preview?.key === key ? preview : undefined
  const image = background.source === 'image' ? background.image : background.source === 'gallery' ? current?.image ?? '' : ''
  return <>
    <div className={css.preview} role="img" aria-label={label} aria-busy={background.source === 'gallery' && current === undefined}
      style={{ aspectRatio: region === 'sidebar' ? '3 / 8' : '16 / 10', width: region === 'sidebar' ? 'min(100%, 105px)' : '100%' }}>
      <div className={css.picture} style={{ backgroundImage: image === '' ? 'none' : `url("${image}")`,
        backgroundSize: background.fit, backgroundPosition: `${background.x}% ${background.y}%`,
        opacity: background.opacity / 100, transform: `scale(${background.zoom / 100})`, transformOrigin: `${background.x}% ${background.y}%` }} />
      {region === 'unified' && <span className={css.previewDivider} />}
    </div>
    {background.source === 'gallery' && current?.problem !== undefined
      && <div className={css.error} role="alert">{current.problem === 'empty' ? emptyLabel : failureLabel}</div>}
  </>
}
