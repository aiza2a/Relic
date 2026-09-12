import { useEffect } from 'react'
import { useSnapshot } from 'valtio'
import { settingsStore } from '@shared/store/settingsStore'
import { convertFileSrc } from '@tauri-apps/api/core'

const LOCAL_FAMILY = 'CustomFont'

function buildOverrideCSS(family) {
  return `*{font-family:"${family}","Segoe UI","Microsoft YaHei",sans-serif!important}`
}

let styleElement = null
let appliedConfigKey = ''
let loadingConfigKey = ''
let loadVersion = 0

function injectOverride(family) {
  if (!styleElement) {
    styleElement = document.createElement('style')
    styleElement.id = 'custom-font-override'
    document.head.appendChild(styleElement)
  }
  styleElement.textContent = buildOverrideCSS(family)
}

function removeOverride() {
  if (styleElement) {
    document.head.removeChild(styleElement)
    styleElement = null
  }
  appliedConfigKey = ''
}

async function loadLocalFont(filePath) {
  try {
    const assetUrl = convertFileSrc(filePath, 'asset')
    const font = new FontFace(LOCAL_FAMILY, `url(${assetUrl})`)
    await font.load()
    document.fonts.add(font)
    return true
  } catch (e) {
    console.error('加载本地字体失败:', e)
    return false
  }
}

function loadUrlFont(url) {
  return new Promise((resolve) => {
    removePendingUrlFontResources()

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = url
    link.setAttribute('data-custom-font-pending', 'true')
    link.onload = () => {
      resolve({ ok: true, link })
    }
    link.onerror = () => {
      link.remove()
      resolve({ ok: false, link: null })
    }
    document.head.appendChild(link)
  })
}

function removePendingUrlFontResources() {
  document.querySelectorAll('[data-custom-font-pending="true"]').forEach(link => link.remove())
}

function removeFontResources() {
  removePendingUrlFontResources()
  const link = document.getElementById('custom-font-link')
  if (link) document.head.removeChild(link)
}

function promoteUrlFontResource(link) {
  if (!link?.parentNode) {
    return
  }

  const activeLink = document.getElementById('custom-font-link')
  if (activeLink && activeLink !== link) {
    activeLink.remove()
  }

  removePendingUrlFontResources()
  link.id = 'custom-font-link'
  link.removeAttribute('data-custom-font-pending')
  document.head.appendChild(link)
}

function getFontConfig(enabled, type, path, url, family) {
  if (!enabled) {
    return null
  }

  if (type === 'file' && path) {
    return {
      key: `file:${path}`,
      type: 'file',
      source: path,
      family: LOCAL_FAMILY
    }
  }

  if (type === 'url' && url && family) {
    return {
      key: `url:${url}:${family}`,
      type: 'url',
      source: url,
      family
    }
  }

  return null
}

export function useCustomFont() {
  const { customFontEnabled, customFontType, customFontPath, customFontUrl, customFontFamily } = useSnapshot(settingsStore)

  useEffect(() => {
    const config = getFontConfig(customFontEnabled, customFontType, customFontPath, customFontUrl, customFontFamily)

    if (!config) {
      loadVersion += 1
      loadingConfigKey = ''
      removeOverride()
      removeFontResources()
      settingsStore.customFontStatus = 'idle'
      return
    }

    if (appliedConfigKey === config.key) {
      injectOverride(config.family)
      settingsStore.customFontStatus = 'loaded'
      return
    }

    if (loadingConfigKey === config.key) {
      return
    }

    const currentVersion = loadVersion + 1
    loadVersion = currentVersion
    loadingConfigKey = config.key
    settingsStore.customFontStatus = 'loading'

    const loader = config.type === 'file'
      ? loadLocalFont(config.source)
      : loadUrlFont(config.source)

    loader.then((result) => {
      if (loadVersion !== currentVersion || loadingConfigKey !== config.key) {
        if (config.type === 'url' && result?.link) {
          result.link.remove()
        }
        return
      }

      loadingConfigKey = ''
      const ok = config.type === 'file' ? result === true : result?.ok === true

      if (ok) {
        if (config.type === 'url') {
          promoteUrlFontResource(result.link)
        }
        injectOverride(config.family)
        appliedConfigKey = config.key
        settingsStore.customFontStatus = 'loaded'
      } else {
        removeOverride()
        if (config.type === 'url' && result?.link) {
          result.link.remove()
        }
        settingsStore.customFontStatus = 'error'
      }
    })
  }, [customFontEnabled, customFontType, customFontPath, customFontUrl, customFontFamily])
}
