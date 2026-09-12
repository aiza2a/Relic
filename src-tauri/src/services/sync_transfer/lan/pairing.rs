use serde::{Deserialize, Serialize};

use super::{DEFAULT_PAIRING_CODE_TTL_SECS, DEFAULT_PAIRING_MAX_ATTEMPTS};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PairingChallenge {
    pub pairing_code: String,
    pub expires_at_ms: i64,
    pub max_attempts: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PairingConfirmResponse {
    pub peer_token: String,
    pub expires_at_ms: Option<i64>,
}

pub fn create_pairing_challenge() -> PairingChallenge {
    PairingChallenge {
        pairing_code: format!("{:06}", fastrand::u32(0..1_000_000)),
        expires_at_ms: now_ms().saturating_add((DEFAULT_PAIRING_CODE_TTL_SECS as i64) * 1000),
        max_attempts: DEFAULT_PAIRING_MAX_ATTEMPTS,
    }
}

pub fn create_peer_token() -> String {
    uuid::Uuid::new_v4().to_string()
}

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}
