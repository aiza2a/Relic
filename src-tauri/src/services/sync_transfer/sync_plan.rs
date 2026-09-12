use std::collections::HashMap;

use crate::services::webdav_sync::types::{CloudGroup, CloudRecordMeta};

pub fn record_metas_newer_than_remote(
    local_records: Vec<CloudRecordMeta>,
    remote_states: &HashMap<String, i64>,
) -> Vec<CloudRecordMeta> {
    local_records
        .into_iter()
        .filter(|record| {
            !record.uuid.trim().is_empty()
                && remote_states
                    .get(&record.uuid)
                    .map(|remote_updated_at| record.updated_at > *remote_updated_at)
                    .unwrap_or(true)
        })
        .collect()
}

pub fn groups_newer_than_remote(
    local_groups: Vec<CloudGroup>,
    remote_groups: &[CloudGroup],
) -> Vec<CloudGroup> {
    let remote_states = remote_groups
        .iter()
        .map(|group| (group.name.as_str(), group.updated_at))
        .collect::<HashMap<_, _>>();

    local_groups
        .into_iter()
        .filter(|group| {
            !group.name.trim().is_empty()
                && remote_states
                    .get(group.name.as_str())
                    .map(|remote_updated_at| group.updated_at > *remote_updated_at)
                    .unwrap_or(true)
        })
        .collect()
}
