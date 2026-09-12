import { invoke } from '@tauri-apps/api/core'

export async function getCurrentStoragePath() {
  return await invoke('dm_get_current_storage_path')
}

export async function getDefaultStoragePath() {
  return await invoke('dm_get_default_storage_path')
}

//检测目标目录是否有数据
export async function checkTargetHasData(targetPath) {
  return await invoke('dm_check_target_has_data', { payload: { target_path: targetPath } })
}

//更改存储路径
export async function changeStoragePath(newPath, mode = 'source_only') {
  return await invoke('dm_change_storage_path', { payload: { new_path: newPath, mode } })
}

//重置存储路径到默认位置
export async function resetStoragePathToDefault(mode = 'source_only') {
  return await invoke('dm_reset_storage_path_to_default', { payload: { mode } })
}

export async function exportDataZip(targetPath) {
  return await invoke('dm_export_data_zip', { payload: { target_path: targetPath } })
}

export async function importDataZip(zipPath, mode) {
  return await invoke('dm_import_data_zip', { payload: { zip_path: zipPath, mode } })
}

export async function resetAllData() {
  return await invoke('dm_reset_all_data')
}

export async function listBackups() {
  return await invoke('dm_list_backups')
}
