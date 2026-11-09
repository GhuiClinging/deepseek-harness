/** Folder and rotation controls inside the existing General settings surface. */
import { useEffect, useId, useRef, useState } from 'react'
import { Button, Input, SegmentedControl, Toast } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { AppearanceSource } from './source.ts'
import type { AppearanceCatalog, AppearanceRegion, BackgroundLayout, BackgroundSettings } from '../../types.ts'
import { resolveBackgroundLayout } from '../../appearance/preferences.ts'
import { normalizeBackgroundImage } from './image.ts'
import { BackgroundPreview } from './BackgroundPreview.tsx'
import css from './Appearance.module.css'

/** Shared accepted preferences, image state, and user operations. */
export interface AppearanceEditorInjected {
  hooks: { appearance: AppearanceSource['form']; appearanceState: AppearanceSource['store'] }
  save: AppearanceSource['save']
  shuffle: AppearanceSource['shuffle']
  togglePaused: AppearanceSource['togglePaused']
  pickFolder(): Promise<{ readonly kind: 'picked'; readonly path: string | null } | { readonly kind: 'browse' }>
  listFolders(path: string | undefined, signal: AbortSignal): Promise<BackgroundFolderListing>
  previewFolder(region: AppearanceRegion, folder: string, signal: AbortSignal): Promise<AppearanceCatalog>
}

/** Directory rows projected from the existing Host directory picker. */
export interface BackgroundFolderListing {
  readonly path: string
  readonly crumbs: readonly { readonly name: string; readonly path: string }[]
  readonly entries: readonly { readonly name: string; readonly path: string; readonly hidden: boolean }[]
  readonly truncated: boolean
}

