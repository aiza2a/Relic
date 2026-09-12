import { useEffect, useRef } from 'react'
import { focusClipboardWindow, restoreLastFocus } from '@shared/api'

// 全局焦点状态
let currentFocusState = 'normal'
let focusDebounceTimer = null
let blurDebounceTimer = null
const FOCUS_DEBOUNCE_DELAY = 50

// 重置状态
if (typeof window !== 'undefined') {
  window.addEventListener('blur', () => {
    currentFocusState = 'normal'
  })
}

// 防抖的焦点启用函数
async function debouncedEnableFocus() {
  if (blurDebounceTimer) {
    clearTimeout(blurDebounceTimer)
    blurDebounceTimer = null
  }

  if (currentFocusState === 'focused') {
    return
  }

  if (focusDebounceTimer) {
    clearTimeout(focusDebounceTimer)
  }
  
  focusDebounceTimer = setTimeout(async () => {
    try {
      await focusClipboardWindow()
      currentFocusState = 'focused'
    } catch (error) {
      console.error('启用窗口焦点失败:', error)
    }
    focusDebounceTimer = null
  }, FOCUS_DEBOUNCE_DELAY)
}

// 防抖的焦点恢复函数
async function debouncedRestoreFocus() {
  if (focusDebounceTimer) {
    clearTimeout(focusDebounceTimer)
    focusDebounceTimer = null
  }
  
  // 如果已经是normal状态，不需要重复调用
  if (currentFocusState === 'normal') {
    return
  }

  if (blurDebounceTimer) {
    clearTimeout(blurDebounceTimer)
  }
  
  blurDebounceTimer = setTimeout(async () => {
    const activeElement = document.activeElement
    const isInputFocused = activeElement && (
      activeElement.tagName === 'INPUT' || 
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.contentEditable === 'true'
    )
    
    // 如果有其他输入框获得焦点，不恢复
    if (isInputFocused) {
      return
    }
    
    try {
      await restoreLastFocus()
      currentFocusState = 'normal'
    } catch (error) {
      console.error('恢复工具窗口模式失败:', error)
    }
    blurDebounceTimer = null
  }, FOCUS_DEBOUNCE_DELAY)
}

// 当输入框获得焦点时启用窗口焦点，失去焦点时恢复工具窗口模式
export function useInputFocus() {
  const inputRef = useRef(null)

  useEffect(() => {
    const element = inputRef.current
    if (!element) return

    const handleFocus = () => {
      debouncedEnableFocus()
    }

    const handleBlur = () => {
      debouncedRestoreFocus()
    }

    element.addEventListener('focus', handleFocus)
    element.addEventListener('blur', handleBlur)
    const checkInitialFocus = setTimeout(() => {
      if (document.activeElement === element) {
        debouncedEnableFocus()
      }
    }, 0)

    return () => {
      element.removeEventListener('focus', handleFocus)
      element.removeEventListener('blur', handleBlur)
      clearTimeout(checkInitialFocus)
    }
  }, [])

  return inputRef
}

// 立即启用窗口焦点（跳过防抖）
export async function focusWindowImmediately() {
  if (blurDebounceTimer) {
    clearTimeout(blurDebounceTimer)
    blurDebounceTimer = null
  }
  if (focusDebounceTimer) {
    clearTimeout(focusDebounceTimer)
    focusDebounceTimer = null
  }
  
  try {
    await focusClipboardWindow()
    currentFocusState = 'focused'
  } catch (error) {
    console.error('立即启用窗口焦点失败:', error)
  }
}

// 恢复工具窗口模式
export async function restoreFocus() {
  try {
    await restoreLastFocus()
    currentFocusState = 'normal'
  } catch (error) {
    console.error('恢复焦点失败:', error)
  }
}

