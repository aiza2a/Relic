use tauri::{AppHandle, Manager};

use super::creator::create_community_window;

pub fn open_community_window(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("community") {
        if window.is_minimized().unwrap_or(false) {
            window
                .unminimize()
                .map_err(|e| format!("取消最小化社区交流窗口失败: {}", e))?;
        }
        window
            .show()
            .map_err(|e| format!("显示社区交流窗口失败: {}", e))?;
        window
            .set_focus()
            .map_err(|e| format!("聚焦社区交流窗口失败: {}", e))?;
    } else {
        create_community_window(app)?;
        if let Some(window) = app.get_webview_window("community") {
            window
                .set_focus()
                .map_err(|e| format!("聚焦社区交流窗口失败: {}", e))?;
        }
    }

    Ok(())
}
