import { useEffect, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import { hideMainWindow } from '@shared/api'

// 全局键盘导航Hook
export function useNavigationKeyboard({
  onNavigateUp = null,
  onNavigateDown = null,
  onExecuteItem = null,
  onTabLeft = null,
  onTabRight = null,
  onToggleSearch = null,
  onTogglePin = null,
  onPreviousGroup = null,
  onNextGroup = null,
  enabled = true
}) {
  const handlersRef = useRef({
    onNavigateUp,
    onNavigateDown,
    onExecuteItem,
    onTabLeft,
    onTabRight,
    onToggleSearch,
    onTogglePin,
    onPreviousGroup,
    onNextGroup
  })

  useEffect(() => {
    handlersRef.current = {
      onNavigateUp,
      onNavigateDown,
      onExecuteItem,
      onTabLeft,
      onTabRight,
      onToggleSearch,
      onTogglePin,
      onPreviousGroup,
      onNextGroup
    }
  }, [
    onNavigateUp,
    onNavigateDown,
    onExecuteItem,
    onTabLeft,
    onTabRight,
    onToggleSearch,
    onTogglePin,
    onPreviousGroup,
    onNextGroup
  ])

  useEffect(() => {
    if (!enabled) return
    
    let unlistenNavigationAction = null
    let cancelled = false
    
    const setupNavigationListener = async () => {
      try {
        const unlisten = await listen('navigation-action', (event) => {
          const action = event.payload.action
          const handlers = handlersRef.current
          
          switch (action) {
            case 'navigate-up':
              if (handlers.onNavigateUp) handlers.onNavigateUp()
              break
            case 'navigate-down':
              if (handlers.onNavigateDown) handlers.onNavigateDown()
              break
            case 'execute-item':
              if (handlers.onExecuteItem) handlers.onExecuteItem()
              break
            case 'tab-left':
              if (handlers.onTabLeft) handlers.onTabLeft()
              break
            case 'tab-right':
              if (handlers.onTabRight) handlers.onTabRight()
              break
            case 'focus-search':
              if (handlers.onToggleSearch) handlers.onToggleSearch()
              break
            case 'hide-window':
              hideMainWindow().catch(err => {
                console.error('隐藏窗口失败:', err)
              })
              break
            case 'toggle-pin':
              if (handlers.onTogglePin) {
                handlers.onTogglePin()
              }
              break
            case 'previous-group':
              if (handlers.onPreviousGroup) handlers.onPreviousGroup()
              break
            case 'next-group':
              if (handlers.onNextGroup) handlers.onNextGroup()
              break
            default:
              break
          }
        })

        if (cancelled) {
          unlisten()
          return
        }

        unlistenNavigationAction = unlisten
      } catch (error) {
        console.error('设置导航监听器失败:', error)
      }
    }
    
    setupNavigationListener()
    
    return () => {
      cancelled = true
      if (unlistenNavigationAction) {
        unlistenNavigationAction()
        unlistenNavigationAction = null
      }
    }
  }, [enabled])
}
