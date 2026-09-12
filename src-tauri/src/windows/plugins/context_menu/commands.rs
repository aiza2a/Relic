use super::window::{show_menu, ContextMenuRequest};
use tauri::{AppHandle, LogicalSize, Manager, PhysicalPosition};

#[tauri::command]
pub fn get_context_menu_options() -> Result<ContextMenuRequest, String> {
    super::get_options().ok_or_else(|| "配置未初始化".into())
}

#[tauri::command]
pub fn update_context_menu_regions(main_menu: super::MenuRegion, submenus: Vec<super::MenuRegion>) {
    super::update_menu_regions(main_menu, submenus);
}

#[tauri::command]
pub fn submit_context_menu(item_id: Option<String>) {
    let session_id = super::get_active_menu_session();
    super::set_result(item_id);
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(200));
        super::clear_active_menu_session(session_id);
        super::clear_options_for_session(session_id);
    });
}

#[tauri::command]
pub async fn show_context_menu(
    app: AppHandle,
    request: ContextMenuRequest,
) -> Result<Option<String>, String> {
    let _ = crate::windows::pin_image_window::close_image_preview(app.clone());
    let _ = crate::windows::preview_window::close_preview_window(app.clone());
    show_menu(app, request).await
}

#[tauri::command]
pub fn close_all_context_menus(app: AppHandle) {
    let _ = crate::windows::pin_image_window::close_image_preview(app.clone());
    let _ = crate::windows::preview_window::close_preview_window(app.clone());

    if let Some(w) = app.get_webview_window("context-menu") {
        let _ = w.hide();
        std::thread::spawn(|| {
            std::thread::sleep(std::time::Duration::from_millis(200));
            let sid = super::get_active_menu_session();
            super::clear_active_menu_session(sid);
            super::clear_options_for_session(sid);
        });
    }
}

#[tauri::command]
pub fn resize_context_menu(app: AppHandle, width: f64, height: f64, x: f64, y: f64) {
    if let Some(w) = app.get_webview_window("context-menu") {
        let _ = w.set_position(PhysicalPosition::new(x as i32, y as i32));
        let text_scale = crate::utils::get_text_scale_factor();
        let _ = w.set_size(LogicalSize::new(width * text_scale, height * text_scale));
    }
}
