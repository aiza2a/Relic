use tauri::WebviewWindow;

use super::input_common;

pub fn init_input_monitor(window: WebviewWindow) {
    input_common::set_main_window(window);
}

pub fn update_main_window(window: WebviewWindow) {
    input_common::set_main_window(window);
}

pub fn enable_navigation_keys() {
    crate::hotkey::enable_navigation_hotkeys();
}

pub fn disable_navigation_keys() {
    crate::hotkey::disable_navigation_hotkeys();
}

pub fn enable_mouse_monitoring() {
    input_common::set_mouse_monitoring_enabled(true);
}

pub fn disable_mouse_monitoring() {
    input_common::set_mouse_monitoring_enabled(false);
}

pub fn is_mouse_monitoring_enabled() -> bool {
    input_common::is_mouse_monitoring_enabled()
}
