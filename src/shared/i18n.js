import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// 导入语言资源
import zhCN from './locales/zh-CN.json'
import enUS from './locales/en-US.json'

// 可用语言配置
export const availableLanguages = {
  'zh-CN': {
    name: '简体中文',
    nativeName: '简体中文',
    translation: zhCN
  },
  'en-US': {
    name: 'English',
    nativeName: 'English',
    translation: enUS
  }
}

// 获取可用语言列表
export function getAvailableLanguages() {
  return Object.entries(availableLanguages).map(([code, info]) => ({
    value: code,
    label: info.nativeName
  }))
}

if (!i18n.isInitialized) {
  const resources = {}
  Object.entries(availableLanguages).forEach(([code, info]) => {
    resources[code] = { translation: info.translation }
  })

  i18n
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: 'zh-CN',
      lng: 'zh-CN', 
      debug: false, 
      interpolation: {
        escapeValue: false, 
      }
    })
}

export default i18n
