use once_cell::sync::Lazy;
use uuid::Uuid;

const DEVICE_ID_KEY: &str = "sync_transfer_device_id";
const LEGACY_SYNC_TRANSFER_LAN_DEVICE_ID_KEY: &str = "sync_transfer_lan_device_id";

static DEVICE_ID: Lazy<String> = Lazy::new(load_or_create_device_id);

pub fn device_id() -> String {
    DEVICE_ID.clone()
}

fn load_or_create_device_id() -> String {
    if let Some(id) = stored_device_id(DEVICE_ID_KEY) {
        return id;
    }

    if let Some(id) = stored_device_id(LEGACY_SYNC_TRANSFER_LAN_DEVICE_ID_KEY) {
        let _ = crate::services::store::set(DEVICE_ID_KEY, &id);
        return id;
    }

    let id = Uuid::new_v4().to_string();
    let _ = crate::services::store::set(DEVICE_ID_KEY, &id);
    id
}

fn stored_device_id(key: &str) -> Option<String> {
    crate::services::store::get::<String>(key)
        .map(|id| id.trim().to_string())
        .filter(|id| !id.is_empty())
}
