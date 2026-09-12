import {
  getOneTimePasteEnabledFromStore,
  setOneTimePasteEnabledToStore,
} from '@shared/api/settings'

const ONE_TIME_PASTE_EVENT = 'one-time-paste-changed'

let oneTimePasteEnabled = false
let initPromise = null

function emitOneTimePasteChanged(enabled) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ONE_TIME_PASTE_EVENT, {
      detail: { enabled }
    }))
  }
}

export async function initOneTimePasteEnabled() {
  if (!initPromise) {
    initPromise = getOneTimePasteEnabledFromStore()
      .then((enabled) => {
        oneTimePasteEnabled = enabled === true
        return oneTimePasteEnabled
      })
      .catch((error) => {
        console.error('读取一次性粘贴状态失败:', error)
        oneTimePasteEnabled = false
        return false
      })
  }

  return initPromise
}

export function getOneTimePasteEnabled() {
  return oneTimePasteEnabled
}

export async function setOneTimePasteEnabled(enabled) {
  const nextValue = Boolean(enabled)

  try {
    oneTimePasteEnabled = await setOneTimePasteEnabledToStore(nextValue)
  } catch (error) {
    console.error('保存一次性粘贴状态失败:', error)
    throw error
  }

  emitOneTimePasteChanged(oneTimePasteEnabled)
  return oneTimePasteEnabled
}

export async function toggleOneTimePasteEnabled() {
  return await setOneTimePasteEnabled(!getOneTimePasteEnabled())
}

export function getOneTimePasteEventName() {
  return ONE_TIME_PASTE_EVENT
}
