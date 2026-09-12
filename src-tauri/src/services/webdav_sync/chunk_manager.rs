use super::types::{RecordChunk, SyncCollection};
use super::webdav_client::WebdavClient;

pub fn chunk_path(collection: SyncCollection, chunk: u32) -> String {
    format!("{}/chunks/chunk_{:03}.json", collection.dir(), chunk)
}

pub async fn load_chunk(
    client: &WebdavClient,
    collection: SyncCollection,
    chunk: u32,
) -> Result<RecordChunk, String> {
    Ok(client
        .get_json(&chunk_path(collection, chunk))
        .await?
        .unwrap_or_default())
}

pub async fn save_chunk(
    client: &WebdavClient,
    collection: SyncCollection,
    chunk: u32,
    data: &RecordChunk,
) -> Result<(), String> {
    client.put_json(&chunk_path(collection, chunk), data).await
}
