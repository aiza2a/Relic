import { useEffect, useRef } from 'react'

// 限制值在最小和最大之间
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

// 创建自定义滚动条 Hook
export function useCustomScrollbar(container) {
  const scrollbarRef = useRef(null)
  const thumbRef = useRef(null)
  const isDraggingRef = useRef(false)
  const dragStartYRef = useRef(0)
  const startScrollTopRef = useRef(0)

  useEffect(() => {
    if (!container) return

    // 找到父容器（.custom-scrollbar-container）
    const parentContainer = container.closest('.custom-scrollbar-container')
    if (!parentContainer) return

    // 创建滚动条元素
    const scrollbar = document.createElement('div')
    scrollbar.className = 'custom-scrollbar'
    scrollbar.setAttribute('data-no-drag', 'true')
    
    const track = document.createElement('div')
    track.className = 'custom-scrollbar__track'
    
    const thumb = document.createElement('div')
    thumb.className = 'custom-scrollbar__thumb'
    
    track.appendChild(thumb)
    scrollbar.appendChild(track)
    parentContainer.appendChild(scrollbar)
    
    scrollbarRef.current = scrollbar
    thumbRef.current = thumb

    // 更新滚动条位置和大小
    const updateThumbPosition = () => {
      if (!container || !thumb) return

      const scrollHeight = container.scrollHeight
      const clientHeight = container.clientHeight
      const scrollTop = container.scrollTop

      // 如果内容不需要滚动，隐藏滚动条
      if (scrollHeight <= clientHeight) {
        thumb.style.display = 'none'
        return
      }
      thumb.style.display = 'block'

      const trackHeight = container.offsetHeight - 4
      const thumbHeight = Math.max((clientHeight / scrollHeight) * trackHeight, 30)
      const maxThumbTop = trackHeight - thumbHeight
      const thumbTop = clamp(
        (scrollTop / (scrollHeight - clientHeight)) * maxThumbTop,
        0,
        maxThumbTop
      )

      thumb.style.height = `${thumbHeight}px`
      thumb.style.top = `${thumbTop}px`
    }

    // 初始化位置
    updateThumbPosition()

    // 滚动事件监听
    const onScroll = () => updateThumbPosition()
    container.addEventListener('scroll', onScroll, { passive: true })

    // 窗口大小改变监听
    const onResize = () => updateThumbPosition()
    window.addEventListener('resize', onResize)

    // 拖动滚动
    const onThumbMouseDown = (e) => {
      isDraggingRef.current = true
      dragStartYRef.current = e.clientY
      startScrollTopRef.current = container.scrollTop
      scrollbar.classList.add('dragging')
      document.body.classList.add('no-select')
      e.preventDefault()
      e.stopPropagation()
    }

    const onMouseMove = (e) => {
      if (!isDraggingRef.current) return

      const scrollHeight = container.scrollHeight
      const clientHeight = container.clientHeight
      const trackHeight = container.offsetHeight - 4
      const thumbHeight = Math.max((clientHeight / scrollHeight) * trackHeight, 30)
      const maxThumbTop = trackHeight - thumbHeight
      const deltaY = e.clientY - dragStartYRef.current
      const scrollRatio = (scrollHeight - clientHeight) / maxThumbTop

      container.scrollTop = startScrollTopRef.current + deltaY * scrollRatio
    }

    const onMouseUp = () => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      scrollbar.classList.remove('dragging')
      document.body.classList.remove('no-select')
    }

    thumb.addEventListener('mousedown', onThumbMouseDown)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)

    // 点击轨道跳转
    const onTrackMouseDown = (e) => {
      if (e.target !== scrollbar && !e.target.classList.contains('custom-scrollbar__track')) {
        return
      }

      const rect = scrollbar.getBoundingClientRect()
      const clickY = e.clientY - rect.top
      const scrollHeight = container.scrollHeight
      const clientHeight = container.clientHeight
      const trackHeight = container.offsetHeight - 4
      const thumbHeight = Math.max((clientHeight / scrollHeight) * trackHeight, 30)
      const maxThumbTop = trackHeight - thumbHeight
      const targetThumbTop = clamp(clickY - thumbHeight / 2, 0, maxThumbTop)
      const scrollRatio = (scrollHeight - clientHeight) / maxThumbTop

      container.scrollTop = targetThumbTop * scrollRatio

      // 立即进入拖动状态
      isDraggingRef.current = true
      dragStartYRef.current = e.clientY
      startScrollTopRef.current = container.scrollTop
      scrollbar.classList.add('dragging')
      document.body.classList.add('no-select')
      e.preventDefault()
      e.stopPropagation()
    }

    scrollbar.addEventListener('mousedown', onTrackMouseDown)

    // 监听内容变化
    const observer = new MutationObserver(() => {
      updateThumbPosition()
    })
    observer.observe(container, { childList: true, subtree: true })

    // 延迟更新一次，确保布局完成
    const timeoutId = setTimeout(updateThumbPosition, 50)

    // 清理
    return () => {
      clearTimeout(timeoutId)
      observer.disconnect()
      container.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      thumb.removeEventListener('mousedown', onThumbMouseDown)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      scrollbar.removeEventListener('mousedown', onTrackMouseDown)
      
      if (scrollbar && scrollbar.parentNode) {
        scrollbar.parentNode.removeChild(scrollbar)
      }
    }
  }, [container])

  return scrollbarRef
}

