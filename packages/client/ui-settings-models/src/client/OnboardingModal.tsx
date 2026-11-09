/** Shared modal chrome for every step registered by this onboarding plugin. */

import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Button, IconCloseOutlineRegular, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './OnboardingModal.module.css'

const ignoreImplicitDismiss = (): void => {}

/**
 * Render a blocking onboarding dialog and keep the application root inert.
 * @param props.title - accessible and visible dialog title.
 * @param props.focusTitle - focus the title when the step has no form control.
 * @param props.closeLabel - localized accessible name for the optional close control.
 * @param props.onClose - explicit close action; omitted steps keep the modal blocking.
 * @param props.children - step-owned body and actions.
 * @returns the body-portaled modal.
 */
export function OnboardingModal({
  title, focusTitle = false, closeLabel, onClose, children,
}: {
  title: string
  focusTitle?: boolean
  closeLabel?: string
  onClose?: () => void
  children: ReactNode
}): ReactNode {
  const titleRef = useRef<HTMLHeadingElement | null>(null)

  useEffect(() => {
    const appRoot = document.getElementById('root')
    if (appRoot === null) return
    const previous = appRoot.inert
    appRoot.inert = true
    return () => { appRoot.inert = previous }
  }, [])

  useEffect(() => {
    if (focusTitle) titleRef.current?.focus()
  }, [focusTitle])

  return (
    <Modal
      open
      title={title}
      onClose={ignoreImplicitDismiss}
      headless
      className={css.dialog as string}
    >
      <div className={css.content}>
        <div className={css.titleRow}>
          <h2 ref={titleRef} className={css.title} tabIndex={focusTitle ? -1 : undefined}>{title}</h2>
          {onClose === undefined || closeLabel === undefined ? null : <Button
            variant="ghost"
            className={css.close}
            aria-label={closeLabel}
            onClick={onClose}
          >
            <IconCloseOutlineRegular size={18} />
          </Button>}
        </div>
        <div className={css.body}>{children}</div>
      </div>
    </Modal>
  )
}
