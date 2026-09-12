import { convertFileSrc } from '@tauri-apps/api/core'

// 从图片中提取主色调（使用 Median Cut 算法）
export async function getDominantColor(imageUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'Anonymous'

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        // 调整图片大小
        const maxSize = 480
        const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1)
        canvas.width = img.width * ratio
        canvas.height = img.height * ratio
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data

        // 提取像素
        const pixels = []
        const step = 4
        for (let i = 0; i < data.length; i += 4 * step) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          const a = data[i + 3]
          if (a < 128) continue
          pixels.push([r, g, b])
        }

        if (pixels.length === 0) {
          return resolve({ r: 128, g: 128, b: 128, brightness: 0.5 })
        }

        // Median Cut 聚类
        const clusters = medianCut(pixels, 6)

        // 选择最佳颜色
        let bestColor = null
        let bestScore = -1

        for (const cluster of clusters) {
          if (cluster.length === 0) continue
          const [r, g, b] = averageColor(cluster)
          const { s, l } = rgbToHsl(r, g, b)

          // 过滤极端颜色
          if (l < 10 || l > 92) continue
          if (s < 12 && l > 70) continue

          // 计算分数（考虑饱和度和亮度）
          const score = cluster.length * (1 + s / 100) * (0.6 + l / 200)

          if (score > bestScore) {
            bestScore = score
            bestColor = { r, g, b }
          }
        }

        if (!bestColor) bestColor = { r: 128, g: 128, b: 128 }

        // 计算亮度
        const brightness = (bestColor.r * 0.299 + bestColor.g * 0.587 + bestColor.b * 0.114) / 255

        resolve({ ...bestColor, brightness })
      } catch (error) {
        reject(error)
      }
    }

    img.onerror = () => {
      reject(new Error('Failed to load image'))
    }

    img.src = imageUrl

    // 超时保护
    setTimeout(() => resolve({ r: 74, g: 137, b: 220, brightness: 0.5 }), 3000)
  })
}

// Median Cut 聚类算法
function medianCut(pixels, maxClusters) {
  let clusters = [pixels]

  while (clusters.length < maxClusters) {
    let maxRangeClusterIndex = -1
    let maxRange = -1

    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i]
      if (cluster.length <= 1) continue

      const ranges = getColorRange(cluster)
      const range = Math.max(...ranges)

      if (range > maxRange) {
        maxRange = range
        maxRangeClusterIndex = i
      }
    }

    if (maxRangeClusterIndex === -1) break

    const cluster = clusters[maxRangeClusterIndex]
    const ranges = getColorRange(cluster)
    const channel = ranges.indexOf(maxRange)

    cluster.sort((a, b) => a[channel] - b[channel])
    const mid = Math.floor(cluster.length / 2)

    clusters.splice(maxRangeClusterIndex, 1, cluster.slice(0, mid), cluster.slice(mid))
  }

  return clusters
}

function getColorRange(cluster) {
  let minR = 255, minG = 255, minB = 255
  let maxR = 0, maxG = 0, maxB = 0

  for (const [r, g, b] of cluster) {
    if (r < minR) minR = r
    if (g < minG) minG = g
    if (b < minB) minB = b
    if (r > maxR) maxR = r
    if (g > maxG) maxG = g
    if (b > maxB) maxB = b
  }

  return [maxR - minR, maxG - minG, maxB - minB]
}

function averageColor(cluster) {
  let r = 0, g = 0, b = 0
  for (const [rr, gg, bb] of cluster) {
    r += rr
    g += gg
    b += bb
  }
  const n = cluster.length || 1
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)]
}

// RGB 转 HSL
function rgbToHsl(r, g, b) {
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0, s = 0, l = (max + min) / 2

  const d = max - min
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }
    h /= 6
  }

  return { h: h * 360, s: s * 100, l: l * 100 }
}

