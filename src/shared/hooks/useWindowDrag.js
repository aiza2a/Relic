import { useEffect, useRef } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { restoreLastFocus, startCustomDrag } from '@shared/api'

// 自定义窗口拖拽 Hook
export function useWindowDrag(options = {}) {
  const { excludeSelectors = [], allowChildren = false } = options
  const elementRef = useRef(null)
  const isDraggingRef = useRef(false)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const unlistenPromise = getCurrentWindow().listen('drag-ended', () => {
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      isDraggingRef.current = false
    })

    const handleMouseDown = async (e) => {
      if (!allowChildren && e.target !== element) {
        return
      }

      for (const selector of excludeSelectors) {
        if (e.target.closest(selector)) {
          return
        }
      }

      if (e.buttons !== 1) {
        return
      }

      try {
        await restoreLastFocus()
      } catch (error) {
        console.error('恢复焦点窗口失败:', error)
      }

      startDrag(e)
    }

    const startDrag = async (initialEvent) => {
      if (isDraggingRef.current) return
      isDraggingRef.current = true

      try {
        document.body.style.userSelect = 'none'
        document.body.style.cursor = 'move'

        await startCustomDrag(initialEvent.screenX, initialEvent.screenY)

        initialEvent.preventDefault()
      } catch (error) {
        console.error('启动拖拽失败:', error)
        isDraggingRef.current = false
        document.body.style.userSelect = ''
        document.body.style.cursor = ''
      }
    }

    element.addEventListener('mousedown', handleMouseDown)

    return () => {
      element.removeEventListener('mousedown', handleMouseDown)
      unlistenPromise.then(unlisten => unlisten())
    }
  }, [excludeSelectors, allowChildren])

  return elementRef
}

