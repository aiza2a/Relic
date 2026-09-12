import { invoke } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'
import { getCurrentWindow } from '@tauri-apps/api/window'

import appLinks from '@shared/config/appLinks.json'

import channelQr from '@/assets/pD_1.png'
import group1Qr from '@/assets/qG_1.png'
import group2Qr from '@/assets/qG_2.png'
import icon from '@/assets/icon1024.png'

const CHANNEL = {
  id: 'channel',
  title: 'QuickClipboard频道',
  subtitle: 'pd80680380',
  qr: channelQr,
  qrSmall: icon,
  detailLink: appLinks.pdChannel,
  joinUrl: appLinks.pdChannel,
  copyText: 'pd80680380',
}

let pendingLayoutRaf = 0
function scheduleAdjustLayout() {
  if (pendingLayoutRaf) return
  pendingLayoutRaf = requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      pendingLayoutRaf = 0
      adjustLayout()
    })
  })
}

const GROUP_1 = {
  id: 'group1',
  title: 'QuickClipboard交流群 1',
  subtitle: '725313287',
  qr: group1Qr,
  qrSmall: icon,
  detailLink: appLinks.qqGroup1,
  joinUrl: appLinks.qqGroup1,
  copyText: '725313287',
}

const GROUP_2 = {
  id: 'group2',
  title: 'QuickClipboard交流群 2',
  subtitle: '1033556729',
  qr: group2Qr,
  qrSmall: icon,
  detailLink: appLinks.qqGroup2,
  joinUrl: appLinks.qqGroup2,
  copyText: '1033556729',
}

const CHANNELS = [CHANNEL, GROUP_1, GROUP_2]

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function adjustLayout() {
  const leftPanel = document.getElementById('leftPanel')
  const rightPanel = document.getElementById('rightPanel')
  if (!leftPanel || !rightPanel) return

  leftPanel.style.height = ''
  rightPanel.style.height = ''

  const contentArea = document.querySelector('.content-area')
  const qrContainer = document.querySelector('.big-qr-container')
  if (!contentArea || !qrContainer) return

  const contentHeight = contentArea.getBoundingClientRect().height
  const computed = window.getComputedStyle(rightPanel)
  const padTop = Number.parseFloat(computed.paddingTop || '0') || 0
  const padBottom = Number.parseFloat(computed.paddingBottom || '0') || 0

  const qrComputed = window.getComputedStyle(qrContainer)
  const qrMarginTop = Number.parseFloat(qrComputed.marginTop || '0') || 0
  const qrMarginBottom = Number.parseFloat(qrComputed.marginBottom || '0') || 0

  const rightHeight = rightPanel.getBoundingClientRect().height
  if (!Number.isFinite(rightHeight) || rightHeight <= 0) return

  const qrMaxHeight = Math.max(
    0,
    rightHeight - padTop - padBottom - contentHeight - qrMarginTop - qrMarginBottom,
  )
  qrContainer.style.maxHeight = `${Math.floor(qrMaxHeight)}px`
}

function setActiveCard(activeId) {
  document.querySelectorAll('.item-card').forEach((el) => {
    const id = el.getAttribute('data-id')
    el.classList.toggle('active', id === activeId)
  })
}

