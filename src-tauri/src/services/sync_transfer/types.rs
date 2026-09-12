use serde::{Deserialize, Serialize};

/// 同步/传输入口支持的工作模式。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SyncMode {
    #[serde(rename = "webdav")]
    WebDav,
    Lan,
}

/// 具体的数据传输后端。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TransferBackend {
    WebDavStore,
    LanHttp,
}

/// 同步/传输页面逐步开放的能力。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SyncTransferFeature {
    Records,
    Files,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncTransferModeInfo {
    pub mode: SyncMode,
    pub backend: TransferBackend,
    pub features: Vec<SyncTransferFeature>,
    pub available: bool,
}

pub fn mode_infos() -> Vec<SyncTransferModeInfo> {
    vec![
        SyncTransferModeInfo {
            mode: SyncMode::WebDav,
            backend: TransferBackend::WebDavStore,
            features: vec![SyncTransferFeature::Records, SyncTransferFeature::Files],
            available: true,
        },
        SyncTransferModeInfo {
            mode: SyncMode::Lan,
            backend: TransferBackend::LanHttp,
            features: vec![SyncTransferFeature::Records, SyncTransferFeature::Files],
            available: true,
        },
    ]
}
