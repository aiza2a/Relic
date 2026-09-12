import { proxy } from 'valtio'

// Toast 位置类型
export const TOAST_POSITIONS = {
  TOP_LEFT: 'top-left',
  TOP_RIGHT: 'top-right',
  BOTTOM_LEFT: 'bottom-left',
  BOTTOM_RIGHT: 'bottom-right'
}

// Toast 大小类型
export const TOAST_SIZES = {
  EXTRA_SMALL: 'extra-small',
  SMALL: 'small',
  MEDIUM: 'medium',
  LARGE: 'large',
  EXTRA_LARGE: 'extra-large'
}

// Toast 状态管理
export const toastStore = proxy({
  toasts: [],

  // 添加 toast
  addToast(message, type = 'info', duration = 3000, position = TOAST_POSITIONS.TOP_RIGHT, size = TOAST_SIZES.MEDIUM) {
    const id = Date.now() + Math.random()
    const toast = {
      id,
      message,
      type, // 'success' | 'error' | 'warning' | 'info'
      duration,
      position, // 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
      size // 'extra-small' | 'small' | 'medium' | 'large' | 'extra-large'
    }

    toastStore.toasts.push(toast)

    return id
  },

  // 移除 toast
  removeToast(id) {
    const index = toastStore.toasts.findIndex(t => t.id === id)
    if (index > -1) {
      toastStore.toasts.splice(index, 1)
    }
  },

  // 清除所有 toast
  clearAll() {
    toastStore.toasts = []
  }
})

// 便捷方法
export const toast = {
  success: (message, options = {}) => {
    const { duration = 3000, position = TOAST_POSITIONS.TOP_RIGHT, size = TOAST_SIZES.MEDIUM } = options
    return toastStore.addToast(message, 'success', duration, position, size)
  },
  error: (message, options = {}) => {
    const { duration = 3000, position = TOAST_POSITIONS.TOP_RIGHT, size = TOAST_SIZES.MEDIUM } = options
    return toastStore.addToast(message, 'error', duration, position, size)
  },
  warning: (message, options = {}) => {
    const { duration = 3000, position = TOAST_POSITIONS.TOP_RIGHT, size = TOAST_SIZES.MEDIUM } = options
    return toastStore.addToast(message, 'warning', duration, position, size)
  },
  info: (message, options = {}) => {
    const { duration = 3000, position = TOAST_POSITIONS.TOP_RIGHT, size = TOAST_SIZES.MEDIUM } = options
    return toastStore.addToast(message, 'info', duration, position, size)
  }
}

