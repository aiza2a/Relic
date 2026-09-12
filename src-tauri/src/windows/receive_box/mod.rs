// 收件盒窗口
//
// 全局单例窗口，用于展示局域网接收文件与 WebDAV 云端文件。

pub mod commands;
mod manager;
mod types;
mod window;

pub use manager::open_receive_box;
pub use types::ReceiveBoxLanFileProgress;

pub const LAN_FILES_CHANGED_EVENT: &str = "receive-box-lan-files-changed";
pub const LAN_FILE_PROGRESS_EVENT: &str = "receive-box-lan-file-progress";
pub const CLOUD_FILES_CHANGED_EVENT: &str = "receive-box-cloud-files-changed";

pub fn emit_lan_files_changed(app: &tauri::AppHandle) {
    use tauri::Emitter;
    let _ = app.emit(LAN_FILES_CHANGED_EVENT, ());
}

pub fn emit_lan_file_progress(app: &tauri::AppHandle, payload: ReceiveBoxLanFileProgress) {
    use tauri::Emitter;
    let _ = app.emit(LAN_FILE_PROGRESS_EVENT, payload);
}

pub fn emit_cloud_files_changed(app: &tauri::AppHandle) {
    use tauri::Emitter;
    let _ = app.emit(CLOUD_FILES_CHANGED_EVENT, ());
}