/** @param props - Existing Host form and regional image controller. @returns Brand-only picture preferences. */
export function AppearanceEditor({ useAppearance, useAppearanceState, save, shuffle, togglePaused,
  pickFolder, listFolders, previewFolder, t }:
  PropsRuntime<'settings.section'> & PropsLocale<'settings'> & InjectFace<AppearanceEditorInjected>) {
  const accepted = useAppearance(value => value)
  const state = useAppearanceState(value => value)
  const [draft, setDraft] = useState<BackgroundLayout>()
  const [selected, setSelected] = useState<'chat' | 'sidebar'>('sidebar')
  const [invalid, setInvalid] = useState<'range' | 'imageError' | 'folder'>()
  const [choosing, setChoosing] = useState(false)
  const [folders, setFolders] = useState<BackgroundFolderListing>()
  const request = useRef<AbortController>()
  const file = useRef<HTMLInputElement>(null)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false; request.current?.abort() } }, [])
  const id = useId()
  if (accepted.value === undefined) return null
  const acceptedValue = accepted.value
  const current = draft ?? resolveBackgroundLayout(acceptedValue)
  const region: AppearanceRegion = current.mode === 'unified' ? 'unified' : selected
  const background = current[region]
  const busy = choosing || state.saving || accepted.status !== 'ready' || !accepted.writable
  const problem = invalid ?? state.problem
  const update = (patch: Partial<BackgroundSettings>): void => {
    setDraft(previous => ({ ...(previous ?? current), [region]: { ...(previous ?? current)[region], ...patch } }))
    setInvalid(undefined)
  }
  const browse = async (path: string | undefined): Promise<void> => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setChoosing(true)
    try {
      const listing = await listFolders(path, controller.signal)
      if (alive.current && !controller.signal.aborted) setFolders(listing)
    } catch (_error) {
      // A rejected scan keeps the previous level and the typed path available.
      if (alive.current && !controller.signal.aborted) setInvalid('folder')
    } finally { if (alive.current && !controller.signal.aborted) setChoosing(false) }
  }
  return <section className={css.editor} aria-label={t('appearance.title')}>
    <div className={css.title}>{t('appearance.title')}</div>
    <div className={css.description}>{t('appearance.help')}</div>
    <div className={css.modes}>
      <SegmentedControl id={`${id}-mode`} label={t('appearance.mode')} value={current.mode} disabled={busy}
        options={[{ value: 'separate', label: t('appearance.separate') }, { value: 'unified', label: t('appearance.unified') }]}
        onChange={(mode) => { setDraft({ ...current, mode }); setFolders(undefined) }} />
    </div>
    <div id={`${id}-mode-${current.mode}-panel`}>
      {current.mode === 'separate' && <div className={css.modes}>
        <SegmentedControl id={`${id}-region`} label={t('appearance.region')} value={selected} disabled={busy}
          options={[{ value: 'sidebar', label: t('appearance.sidebar') }, { value: 'chat', label: t('appearance.chat') }]}
          onChange={(value) => { setSelected(value); setFolders(undefined) }} />
      </div>}
      <div id={`${id}-region-${selected}-panel`}>
        <BackgroundPreview region={region} background={background} previewFolder={previewFolder}
          label={t('appearance.preview')} failureLabel={t('appearance.folder')} emptyLabel={t('appearance.empty')} />
        <fieldset className={css.fields} disabled={busy}>
          <SegmentedControl id={`${id}-source`} label={t('appearance.source')} value={background.source} disabled={busy}
            options={[{ value: 'gallery', label: t('appearance.gallery') }, { value: 'image', label: t('appearance.fixed') },
              { value: 'none', label: t('appearance.none') }]} onChange={(source) => { update({ source }); setFolders(undefined) }} />
          <div id={`${id}-source-${background.source}-panel`}>
            {background.source === 'image' && <div className={css.actions}>
              <Button size="sm" variant="outline" onClick={() => { file.current?.click() }}>{t('appearance.chooseImage')}</Button>
              <input ref={file} className={css.file} type="file" accept="image/png,image/jpeg,image/webp" aria-label={t('appearance.chooseImage')}
                onChange={(event) => {
                  const picked = event.currentTarget.files?.[0]
                  event.currentTarget.value = ''
                  if (picked === undefined) return
                  setChoosing(true)
                  void normalizeBackgroundImage(picked).then((value) => {
                    if (alive.current) update({ image: value })
                  }, () => { if (alive.current) setInvalid('imageError') }).finally(() => { if (alive.current) setChoosing(false) })
                }} />
            </div>}
            {background.source === 'gallery' && <>
              <label className={css.label} htmlFor={`${id}-folder`}>{t('appearance.folderLabel')}</label>
              <div className={css.folderRow}>
                <Input id={`${id}-folder`} value={background.folder} autoComplete="off" placeholder={t('appearance.builtin')}
                  onChange={(event) => { update({ folder: event.target.value }) }} />
                <Button size="sm" variant="outline" onClick={() => {
                  setChoosing(true)
                  void pickFolder().then(async (result) => {
                    if (!alive.current) return
                    if (result.kind === 'browse') await browse(background.folder || undefined)
                    else if (result.path !== null) update({ folder: result.path })
                  }, () => { if (alive.current) setInvalid('folder') }).finally(() => { if (alive.current) setChoosing(false) })
                }}>{t('appearance.chooseFolder')}</Button>
              </div>
              {folders !== undefined && <div className={css.folders} role="region" aria-label={t('appearance.chooseFolder')}>
                <div className={css.crumbs}>{folders.crumbs.map(crumb => <Button key={crumb.path} size="sm" variant="ghost"
                  onClick={() => { void browse(crumb.path) }}>{crumb.name}</Button>)}</div>
                <div className={css.directoryList}>{folders.entries.filter(entry => !entry.hidden).map(entry => <Button key={entry.path}
                  size="sm" variant="ghost" onClick={() => { void browse(entry.path) }}>{entry.name}</Button>)}</div>
                {folders.truncated && <p className={css.description}>{t('appearance.truncated')}</p>}
                <div className={css.actions}>
                  <Button size="sm" variant="primary" onClick={() => { update({ folder: folders.path }); setFolders(undefined) }}>{t('appearance.useFolder')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setFolders(undefined) }}>{t('appearance.cancel')}</Button>
                </div>
              </div>}
              <div className={css.range}>
                <label className={css.label} htmlFor={`${id}-min`}>{t('appearance.minimum')}
                  <Input id={`${id}-min`} type="number" min={1 / 12} max={1440} step="any" value={background.minimumSeconds / 60}
                    onChange={(event) => { update({ minimumSeconds: Number(event.target.value) * 60 }) }} />
                </label>
                <label className={css.label} htmlFor={`${id}-max`}>{t('appearance.maximum')}
                  <Input id={`${id}-max`} type="number" min={1 / 12} max={1440} step="any" value={background.maximumSeconds / 60}
                    onChange={(event) => { update({ maximumSeconds: Number(event.target.value) * 60 }) }} />
                </label>
              </div>
            </>}
          </div>
          {background.source !== 'none' && <>
            <div className={css.modes}><SegmentedControl id={`${id}-fit`} label={t('appearance.fit')} value={background.fit} disabled={busy}
              options={[{ value: 'contain', label: t('appearance.contain') }, { value: 'cover', label: t('appearance.cover') }]}
              onChange={(fit) => { update({ fit }) }} /></div>
            {(['zoom', 'x', 'y', 'opacity'] as const).map(field => <label key={field} className={css.label} htmlFor={`${id}-${field}`}>
              {t(`appearance.${field}`)}
              <div className={css.slider}>
                <input id={`${id}-${field}`} type="range" min={field === 'zoom' ? 25 : 0} max={field === 'zoom' ? 300 : 100}
                  aria-label={t(`appearance.${field}`)}
                  value={background[field]} onChange={(event) => { update({ [field]: Number(event.target.value) }) }} />
                <output className={css.value} htmlFor={`${id}-${field}`}>{background[field]}%</output>
              </div>
            </label>)}
          </>}
        </fieldset>
      </div>
    </div>
    <div className={css.actions}>
      <Button size="sm" variant="primary" disabled={busy || draft === undefined} onClick={() => {
        if (Object.values({ chat: current.chat, sidebar: current.sidebar, unified: current.unified }).some(value =>
          !Number.isInteger(value.minimumSeconds) || !Number.isInteger(value.maximumSeconds)
          || value.minimumSeconds < 5 || value.maximumSeconds > 86400 || value.minimumSeconds > value.maximumSeconds)) {
          setInvalid('range')
          return
        }
        if ([current.chat, current.sidebar, current.unified].some(value => value.source === 'image' && value.image === '')) {
          setInvalid('imageError')
          return
        }
        void save({ ...acceptedValue, backgroundLayout: current })
          .then((saved) => { if (alive.current && saved) setDraft(undefined) })
      }}>{t('appearance.save')}</Button>
      <Button size="sm" variant="ghost" disabled={busy || draft === undefined} onClick={() => { setDraft(undefined); setInvalid(undefined) }}>{t('appearance.cancel')}</Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => { void shuffle() }}>{t('appearance.next')}</Button>
      <Button size="sm" variant="ghost" disabled={busy || state.count === 0} onClick={togglePaused}>
        {t(state.paused ? 'appearance.resume' : 'appearance.pause')}
      </Button>
    </div>
    {problem !== undefined && <div className={css.error} role="alert">
      {t(`appearance.${problem}`)}
    </div>}
  </section>
}

/** Toast state outlives the settings dialog. */
export interface AppearanceToastInjected {
  hooks: { appearanceState: AppearanceSource['store'] }
  dismiss: AppearanceSource['dismiss']
}

/** @param props - Latest shared save result. @returns Application-wide save feedback. */
export function AppearanceToast({ useAppearanceState, dismiss, t }:
  PropsRuntime<'shell.overlay'> & PropsLocale<'settings'> & InjectFace<AppearanceToastInjected>) {
  const notice = useAppearanceState(value => value.notice)
  return notice === undefined ? null : <Toast key={notice.sequence} text={t(`appearance.${notice.kind}`)}
    onDone={() => { dismiss(notice.sequence) }} />
}
