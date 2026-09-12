import { listen } from '@tauri-apps/api/event'
import { refreshClipboardHistory, clipboardStore } from '@shared/store/clipboardStore'
import { refreshFavorites, favoritesStore } from '@shared/store/favoritesStore'
import { loadGroups, groupsStore } from '@shared/store/groupsStore'
import { navigationStore } from '@shared/store/navigationStore'

let unlisteners = []

function shiftNavigationIndex(tab, insertIndex) {
  if (
    navigationStore.activeTab === tab &&
    navigationStore.currentSelectedIndex >= insertIndex &&
    navigationStore.currentSelectedIndex >= 0
  ) {
    navigationStore.setSelectedIndex(navigationStore.currentSelectedIndex + 1)
  }
}

function moveNavigationIndex(tab, fromIndex, toIndex) {
  if (
    navigationStore.activeTab !== tab ||
    navigationStore.currentSelectedIndex < 0 ||
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex) ||
    fromIndex === toIndex
  ) {
    return
  }

  const currentIndex = navigationStore.currentSelectedIndex
  if (currentIndex === fromIndex) {
    navigationStore.setSelectedIndex(toIndex)
  } else if (fromIndex < toIndex && currentIndex > fromIndex && currentIndex <= toIndex) {
    navigationStore.setSelectedIndex(currentIndex - 1)
  } else if (fromIndex > toIndex && currentIndex >= toIndex && currentIndex < fromIndex) {
    navigationStore.setSelectedIndex(currentIndex + 1)
  }
}

function shouldRefreshClipboard(payload) {
  return (
    clipboardStore.filter ||
    clipboardStore.contentType !== 'all' ||
    payload?.kind !== 'created' ||
    !payload?.item ||
    !Number.isInteger(payload?.insert_index) ||
    !Number.isInteger(payload?.total_count)
  )
}

function shouldRefreshFavorites(payload) {
  return (
    favoritesStore.filter ||
    favoritesStore.contentType !== 'all' ||
    payload?.kind !== 'created' ||
    !payload?.item ||
    !Number.isInteger(payload?.insert_index)
  )
}

async function handleClipboardUpdated(payload) {
  try {
    if (shouldRefreshClipboard(payload)) {
      await refreshClipboardHistory()
      return
    }

    const oldIndex = clipboardStore.findLoadedItemIndex(payload.item.id)
    const isExistingRefresh = Number.isInteger(oldIndex) || payload.total_count <= clipboardStore.totalCount
    if (isExistingRefresh && !Number.isInteger(oldIndex)) {
      await refreshClipboardHistory()
      return
    }

    const inserted = clipboardStore.insertLoadedItemAt(
      payload.item,
      payload.insert_index,
      payload.total_count,
    )

    if (!inserted) {
      await refreshClipboardHistory()
      return
    }

    if (Number.isInteger(oldIndex)) {
      moveNavigationIndex('clipboard', oldIndex, payload.insert_index)
    } else {
      shiftNavigationIndex('clipboard', payload.insert_index)
    }
  } catch (error) {
    console.error('处理剪贴板更新事件失败:', error)
    await refreshClipboardHistory()
  }
}

async function handleFavoritesUpdated(payload) {
  try {
    if (payload?.kind === 'created' && payload?.item) {
      const currentGroup = groupsStore.currentGroup
      const matchesCurrentGroup =
        currentGroup === '全部' || !currentGroup || payload.item.group_name === currentGroup

      if (!matchesCurrentGroup) {
        return
      }
    }

    if (shouldRefreshFavorites(payload)) {
      await refreshFavorites(groupsStore.currentGroup)
      return
    }

    const nextTotalCount = favoritesStore.totalCount + 1
    const inserted = favoritesStore.insertLoadedItemAt(
      payload.item,
      payload.insert_index,
      nextTotalCount,
    )

    if (!inserted) {
      await refreshFavorites(groupsStore.currentGroup)
      return
    }

    shiftNavigationIndex('favorites', payload.insert_index)
  } catch (error) {
    console.error('处理收藏更新事件失败:', error)
    await refreshFavorites(groupsStore.currentGroup)
  }
}

// 设置剪贴板事件监听
export async function setupClipboardEventListener() {
  try {
    const unlisten1 = await listen('clipboard-updated', (event) => {
      handleClipboardUpdated(event.payload).catch(() => {})
    })
    unlisteners.push(unlisten1)

    const unlisten2 = await listen('quick-texts-updated', (event) => {
      handleFavoritesUpdated(event.payload).catch(() => {})
    })
    unlisteners.push(unlisten2)

    const unlisten3 = await listen('refreshQuickTexts', () => {
      refreshFavorites(groupsStore.currentGroup).catch(() => {})
    })
    unlisteners.push(unlisten3)

    const unlisten4 = await listen('main-window-refresh-needed', (event) => {
      const payload = event.payload || {}
      handleMainWindowRefreshNeeded(payload).catch(() => {})
    })
    unlisteners.push(unlisten4)
  } catch (error) {
    console.error('设置事件监听失败:', error)
  }
}

// 清理所有事件监听器
export function cleanupEventListeners() {
  unlisteners.forEach(unlisten => {
    try {
      unlisten()
    } catch (error) {
      console.error('清理事件监听器失败:', error)
    }
  })
  unlisteners = []
}

async function handleMainWindowRefreshNeeded(payload) {
  if (payload.groups) {
    await loadGroups()
  }
  if (payload.clipboard) {
    await refreshClipboardHistory()
  }
  if (payload.favorites) {
    await refreshFavorites(groupsStore.currentGroup)
  }
}
