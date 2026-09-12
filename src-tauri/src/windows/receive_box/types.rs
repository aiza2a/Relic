use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReceiveBoxLanFile {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub sha256: String,
    pub source_device_id: String,
    pub source_device_name: String,
    pub received_at: i64,
    pub exists: bool,
    pub icon: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReceiveBoxLanFileProgress {
    pub transfer_id: String,
    pub name: String,
    pub received_bytes: u64,
    pub total_bytes: u64,
    pub source_device_id: String,
    pub source_device_name: String,
    pub status: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReceiveBoxCloudFile {
    pub id: String,
    pub name: String,
    pub size: u64,
    pub sha256: String,
    pub source_device_id: String,
    pub source_device_name: String,
    pub uploaded_at: i64,
    pub local_status: String,
    pub local_path: Option<String>,
    pub downloaded_at: i64,
    pub icon: Option<String>,
}