// HSL 转 RGB
function hslToRgb(h, s, l) {
  h /= 360
  s /= 100
  l /= 100

  if (s === 0) {
    const v = Math.round(l * 255)
    return { r: v, g: v, b: v }
  }

  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const r = hue2rgb(p, q, h + 1 / 3)
  const g = hue2rgb(p, q, h)
  const b = hue2rgb(p, q, h - 1 / 3)

  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

// 计算相对亮度（WCAG 标准）
function getRelativeLuminance(r, g, b) {
  const srgbToLinear = (c) => {
    const v = c / 255
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  const R = srgbToLinear(r)
  const G = srgbToLinear(g)
  const B = srgbToLinear(b)
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

// 计算对比度（WCAG 标准）
function getContrastRatio(fg, bg) {
  const L1 = getRelativeLuminance(fg.r, fg.g, fg.b)
  const L2 = getRelativeLuminance(bg.r, bg.g, bg.b)
  const lighter = Math.max(L1, L2)
  const darker = Math.min(L1, L2)
  return (lighter + 0.05) / (darker + 0.05)
}

// 生成可访问的文字颜色（对比度优化，支持色相偏移）
function generateAccessibleTextColor(backgroundColor, options = {}) {
  const { r, g, b } = backgroundColor
  const targetContrast = options.minContrastRatio || 4.5
  const maxHueShift = options.maxHueShift || 24
  const bg = { r, g, b }
  const { h, s } = rgbToHsl(r, g, b)
  const isLightBg = (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5
  const initialL = isLightBg ? 24 : 86
  const minL = 8, maxL = 92
  const baseS = clamp(s * 0.55, 12, 68)

  const hueSteps = [0, 6, 12, 18, 24].filter(v => v <= maxHueShift)
  const lightnessSteps = [0, 6, 10, 14, 18, 24, 30, 36, 42, 50, 58, 66, 76]

  // 尝试寻找满足对比度的颜色（尝试色相偏移）
  const trySearch = () => {
    for (const hs of hueSteps) {
      for (const sign of [1, -1]) {
        const hh = (h + sign * hs + 360) % 360
        for (const step of lightnessSteps) {
          const l1 = clamp(initialL + step * (isLightBg ? -1 : 1), minL, maxL)
          const l2 = clamp(initialL + step * (isLightBg ? 1 : -1), minL, maxL)
          for (const candL of [l1, l2]) {
            const cand = hslToRgb(hh, baseS, candL)
            if (getContrastRatio(cand, bg) >= targetContrast) return cand
          }
        }
      }
    }
    return null
  }

  const adjusted = trySearch()
  if (adjusted) return `rgb(${adjusted.r}, ${adjusted.g}, ${adjusted.b})`

  // 回退：选择黑色或白色中对比度更高的，并与背景色混合 6% 柔和处理
  const blackish = { r: 12, g: 12, b: 12 }
  const whitish = { r: 243, g: 243, b: 243 }
  const prefer = getContrastRatio(blackish, bg) >= getContrastRatio(whitish, bg) ? blackish : whitish
  const mix = (c1, c2, t) => ({
    r: Math.round(c1.r * (1 - t) + c2.r * t),
    g: Math.round(c1.g * (1 - t) + c2.g * t),
    b: Math.round(c1.b * (1 - t) + c2.b * t)
  })
  const softened = mix(prefer, bg, 0.06)
  return `rgb(${softened.r}, ${softened.g}, ${softened.b})`
}

// 根据主色调生成完整的主题色系统
export function generateTitleBarColors(dominantColor) {
  const { r, g, b, brightness } = dominantColor

  // 生成文字颜色（使用较低的对比度要求，允许色相偏移）
  const textColor = generateAccessibleTextColor({ r, g, b }, { minContrastRatio: 3.2, maxHueShift: 18 })

  // 标题栏背景色（完全不透明，透明度在 CSS 中用 color-mix 控制）
  const backgroundColor = `rgb(${r}, ${g}, ${b})`

  // 边框颜色
  let borderColor
  if (brightness > 0.5) {
    const factor = 0.8
    borderColor = `rgba(${Math.floor(r * factor)}, ${Math.floor(g * factor)}, ${Math.floor(b * factor)}, 0.3)`
  } else {
    const factor = 1.3
    borderColor = `rgba(${Math.min(255, Math.floor(r * factor))}, ${Math.min(255, Math.floor(g * factor))}, ${Math.min(255, Math.floor(b * factor))}, 0.3)`
  }

  // 生成主题色系统
  const { h, s } = rgbToHsl(r, g, b)
  const baseS = clamp(s * 1.1, 35, 85)
  const baseL = 52

  const primary = hslToRgb(h, baseS, baseL)
  const hover = hslToRgb(h, baseS, clamp(baseL - 8, 20, 80))
  const dark = hslToRgb(h, baseS, clamp(baseL - 18, 10, 70))
  const light = hslToRgb(h, clamp(baseS * 0.4, 10, 60), 94)

  return {
    textColor,
    backgroundColor,
    borderColor,
    brightness,
    accentPrimary: `rgb(${primary.r}, ${primary.g}, ${primary.b})`,
    accentHover: `rgb(${hover.r}, ${hover.g}, ${hover.b})`,
    accentDark: `rgb(${dark.r}, ${dark.g}, ${dark.b})`,
    accentLight: `rgb(${light.r}, ${light.g}, ${light.b})`
  }
}

// 应用标题栏颜色到 CSS 变量（简化版本）
export function applyTitleBarColors(colors) {
  if (typeof document === 'undefined') return

  const root = document.documentElement

  // 使用新的CSS变量命名
  root.style.setProperty('--bg-titlebar-bg', colors.backgroundColor)
  root.style.setProperty('--bg-titlebar-text', colors.textColor)
  root.style.setProperty('--bg-titlebar-border', colors.borderColor)

  // 设置主题色系统
  if (colors.accentPrimary) root.style.setProperty('--bg-dynamic-primary', colors.accentPrimary)
  if (colors.accentHover) root.style.setProperty('--bg-dynamic-hover', colors.accentHover)
  if (colors.accentLight) root.style.setProperty('--bg-dynamic-light', colors.accentLight)
  if (colors.accentDark) root.style.setProperty('--bg-dynamic-dark', colors.accentDark)

  // 添加标记类，表示使用了动态颜色
  document.body.classList.add('has-dynamic-titlebar')
}

// 移除标题栏动态颜色（简化版本）
export function removeTitleBarColors() {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  root.style.removeProperty('--bg-titlebar-bg')
  root.style.removeProperty('--bg-titlebar-text')
  root.style.removeProperty('--bg-titlebar-border')
  root.style.removeProperty('--bg-dynamic-primary')
  root.style.removeProperty('--bg-dynamic-hover')
  root.style.removeProperty('--bg-dynamic-light')
  root.style.removeProperty('--bg-dynamic-dark')

  document.body.classList.remove('has-dynamic-titlebar')
}

// 预加载背景图片
function preloadBackgroundImage(url) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = () => {
      console.warn('Background image preload failed, continuing anyway')
      resolve()
    }
    img.src = url

    // 超时保护
    setTimeout(() => resolve(), 3000)
  })
}

// 应用背景图片
export async function applyBackgroundImage(options) {
  const {
    containerSelector,
    backgroundImagePath,
    windowName = 'window'
  } = options

  try {
    const container = document.querySelector(containerSelector)
    if (!container) {
      console.warn(`Container ${containerSelector} not found`)
      return
    }

    if (backgroundImagePath) {
      // 转换文件路径为资源URL
      const assetUrl = convertFileSrc(backgroundImagePath, 'asset')

      // 预加载图片
      await preloadBackgroundImage(assetUrl)

      // 设置背景图（使用 !important 确保优先级）
      container.style.setProperty('background-image', `url("${assetUrl}")`, 'important')
      container.style.setProperty('background-size', 'cover', 'important')
      container.style.setProperty('background-position', 'center', 'important')
      container.style.setProperty('background-repeat', 'no-repeat', 'important')
      container.style.setProperty('background-color', 'transparent', 'important')

      // 分析背景图主色调并应用到标题栏
      try {
        const dominantColor = await getDominantColor(assetUrl)
        const titleBarColors = generateTitleBarColors(dominantColor)
        applyTitleBarColors(titleBarColors)
      } catch (colorError) {
        console.warn(`Failed to analyze background color for ${windowName}:`, colorError)
        removeTitleBarColors()
      }
    } else {
      // 清除背景图
      container.style.removeProperty('background-image')
      container.style.removeProperty('background-size')
      container.style.removeProperty('background-position')
      container.style.removeProperty('background-repeat')
      container.style.removeProperty('background-color')
      removeTitleBarColors()
    }
  } catch (error) {
    console.error(`Failed to apply background image for ${windowName}:`, error)
  }
}

// 清除背景图片
export function clearBackgroundImage(containerSelector) {
  try {
    const container = document.querySelector(containerSelector)
    if (container) {
      container.style.removeProperty('background-image')
      container.style.removeProperty('background-size')
      container.style.removeProperty('background-position')
      container.style.removeProperty('background-repeat')
      container.style.removeProperty('background-color')
    }
    removeTitleBarColors()
  } catch (error) {
    console.error('Failed to clear background image:', error)
  }
}

