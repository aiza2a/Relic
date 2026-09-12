// 截图会话服务：抓取主显示器画面并保存临时 PNG，供遮罩窗口选区使用
use image::ImageFormat;
use once_cell::sync::Lazy;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenshotSession {
    pub path: String,
    pub width: u32,
    pub height: u32,
}

static CURRENT_SESSION: Lazy<Mutex<Option<ScreenshotSession>>> = Lazy::new(|| Mutex::new(None));
static SESSION_SEQ: AtomicU64 = AtomicU64::new(1);

fn screenshots_dir() -> Result<PathBuf, String> {
    let dir = crate::get_data_directory()?.join("screenshots");
    std::fs::create_dir_all(&dir).map_err(|e| format!("创建截图目录失败: {}", e))?;
    Ok(dir)
}

pub fn capture_monitor_at(monitor_x: i32, monitor_y: i32) -> Result<ScreenshotSession, String> {
    let screens = screenshots::Screen::all()
        .map_err(|e| format!("获取显示器信息失败: {}", e))?;
    let screen = screens
        .into_iter()
        .find(|s| s.display_info.x == monitor_x && s.display_info.y == monitor_y)
        .ok_or_else(|| "未找到主显示器对应的屏幕".to_string())?;
    let captured = screen
        .capture()
        .map_err(|e| format!("抓取屏幕失败: {}", e))?;
    let width = captured.width();
    let height = captured.height();
    // screenshots crate 内嵌旧版 image，这里转为本项目的图像类型后再保存
    let image = image::RgbaImage::from_raw(width, height, captured.into_raw())
        .ok_or_else(|| "转换截图数据失败".to_string())?;

    let dir = screenshots_dir()?;
    let seq = SESSION_SEQ.fetch_add(1, Ordering::Relaxed);
    let path = dir.join(format!("shot_{}_{}.png", chrono::Local::now().timestamp_millis(), seq));
    image
        .save_with_format(&path, ImageFormat::Png)
        .map_err(|e| format!("保存截图失败: {}", e))?;

    let session = ScreenshotSession {
        path: path.to_string_lossy().to_string(),
        width,
        height,
    };
    *CURRENT_SESSION.lock() = Some(session.clone());
    Ok(session)
}

pub fn take_session() -> Option<ScreenshotSession> {
    CURRENT_SESSION.lock().take()
}

pub fn peek_session() -> Option<ScreenshotSession> {
    CURRENT_SESSION.lock().clone()
}

// 按选区（图像物理像素）裁剪并复制到剪贴板，返回裁剪文件路径
pub fn crop_and_copy(session: &ScreenshotSession, x: i32, y: i32, width: i32, height: i32) -> Result<String, String> {
    if width <= 0 || height <= 0 {
        return Err("选区尺寸无效".to_string());
    }
    let x = x.clamp(0, session.width as i32 - 1);
    let y = y.clamp(0, session.height as i32 - 1);
    let width = width.clamp(1, session.width as i32 - x);
    let height = height.clamp(1, session.height as i32 - y);

    let image = image::open(&session.path).map_err(|e| format!("读取截图失败: {}", e))?;
    let cropped = image::imageops::crop_imm(
        &image,
        x as u32,
        y as u32,
        width as u32,
        height as u32,
    )
    .to_image();

    let dir = screenshots_dir()?;
    let out = dir.join(format!(
        "crop_{}_{}.png",
        chrono::Local::now().timestamp_millis(),
        SESSION_SEQ.fetch_add(1, Ordering::Relaxed)
    ));
    cropped
        .save_with_format(&out, ImageFormat::Png)
        .map_err(|e| format!("保存裁剪结果失败: {}", e))?;
    let out_str = out.to_string_lossy().to_string();

    crate::commands::clipboard::copy_image_to_clipboard(out_str.clone())?;

    // 清理临时文件（原图与裁剪图已进入剪贴板）
    let _ = std::fs::remove_file(&session.path);
    let _ = std::fs::remove_file(&out);
    Ok(out_str)
}

pub fn discard_session() {
    if let Some(session) = CURRENT_SESSION.lock().take() {
        let _ = std::fs::remove_file(&session.path);
    }
}
