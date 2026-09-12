use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct LocalSyncState {
    pub last_upload_at: i64,
    pub last_download_at: i64,
}
