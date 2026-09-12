import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

// 检测快捷键内部重复

export function useShortcutDuplicateCheck(settings) {
  const { t } = useTranslation()
  
  const duplicates = useMemo(() => {
    const shortcutMap = new Map() 
    const duplicateMap = new Map() 

    Object.keys(settings).forEach(key => {
      if (!key.endsWith('Shortcut')) return
      
      const value = settings[key]
      
      if (!value || value.trim() === '') return
      
      if (!shortcutMap.has(value)) {
        shortcutMap.set(value, [])
      }
      shortcutMap.get(value).push(key)
    })
    
    shortcutMap.forEach((keys) => {
      if (keys.length > 1) {
        keys.forEach(key => {
          const otherKeys = keys.filter(k => k !== key).length
          duplicateMap.set(key, { count: otherKeys })
        })
      }
    })
    
    return duplicateMap
  }, [settings])

  const getDuplicateError = (key) => {
    const duplicate = duplicates.get(key)
    if (!duplicate) return null
    return t('settings.shortcuts.duplicateError', { count: duplicate.count })
  }

  const hasDuplicate = (key) => {
    return duplicates.has(key)
  }

  return {
    getDuplicateError,
    hasDuplicate
  }
}

