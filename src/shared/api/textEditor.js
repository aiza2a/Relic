import { invoke } from '@tauri-apps/api/core'

// 打开编辑器编辑剪贴板项
export async function openEditorForClipboard(item, index) {
  await invoke('open_text_editor_window', {
    itemId: item.id.toString(),
    itemType: 'clipboard',
    itemIndex: index + 1,
    groupName: null
  })
}

// 打开编辑器编辑收藏项
export async function openEditorForFavorite(item) {
  await invoke('open_text_editor_window', {
    itemId: item.id,
    itemType: 'favorite',
    itemIndex: null,
    groupName: null
  })
}

// 打开空白编辑器（新建收藏项）
export async function openBlankEditor(groupName = null) {
  await invoke('open_text_editor_window', {
    itemId: '-1',
    itemType: 'favorite',
    itemIndex: null,
    groupName
  })
}

