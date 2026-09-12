// 截图遮罩窗口：全屏显示抓取的屏幕画面，供用户框选区域
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder};

use crate::services::screenshot;

const OVERLAY_LABEL: &str = "screenshot-overlay";

// 发起一次截图：抓屏 -> 创建全屏遮罩窗口
pub fn start_screenshot_session(app: &AppHandle) -> Result<(), String> {
    if app.get_webview_window(OVERLAY_LABEL).is_some() {
        return Ok(()); // 已有截图会话进行中
    }

    let monitor = app
        .primary_monitor()
        .map_err(|e| format!("获取主显示器失败: {}", e))?
        .ok_or_else(|| "未找到主显示器".to_string())?;
    let (mx, my) = monitor.position().into();
    let (mw, mh) = monitor.size().into();

    let session = screenshot::capture_monitor_at(mx, my)?;

    let window = WebviewWindowBuilder::new(
        app,
        OVERLAY_LABEL,
        WebviewUrl::App("windows/screenshot/index.html".into()),
    )
    .title("截图")
    .resizable(false)
    .maximizable(false)
    .minimizable(false)
    .decorations(false)
    .transparent(false)
    .shadow(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .focused(true)
    .visible(false)
    .drag_and_drop(false)
    .build()
    .map_err(|e| format!("创建截图窗口失败: {}", e))?;

    window
        .set_position(PhysicalPosition::new(mx, my))
        .map_err(|e| format!("设置截图窗口位置失败: {}", e))?;
    window
        .set_size(PhysicalSize::new(mw, mh))
        .map_err(|e| format!("设置截图窗口尺寸失败: {}", e))?;
    window
        .show()
        .map_err(|e| format!("显示截图窗口失败: {}", e))?;
    window
        .set_focus()
        .map_err(|e| format!("聚焦截图窗口失败: {}", e))?;

    Ok(())
}

fn close_overlay(window: &tauri::WebviewWindow) {
    screenshot::discard_session();
    let _ = window.close();
}

fn close_overlay_by_app(app: &AppHandle) {
    screenshot::discard_session();
    if let Some(window) = app.get_webview_window(OVERLAY_LABEL) {
        let _ = window.close();
    }
}

#[tauri::command]
pub fn get_screenshot_info() -> Result<serde_json::Value, String> {
    let session = screenshot::peek_session().ok_or("当前没有截图会话")?;
    Ok(serde_json::json!({
        "path": session.path,
        "width": session.width,
        "height": session.height,
    }))
}

#[tauri::command]
pub fn finish_screenshot(window: tauri::WebviewWindow, x: i32, y: i32, width: i32, height: i32) -> Result<(), String> {
    let session = screenshot::take_session().ok_or("当前没有截图会话")?;
    screenshot::crop_and_copy(&session, x, y, width, height)?;
    let _ = window.close();
    Ok(())
}

#[tauri::command]
pub fn cancel_screenshot(window: tauri::WebviewWindow) -> Result<(), String> {
    close_overlay(&window);
    Ok(())
}

// 供托盘/热键在会话异常残留时强制清理
pub fn force_cleanup(app: &AppHandle) {
    close_overlay_by_app(app);
}
