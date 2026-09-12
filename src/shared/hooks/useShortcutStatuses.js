import { useState, useEffect } from 'react'
import { getShortcutStatuses } from '@shared/api/settings'
import { listen } from '@tauri-apps/api/event'
import { useTranslation } from 'react-i18next'

// 快捷键状态管理 Hook
export function useShortcutStatuses() {
  const { t } = useTranslation()
  const [statuses, setStatuses] = useState({})
  const [loading, setLoading] = useState(true)

  const loadStatuses = async () => {
    try {
      const statusList = await getShortcutStatuses()
      const statusMap = {}
      statusList.forEach(status => {
        statusMap[status.id] = status
      })
      setStatuses(statusMap)
    } catch (error) {
      console.error('获取快捷键状态失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatuses()

    const unlisten = listen('settings-changed', () => {
      setTimeout(() => {
        loadStatuses()
      }, 100)
    })

    return () => {
      unlisten.then(fn => fn())
    }
  }, [])

  // 获取单个快捷键状态
  const getStatus = (id) => {
    return statuses[id] || null
  }

  // 检查快捷键是否失败
  const hasError = (id) => {
    const status = statuses[id]
    return status && !status.success
  }

  const getError = (id) => {
    const status = statuses[id]
    if (!status || !status.error) return null
    
    if (status.error === 'CONFLICT') {
      return t('settings.shortcuts.conflictError')
    } else if (status.error === 'REGISTRATION_FAILED') {
      return t('settings.shortcuts.registrationError')
    }
    
    return status.error
  }

  return {
    statuses,
    loading,
    getStatus,
    hasError,
    getError,
    reload: loadStatuses
  }
}

