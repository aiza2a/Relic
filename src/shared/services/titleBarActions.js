import { setWindowPinned, openSettingsWindow } from '@shared/api'

let pinnedState = false

function emitPinStateChanged(state) {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent('window-pin-state-changed', {
    detail: { pinned: state }
  }))
}

export function getWindowPinState() {
  return pinnedState
}

export async function toggleWindowPin() {
  const nextState = !pinnedState
  await setWindowPinned(nextState)
  pinnedState = nextState
  emitPinStateChanged(nextState)
  return nextState
}

export async function openAppSettings() {
  await openSettingsWindow()
}
