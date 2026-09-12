use serde_json::Value;

#[tauri::command]
pub fn get_app_links_cmd() -> Result<Value, String> {
    let links = crate::utils::app_links::app_links()?;
    serde_json::to_value(links).map_err(|e| e.to_string())
}
