import { ask, message } from '@tauri-apps/plugin-dialog'

// 信息提示框
export async function showMessage(msg, title = '提示') {
  await message(msg, { title, kind: 'info' })
}

// 错误提示框
export async function showError(msg, title = '错误') {
  await message(msg, { title, kind: 'error' })
}

// 警告提示框
export async function showWarning(msg, title = '警告') {
  await message(msg, { title, kind: 'warning' })
}

// 确认对话框，返回 true(确认) 或 false(取消)
export async function showConfirm(msg, title = '确认') {
  return await ask(msg, { title, kind: 'warning' })
}

