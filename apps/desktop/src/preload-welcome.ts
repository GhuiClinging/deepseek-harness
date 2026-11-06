import type { AccountView, SignInAttemptId } from '@deepseek-ai/dsh-deepseek-account/types'
/** Localized welcome copy and write-only credential actions. */

import { contextBridge, ipcRenderer } from 'electron'
import { resolveDesktopLocale } from './locale.ts'
import { WELCOME_IPC, type WelcomeApi, type WelcomeNotice, type WelcomeSaveResult } from './welcome-api.ts'

const prefix = '--dsh-welcome-locale='
const locale = process.argv.find(argument => argument.startsWith(prefix))?.slice(prefix.length)
if (locale === undefined) throw new Error('desktop welcome: missing window locale')
const brandArgument = (field: string): string | undefined => {
  const argument = `--dsh-welcome-brand-${field}=`
  const value = process.argv.find(item => item.startsWith(argument))?.slice(argument.length)
  return value === undefined ? undefined : decodeURIComponent(value)
}
const name = brandArgument('name')
const wordmark = brandArgument('wordmark')
const mark = brandArgument('mark')
const greeting = brandArgument('greeting')
if (name !== undefined && (wordmark === undefined || mark === undefined || greeting === undefined)) {
  throw new Error('desktop welcome: incomplete brand presentation')
}
const api: WelcomeApi = {
  authenticationMode: process.argv.includes('--dsh-welcome-authentication=api-key') ? 'api-key' : 'account',
  ...resolveDesktopLocale(locale, name),
  ...(name === undefined || wordmark === undefined || mark === undefined || greeting === undefined ? {}
    : { presentation: Object.freeze({ name, wordmark, mark, greeting }) }),
  analytics: async (eventName, attributes) => {
    if (await api.analyticsEnabled()) await ipcRenderer.invoke(WELCOME_IPC.analytics, eventName, attributes)
  },
  analyticsEnabled: () => ipcRenderer.invoke(WELCOME_IPC.analyticsEnabled) as Promise<boolean>,
  takeNotice: () => ipcRenderer.invoke(WELCOME_IPC.takeNotice) as Promise<WelcomeNotice | undefined>,
  startSignIn: () => ipcRenderer.invoke(WELCOME_IPC.start) as Promise<AccountView>,
  cancelSignIn: (id: SignInAttemptId) => ipcRenderer.invoke(WELCOME_IPC.cancel, id) as Promise<AccountView>,
  copySignInLink: (id: SignInAttemptId) => ipcRenderer.invoke(WELCOME_IPC.copyLink, id) as Promise<void>,
  onAccountState: (listener) => {
    const receive = (_event: Electron.IpcRendererEvent, state: AccountView): void =>{  listener(state) }
    ipcRenderer.on(WELCOME_IPC.state, receive)
    return () => { ipcRenderer.removeListener(WELCOME_IPC.state, receive) }
  },
  saveApiKey: (value: string) => ipcRenderer.invoke(WELCOME_IPC.saveApiKey, value) as Promise<WelcomeSaveResult>,
  skip: () => ipcRenderer.invoke(WELCOME_IPC.skip) as Promise<void>,
}
contextBridge.exposeInMainWorld('dshWelcome', api)
