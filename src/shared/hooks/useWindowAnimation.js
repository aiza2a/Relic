import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { settingsStore } from '@shared/store/settingsStore'

// 展开动画
function animateExpand(container) {
  const duration = 400
  const startTime = performance.now()
  const targetHeight = window.innerHeight - 10

  container.style.height = '0'
  container.style.opacity = '0'
  container.style.overflow = 'hidden'

  function easeWithSettleBounce(t) {
    if (t < 0.7) {
      const normalized = t / 0.7
      return 1 - Math.pow(1 - normalized, 3)
    }

    const settlePhase = (t - 0.7) / 0.3
    const overshoot = Math.cos(settlePhase * Math.PI) * 0.012
    return 1 - overshoot * (1 - settlePhase)
  }

  function animate(currentTime) {
    const progress = Math.min((currentTime - startTime) / duration, 1)
    const eased = easeWithSettleBounce(progress)
    
    container.style.height = `${targetHeight * eased}px`
    container.style.opacity = Math.min(progress * 2, 1)

    if (progress < 1) {
      requestAnimationFrame(animate)
    } else {
      container.style.height = 'calc(100vh - 10px)'
      container.style.opacity = '1'
    }
  }

  requestAnimationFrame(animate)
}

// 收起动画
function animateCollapse(container) {
  const duration = 200
  const startTime = performance.now()
  const startHeight = window.innerHeight

  container.style.height = 'calc(100vh - 10px)'
  container.style.opacity = '1'
  container.style.overflow = 'hidden'

  function animate(currentTime) {
    const progress = Math.min((currentTime - startTime) / duration, 1)
    const eased = Math.pow(progress, 2)
    
    container.style.height = `${startHeight * (1 - eased)}px`
    container.style.opacity = 1 - eased

    if (progress < 1) {
      requestAnimationFrame(animate)
    } else {
      container.style.height = '0'
      container.style.opacity = '0'
    }
  }

  requestAnimationFrame(animate)
}

export function useWindowAnimation() {
  useEffect(() => {
    const container = document.querySelector('.main-container')
    if (!container) return

    const unlistenShow = listen('window-show-animation', () => {
      if (settingsStore.clipboardAnimationEnabled) {
        animateExpand(container)
      } else {
        container.style.height = 'calc(100vh - 10px)'
        container.style.opacity = '1'
      }
    })

    const unlistenHide = listen('window-hide-animation', () => {
      if (settingsStore.clipboardAnimationEnabled) {
        animateCollapse(container)
      } else {
        container.style.height = '0'
        container.style.opacity = '0'
        container.style.overflow = 'hidden'
      }
    })

    // 超时显示
    const fallbackTimer = setTimeout(() => {
      if (container.style.height !== 'calc(100vh - 10px)') {
        container.style.height = 'calc(100vh - 10px)'
        container.style.opacity = '1'
      }
    }, 200)

    return () => {
      unlistenShow.then(fn => fn())
      unlistenHide.then(fn => fn())
      clearTimeout(fallbackTimer)
    }
  }, [])
}

