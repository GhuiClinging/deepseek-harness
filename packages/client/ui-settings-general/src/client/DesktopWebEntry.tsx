/** Current desktop-owned Host address and browser launch feedback. */
import { IconRightUpOutlineRegular, Toast, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { DesktopWebSource } from './desktop-web-source.ts'
import css from './DesktopWebEntry.module.css'

/** Plain action and the framework-bound shared browser state. */
export interface DesktopWebEntryInjected {
  hooks: { web: DesktopWebSource['store'] }
  open(): Promise<void>
}

/**
 * Show a compact browser action while Electron owns its authenticated destination.
 * @param props - Host status, user action and localized copy.
 * @returns Desktop-only browser launcher.
 */
export function DesktopWebEntry({ useWeb, open, t }:
  PropsRuntime<'conversation.header.actions'> & PropsLocale<'settings'> & InjectFace<DesktopWebEntryInjected>) {
  const state = useWeb(value => value)
  const ready = state.host?.phase === 'ready'
  const description = ready ? t('desktop.web.open') : t(state.failed ? 'desktop.web.failed' : state.host?.phase === 'unavailable'
    ? 'desktop.web.unavailable' : 'desktop.web.starting')
  return <Tooltip label={description} side="bottom" portal>
    <button className={css.entry} type="button" aria-label={t('desktop.web.open')}
      disabled={!ready || state.opening} aria-busy={state.opening} onClick={() => { void open() }}>
      <IconRightUpOutlineRegular size={16} />
    </button>
  </Tooltip>
}

/** Framework-bound feedback kept outside the sidebar lifetime. */
export interface DesktopWebToastInjected {
  hooks: { web: DesktopWebSource['store'] }
  dismiss(sequence: number): void
}

/** @param props - latest launch outcome and localized copy. @returns Transient browser failure feedback. */
export function DesktopWebToast({ useWeb, dismiss, t }:
  PropsRuntime<'shell.overlay'> & PropsLocale<'settings'> & InjectFace<DesktopWebToastInjected>) {
  const notice = useWeb(value => value.notice)
  return notice === undefined ? null : <Toast key={notice.sequence} text={t(`desktop.web.${notice.kind}`)}
    onDone={() => { dismiss(notice.sequence) }} />
}
