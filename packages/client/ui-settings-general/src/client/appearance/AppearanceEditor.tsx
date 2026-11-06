/** Folder and rotation controls inside the existing General settings surface. */
import { useEffect, useId, useRef, useState } from 'react'
import { Button, Input, Toast } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { AppearanceSource } from './source.ts'
import css from './Appearance.module.css'

/** Shared accepted preferences, image state, and user operations. */
export interface AppearanceEditorInjected {
  hooks: { appearance: AppearanceSource['form']; appearanceState: AppearanceSource['store'] }
  save: AppearanceSource['save']
  shuffle: AppearanceSource['shuffle']
  togglePaused: AppearanceSource['togglePaused']
}

/** @param props - Existing Host form and regional image controller. @returns Brand-only picture preferences. */
export function AppearanceEditor({ useAppearance, useAppearanceState, save, shuffle, togglePaused, t }:
  PropsRuntime<'settings.general.item'> & PropsLocale<'settings'> & InjectFace<AppearanceEditorInjected>) {
  const accepted = useAppearance(value => value)
  const state = useAppearanceState(value => value)
  const [draft, setDraft] = useState<{ folder: string; minimum: string; maximum: string }>()
  const [invalid, setInvalid] = useState(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const id = useId()
  if (accepted.value === undefined) return null
  const current = draft ?? { folder: accepted.value.backgroundFolder,
    minimum: String(accepted.value.backgroundMinSeconds / 60), maximum: String(accepted.value.backgroundMaxSeconds / 60) }
  const busy = state.saving || accepted.status !== 'ready' || !accepted.writable
  const problem = invalid ? 'range' : state.problem
  return <section className={css.editor} aria-label={t('appearance.title')}>
    <div className={css.title}>{t('appearance.title')}</div>
    <div className={css.description}>{t('appearance.help')}</div>
    <label className={css.label} htmlFor={`${id}-folder`}>{t('appearance.folderLabel')}</label>
    <Input id={`${id}-folder`} value={current.folder} disabled={busy} autoComplete="off"
      onChange={(event) => { setDraft({ ...current, folder: event.target.value }); setInvalid(false) }} />
    <div className={css.range}>
      <label className={css.label} htmlFor={`${id}-min`}>{t('appearance.minimum')}
        <Input id={`${id}-min`} type="number" min={1} max={1440} value={current.minimum} disabled={busy}
          onChange={(event) => { setDraft({ ...current, minimum: event.target.value }); setInvalid(false) }} />
      </label>
      <label className={css.label} htmlFor={`${id}-max`}>{t('appearance.maximum')}
        <Input id={`${id}-max`} type="number" min={1} max={1440} value={current.maximum} disabled={busy}
          onChange={(event) => { setDraft({ ...current, maximum: event.target.value }); setInvalid(false) }} />
      </label>
    </div>
    <div className={css.actions}>
      <Button size="sm" variant="primary" disabled={busy || draft === undefined} onClick={() => {
        const minimum = Number(current.minimum)
        const maximum = Number(current.maximum)
        if (!Number.isInteger(minimum) || !Number.isInteger(maximum) || minimum < 1 || maximum > 1440 || minimum > maximum) {
          setInvalid(true)
          return
        }
        void save({ backgroundFolder: current.folder, backgroundMinSeconds: minimum * 60, backgroundMaxSeconds: maximum * 60 })
          .then((saved) => { if (alive.current && saved) setDraft(undefined) })
      }}>{t('appearance.save')}</Button>
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
