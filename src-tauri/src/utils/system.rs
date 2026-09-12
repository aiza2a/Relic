// 获取 Windows 系统文本缩放比例
#[cfg(windows)]
pub fn get_text_scale_factor() -> f64 {
    use winreg::enums::*;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok(key) = hkcu.open_subkey("SOFTWARE\\Microsoft\\Accessibility") {
        if let Ok(value) = key.get_value::<u32, _>("TextScaleFactor") {
            return value as f64 / 100.0;
        }
    }
    1.0
}

#[cfg(not(windows))]
pub fn get_text_scale_factor() -> f64 {
    1.0
}

#[tauri::command]
pub fn get_system_text_scale() -> f64 {
    get_text_scale_factor()
}
