/** Local display identity and its editor; no remote account or authentication claims. */
import { useEffect, useId, useRef, useState } from 'react'
import { Button, Input, IconUserOutlineMedium, Toast } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { LocalProfileSource } from './local-profile-source.ts'
import type { LocalProfile } from '../types.ts'
import { normalizeLocalAvatar } from './local-avatar.ts'
import css from './LocalProfile.module.css'

/** Profile observation supplied by the existing shared settings form. */
export interface LocalProfileInjected {
  hooks: { profile: LocalProfileSource['form'] }
}

/** Atomic save action and its shared status. */
export interface LocalProfileEditorInjected extends LocalProfileInjected {
  hooks: LocalProfileInjected['hooks'] & { profileSave: LocalProfileSource['store'] }
  save(value: LocalProfile): Promise<boolean>
}

function Avatar({ url, size = 24 }: { url: string; size?: number }) {
  const [failed, setFailed] = useState<string>()
  return <span className={css.avatar} style={{ width: size, height: size }} aria-hidden="true">
    {url !== '' && failed !== url
      ? <img src={url} alt="" onError={() => { setFailed(url) }} />
      : <IconUserOutlineMedium size={Math.min(size, 20)} />}
  </span>
}

/** @param props - local profile and sidebar width. @returns Identity content inside the existing Settings launcher. */
export function LocalProfileTrigger({ wide, useProfile, t }:
  PropsRuntime<'settings.trigger'> & PropsLocale<'settings'> & InjectFace<LocalProfileInjected>) {
  const profile = useProfile(value => value.value)
  return <>
    <Avatar url={profile?.localAvatar ?? ''} size={wide ? 24 : 20} />
    {wide && <span className={css.nickname}>{profile?.localNickname || t('profile.fallback')}</span>}
  </>
}

/**
 * Edit the local display identity while retaining the last accepted Host values.
 * @param props - shared profile, atomic save action and localized copy.
 * @returns Local profile controls in General settings.
 */
export function LocalProfileEditor({ useProfile, useProfileSave, save, t }:
  PropsRuntime<'settings.general.item'> & PropsLocale<'settings'> & InjectFace<LocalProfileEditorInjected>) {
  const accepted = useProfile(value => value)
  const saving = useProfileSave(value => value.saving)
  const [draft, setDraft] = useState<LocalProfile>()
  const [choosing, setChoosing] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const inputId = useId()
  const value = draft ?? accepted.value ?? { localNickname: '', localAvatar: '' }
  const busy = saving || choosing || accepted.status !== 'ready' || !accepted.writable
  return <section className={css.editor} aria-label={t('profile.title')}>
    <div className={css.title}>{t('profile.title')}</div>
    <div className={css.description}>{t('profile.description')}</div>
    <div className={css.pictureRow}>
      <Avatar url={value.localAvatar} size={48} />
      <Button size="sm" variant="outline" disabled={busy} onClick={() => { file.current?.click() }}>{t('profile.chooseAvatar')}</Button>
      {value.localAvatar !== '' && <Button size="sm" variant="ghost" disabled={busy}
        onClick={() => { setDraft({ ...value, localAvatar: '' }); setImageFailed(false) }}>{t('profile.removeAvatar')}</Button>}
      <input ref={file} className={css.file} type="file" accept="image/png,image/jpeg,image/webp" aria-label={t('profile.chooseAvatar')}
        disabled={busy} onChange={(event) => {
          const selected = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (selected === undefined) return
          setChoosing(true)
          setImageFailed(false)
          void normalizeLocalAvatar(selected).then((localAvatar) => {
            if (mounted.current) setDraft(previous => ({ ...(previous ?? value), localAvatar }))
          }, () => { if (mounted.current) setImageFailed(true) }).finally(() => { if (mounted.current) setChoosing(false) })
        }} />
    </div>
    {imageFailed && <div className={css.error} role="alert">{t('profile.imageError')}</div>}
    <label className={css.label} htmlFor={inputId}>{t('profile.nickname')}</label>
    <div className={css.controls}>
      <Input id={inputId} value={value.localNickname} maxLength={64} disabled={busy} autoComplete="off"
        placeholder={t('profile.fallback')} onChange={(event) => { setDraft({ ...value, localNickname: event.target.value }); setSaveFailed(false) }} />
      <Button variant="primary" size="sm" disabled={busy || draft === undefined} onClick={() => {
        setSaveFailed(false)
        void save(value).then((saved) => {
          if (!mounted.current) return
          if (saved) setDraft(undefined)
          else setSaveFailed(true)
        })
      }}>{t('profile.save')}</Button>
    </div>
    {saveFailed && <div className={css.error} role="alert">{t('profile.failed')}</div>}
  </section>
}

/** Shared save feedback remains mounted after Settings closes. */
export interface LocalProfileToastInjected {
  hooks: { profileSave: LocalProfileSource['store'] }
  dismiss(sequence: number): void
}

/** @param props - operation status and localized copy. @returns Local profile save outcome. */
export function LocalProfileToast({ useProfileSave, dismiss, t }:
  PropsRuntime<'shell.overlay'> & PropsLocale<'settings'> & InjectFace<LocalProfileToastInjected>) {
  const notice = useProfileSave(value => value.notice)
  return notice === undefined ? null : <Toast key={notice.sequence} text={t(`profile.${notice.kind}`)}
    {...notice.kind === 'saved' ? { tone: 'success' as const } : {}} onDone={() => { dismiss(notice.sequence) }} />
}