function updateRightPanel(channel) {
  const bigQrImg = document.getElementById('bigQrImg')
  const detailTitle = document.getElementById('detailTitle')
  const detailUrl = document.getElementById('detailUrl')
  const joinBtn = document.getElementById('joinBtn')
  const copyBtn = document.getElementById('copyBtn')

  if (!bigQrImg || !detailTitle || !detailUrl || !joinBtn || !copyBtn) return

  bigQrImg.src = channel.qr
  bigQrImg.alt = `${channel.title} 二维码`
  detailTitle.textContent = channel.title
  detailUrl.textContent = channel.detailLink || channel.joinUrl || ''

  const updateToken = `${channel.id}:${Date.now()}`
  joinBtn.dataset.token = updateToken
  copyBtn.dataset.token = updateToken

  const resetBtn = (btn, text) => {
    btn.disabled = false
    btn.textContent = text
  }

  resetBtn(joinBtn, '立即加入')
  resetBtn(copyBtn, '复制')

  const flashBtn = (btn, nextText, ms) => {
    const token = btn.dataset.token
    btn.disabled = true
    btn.textContent = nextText
    window.setTimeout(() => {
      if (btn.dataset.token !== token) return
      btn.disabled = false
      btn.textContent = btn.id === 'joinBtn' ? '立即加入' : '复制'
    }, ms)
  }

  joinBtn.onclick = async () => {
    if (joinBtn.disabled) return
    flashBtn(joinBtn, '正在打开...', 800)
    try {
      await openUrl(channel.joinUrl)
      flashBtn(joinBtn, '已打开', 800)
    } catch (e) {
      console.error('打开链接失败:', e)
      flashBtn(joinBtn, '打开失败', 1000)
    }
  }

  copyBtn.onclick = async () => {
    if (copyBtn.disabled) return
    flashBtn(copyBtn, '正在复制...', 800)
    try {
      await invoke('copy_text_to_clipboard', { text: channel.copyText })
      flashBtn(copyBtn, '已复制', 800)
    } catch (e) {
      console.error('复制失败:', e)
      flashBtn(copyBtn, '复制失败', 1000)
    }
  }
}

function render(selectedId) {
  const selected = CHANNELS.find((c) => c.id === selectedId) || CHANNELS[0]
  const app = document.getElementById('app')

  const leftItemsHtml = CHANNELS.map((c) => {
    const smallSrc = c.qrSmall || c.qr
    return `
      <div class="item-card" data-id="${escapeHtml(c.id)}">
        <div class="clipboard-content">
          <div class="clipboard-title">${escapeHtml(c.title)}</div>
          <div class="clipboard-data">${escapeHtml(c.subtitle)}</div>
        </div>
        <div class="qr-placeholder">
          <img src="${smallSrc}" alt="${escapeHtml(c.title)}" />
        </div>
      </div>
    `
  }).join('')

  app.innerHTML = `
    <div class="container">
      <div class="left-panel" id="leftPanel">
        ${leftItemsHtml}
      </div>

      <div class="right-panel" id="rightPanel">
        <div class="big-qr-container">
          <div class="big-qr-placeholder">
            <img id="bigQrImg" src="${selected.qr}" alt="大二维码" />
          </div>
        </div>

        <div class="content-area">
          <div id="detailTitle" class="detail-title">${escapeHtml(selected.title)}</div>
          <div id="detailUrl" class="detail-url">${escapeHtml(selected.subtitle)}</div>
          <div class="action-buttons">
            <button class="btn" id="joinBtn">立即加入</button>
            <button class="btn btn-secondary" id="copyBtn">复制</button>
          </div>
        </div>
      </div>
    </div>
  `

  setActiveCard(selected.id)
  updateRightPanel(selected)

  document.querySelectorAll('.item-card').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-id')
      const channel = CHANNELS.find((c) => c.id === id)
      if (!channel) return
      setActiveCard(channel.id)
      updateRightPanel(channel)
      scheduleAdjustLayout()
    })
  })

  scheduleAdjustLayout()
}

window.addEventListener('DOMContentLoaded', () => {
  render(CHANNELS[0].id)

  window.addEventListener('resize', () => {
    scheduleAdjustLayout()
  })

  document.addEventListener('mousedown', async (e) => {
    if (e.button !== 0) return
    const target = e.target
    if (!(target instanceof Element)) return

    if (target.closest('button, a, input, textarea, select, [role="button"], .item-card, img')) {
      return
    }

    try {
      await getCurrentWindow().startDragging()
    } catch {
    }
  })
})
