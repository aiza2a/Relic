import { useEffect } from 'react'
import { useSnapshot } from 'valtio'
import { settingsStore } from '@shared/store/settingsStore'
import backgroundThemeCss from '../styles/theme-background.css?inline'
import { useCustomFont } from './useCustomFont'

// 系统主题媒体查询
let systemThemeMediaQuery = null
if (typeof window !== 'undefined' && window.matchMedia) {
  systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  
  // 监听系统主题变化
  systemThemeMediaQuery.addEventListener('change', (e) => {
    settingsStore.systemIsDark = e.matches
  })
}

// 获取实际应用的主题
export function getEffectiveTheme(theme, systemIsDark = settingsStore.systemIsDark) {
  if (theme === 'auto') {
    return systemIsDark ? 'dark' : 'light'
  }
  return theme
}

let backgroundThemeStyleElement = null

function syncSuperBackgroundBlurScale(scale, enabled) {
  if (typeof document === 'undefined') return

  const body = document.body
  if (!body) return

  if (enabled) {
    const resolvedScale = Number(scale)
    const safeScale = Number.isFinite(resolvedScale) && resolvedScale >= 0 ? resolvedScale : 1
    body.style.setProperty('--theme-superbg-blur-scale', String(safeScale))
  } else {
    body.style.removeProperty('--theme-superbg-blur-scale')
  }
}

function loadBackgroundThemeCSS() {
  if (backgroundThemeStyleElement) return

  backgroundThemeStyleElement = document.createElement('style')
  backgroundThemeStyleElement.id = 'background-theme'
  backgroundThemeStyleElement.textContent = backgroundThemeCss
  document.head.appendChild(backgroundThemeStyleElement)
}

function unloadBackgroundThemeCSS() {
  if (backgroundThemeStyleElement) {
    document.head.removeChild(backgroundThemeStyleElement)
    backgroundThemeStyleElement = null
  }
}

export function useTheme() {
  const { theme, lightThemeStyle, darkThemeStyle, backgroundImagePath, superBackgroundBlurScale, systemIsDark } = useSnapshot(settingsStore)

  // 背景主题 CSS 注入
  useEffect(() => {
    if (theme === 'background') {
      loadBackgroundThemeCSS()
      syncSuperBackgroundBlurScale(superBackgroundBlurScale, true)
    } else {
      unloadBackgroundThemeCSS()
      syncSuperBackgroundBlurScale(superBackgroundBlurScale, false)
    }
  }, [theme, lightThemeStyle, darkThemeStyle, superBackgroundBlurScale, systemIsDark])

  // 计算实际应用的主题
  const effectiveTheme = getEffectiveTheme(theme, systemIsDark)

  // 判断是否为暗色主题
  const isDark = effectiveTheme === 'dark'

  // 判断是否为背景主题
  const isBackground = theme === 'background'

  useCustomFont()

  return {
    theme,
    effectiveTheme,
    isDark,
    isBackground,
    backgroundImagePath,
    lightThemeStyle,
    darkThemeStyle
  }
}

export function applyThemeToBody(theme, windowName = '') {
  if (typeof document === 'undefined') return

  const body = document.body
  const effectiveTheme = getEffectiveTheme(theme)
  const lightThemeStyle = settingsStore.lightThemeStyle
  const darkThemeStyle = settingsStore.darkThemeStyle

  // 移除所有主题类
  body.classList.remove(
    'theme-light',
    'theme-dark',
    'theme-background',
    'has-dynamic-titlebar',
    'theme-light-wireframe',
    'theme-dark-classic',
    'theme-dark-sketch'
  )

  // 添加窗口专属类名（防止多窗口CSS冲突）
  if (windowName) {
    body.classList.add(`window-${windowName}`)
  }

  // 应用主题类
  if (theme === 'background') {
    body.classList.add('theme-background')
    syncSuperBackgroundBlurScale(settingsStore.superBackgroundBlurScale, true)
  } else if (effectiveTheme === 'dark') {
    body.classList.add('theme-dark')
    if (darkThemeStyle === 'classic') {
      body.classList.add('theme-dark-classic')
    } else if (darkThemeStyle === 'sketch') {
      body.classList.add('theme-dark-sketch')
    }
  } else {
    body.classList.add('theme-light')
    if (lightThemeStyle === 'wireframe') {
      body.classList.add('theme-light-wireframe')
    }
  }

  if (theme !== 'background') {
    syncSuperBackgroundBlurScale(settingsStore.superBackgroundBlurScale, false)
  }
}
