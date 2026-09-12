use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub const CHUNK_RECORD_LIMIT: usize = 500;

#[derive(Debug, Clone)]
pub struct WebdavConfig {
    pub url: String,
    pub username: String,
    pub password: String,
    pub root_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebdavStatus {
    pub enabled: bool,
    pub configured: bool,
    pub auto_push: bool,
    pub auto_pull: bool,
    pub running: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SyncReport {
    pub pushed: u32,
    pub pulled: u32,
    pub errors: Vec<String>,
    pub pushed_clipboard: u32,
    pub pushed_favorites: u32,
    pub pushed_groups: u32,
    pub pulled_clipboard: u32,
    pub pulled_favorites: u32,
    pub pulled_groups: u32,
    pub pushed_items: Vec<SyncReportItem>,
    pub pulled_items: Vec<SyncReportItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncReportItem {
    pub category: String,
    pub id: String,
    pub summary: String,
    pub source_device_id: String,
    pub updated_at: i64,
}

impl CloudRecord {
    pub fn report_item(&self, category: &str) -> SyncReportItem {
        SyncReportItem {
            category: category.to_string(),
            id: self.uuid.clone(),
            summary: summarize_record(self),
            source_device_id: self.source_device_id.clone(),
            updated_at: self.updated_at,
        }
    }
}

fn summarize_record(record: &CloudRecord) -> String {
    let raw = if !record.title.trim().is_empty() {
        record.title.trim()
    } else {
        record.content.trim()
    };

    let mut summary = raw.chars().take(40).collect::<String>();
    if raw.chars().count() > 40 {
        summary.push('…');
    }
    summary
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SyncIndex {
    pub entries: HashMap<String, SyncIndexEntry>,
    pub next_chunk: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncIndexEntry {
    pub chunk: u32,
    pub updated_at: i64,
    pub source_device_id: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RecordChunk {
    pub records: HashMap<String, CloudRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudRecord {
    pub uuid: String,
    pub source_device_id: String,
    #[serde(default)]
    pub is_remote: bool,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub html_content: Option<String>,
    pub content_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_app: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_icon_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub char_count: Option<i64>,
    #[serde(default)]
    pub title: String,
    #[serde(default = "default_group_name")]
    pub group_name: String,
    #[serde(default)]
    pub item_order: i64,
    #[serde(default)]
    pub paste_count: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone)]
pub struct CloudRecordMeta {
    pub uuid: String,
    pub updated_at: i64,
    pub image_id: Option<String>,
}

fn default_group_name() -> String {
    "全部".to_string()
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct GroupList {
    pub groups: Vec<CloudGroup>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TombstoneList {
    #[serde(default)]
    pub tombstones: Vec<crate::services::database::SyncTombstone>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ImageFileIndex {
    #[serde(default)]
    pub images: HashMap<String, ImageFileIndexEntry>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ImageFileIndexEntry {
    pub uploaded_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudGroup {
    pub name: String,
    pub icon: String,
    pub color: String,
    pub order: i32,
    pub source_device_id: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Copy)]
pub enum SyncCollection {
    History,
    Favorites,
}

impl SyncCollection {
    pub fn dir(self) -> &'static str {
        match self {
            SyncCollection::History => "history",
            SyncCollection::Favorites => "favorites",
        }
    }
}
