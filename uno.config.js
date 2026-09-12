import { defineConfig, presetUno, presetAttributify, presetIcons } from 'unocss'

export default defineConfig({
  // 配置扫描的文件
  content: {
    pipeline: {
      include: [
        './windows/**/*.{html,js,jsx,ts,tsx}',
        './shared/**/*.{html,js,jsx,ts,tsx}',
        './index.html',
        './src/**/*.{html,js,jsx,ts,tsx}',
      ],
    },
  },
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
      warn: true,
    }),
  ],
  shortcuts: {
    'btn': 'px-4 py-2 rounded cursor-pointer transition-all duration-200',
    'btn-primary': 'btn bg-blue-500 text-white hover:bg-blue-600',
    'btn-secondary': 'btn bg-gray-500 text-white hover:bg-gray-600',
    'card': 'bg-white dark:bg-gray-800 rounded-lg shadow-md p-4',
    'input': 'px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500',
    'bg-glass': 'bg-bg-glass-100 backdrop-blur-sm',
    'bg-glass-card': 'bg-bg-glass-200 backdrop-blur-xs border border-white/20',
    'bg-titlebar-dynamic': 'bg-bg-titlebar-bg text-bg-titlebar-text border-bg-titlebar-border',
    'text-dynamic': 'text-bg-dynamic-primary',
    'bg-dynamic': 'bg-bg-dynamic-primary',
    'hover-dynamic': 'hover:bg-bg-dynamic-hover',
  },
  theme: {
    colors: {
      // QuickClipboard 主题 token（由 CSS 变量驱动）
      qc: {
        fg: 'var(--qc-fg, #111827)',
        'fg-muted': 'var(--qc-fg-muted, #6b7280)',
        'fg-subtle': 'var(--qc-fg-subtle, #9ca3af)',
        surface: 'var(--qc-surface, #ffffff)',
        panel: 'var(--qc-panel, #f9f9f9)',
        'panel-2': 'var(--qc-panel-2, #e5e7eb)',
        hover: 'var(--qc-hover, rgba(156, 163, 175, 0.25))',
        active: 'var(--qc-active, rgba(59, 130, 246, 0.12))',
        favorite: 'var(--qc-favorite, #eab308)',
        border: 'var(--qc-border, rgba(17, 24, 39, 0.12))',
        'border-strong': 'var(--qc-border-strong, rgba(17, 24, 39, 0.22))',
      },
      primary: {
        50: '#eff6ff',
        100: '#dbeafe',
        200: '#bfdbfe',
        300: '#93c5fd',
        400: '#60a5fa',
        500: '#3b82f6',
        600: '#2563eb',
        700: '#1d4ed8',
        800: '#1e40af',
        900: '#1e3a8a',
      },
      //灰色系主题
      gray: {
        50: '#ffffff',
        100: '#f9f9f9',
        200: '#e5e7eb',
        300: '#d1d5db',
        400: '#9ca3af',
        500: '#6b7280',
        600: '#4b5563',
        700: '#374151',
        750: '#2d3342',
        800: '#1f2937',
        850: '#1a1f29',
        900: '#111827',
        950: '#0f1419',
      },
      // 蓝色系
      blue: {
        50: '#eff6ff',
        100: '#dbeafe',
        200: '#bfdbfe',
        300: '#93c5fd',
        400: '#60a5fa',
        450: '#4c9aff',
        500: '#3b82f6',
        600: '#2563eb',
        650: '#3c89e8',
        700: '#1d4ed8',
        750: '#6bb1ff',
        800: '#1e40af',
        900: '#1e3a8a',
      },
      bg: {
        titlebar: {
          bg: 'var(--bg-titlebar-bg, rgba(240, 240, 240, 0.9))',
          text: 'var(--bg-titlebar-text, #666666)',
          border: 'var(--bg-titlebar-border, rgba(232, 233, 234, 0.8))',
        },
        glass: {
          50: 'rgba(255, 255, 255, 0.5)',
          100: 'rgba(255, 255, 255, 0.68)',
          200: 'rgba(243, 244, 246, 0.68)',
          300: 'rgba(229, 231, 235, 0.68)',
          400: 'rgba(209, 213, 219, 0.68)',
          600: 'rgba(75, 85, 99, 0.68)',
          800: 'rgba(31, 41, 55, 0.68)',
        },
        // 动态主题色
        dynamic: {
          primary: 'var(--bg-dynamic-primary, #4a89dc)',
          hover: 'var(--bg-dynamic-hover, #3570b8)',
          light: 'var(--bg-dynamic-light, #e6f7ff)',
          dark: 'var(--bg-dynamic-dark, #3b7ac9)',
        },
      },
    },
  },
  safelist: [],
  rules: [
    // theme token helpers:
    // - bg-theme-xxx-100   -> background-color: var(--theme-xxx-100)
    // - text-theme-xxx-100 -> color: var(--theme-xxx-100)
    // - border-theme-xxx-100 -> border-color: var(--theme-xxx-100)
    // - theme-xxx-100      -> color: var(--theme-xxx-100)  (便捷写法，默认当 text 用)
    //
    // 支持 type 带连字符：dark-classic / superbg-classic 等
    [/^bg-theme-([a-z0-9-]+)-(\d{1,4})$/i, ([, type, step]) => ({ 'background-color': `var(--theme-${type}-${step})` })],
    [/^text-theme-([a-z0-9-]+)-(\d{1,4})$/i, ([, type, step]) => ({ color: `var(--theme-${type}-${step})` })],
    [/^border-theme-([a-z0-9-]+)-(\d{1,4})$/i, ([, type, step]) => ({ 'border-color': `var(--theme-${type}-${step})` })],
    [/^theme-([a-z0-9-]+)-(\d{1,4})$/i, ([, type, step]) => ({ color: `var(--theme-${type}-${step})` })],

    // 当前主题别名：bg-theme-100 -> var(--theme-100)（由 body.theme-* 提供）
    [/^bg-theme-(\d{1,4})$/, ([, step]) => ({ 'background-color': `var(--theme-${step})` })],
    [/^text-theme-(\d{1,4})$/, ([, step]) => ({ color: `var(--theme-${step})` })],
    [/^border-theme-(\d{1,4})$/, ([, step]) => ({ 'border-color': `var(--theme-${step})` })],
  ],
})

