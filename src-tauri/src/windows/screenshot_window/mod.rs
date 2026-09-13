// 截屏套件后端：移植自 0.4.x 开源历史版本的 screenshot 命令面
// 流程：抓取虚拟桌面 -> 本地 HTTP 服务出图 -> screenshot-ready 事件 -> 遮罩窗口框选/标注 -> 前端导出
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, AtomicU16, Ordering};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder};

use once_cell::sync::Lazy;
use parking_lot::Mutex;

static SCREENSHOT_WINDOW_VISIBLE: AtomicBool = AtomicBool::new(false);
static SERVER_STOP: AtomicBool = AtomicBool::new(true);
static SERVER_PORT: AtomicU16 = AtomicU16::new(0);
static SERVER_LISTENER: Lazy<Mutex<Option<TcpListener>>> = Lazy::new(|| Mutex::new(None));
static PNG_PAYLOAD: Lazy<Mutex<Vec<u8>>> = Lazy::new(|| Mutex::new(Vec::new()));

const OVERLAY_LABEL: &str = "screenshot";

// ---------- 几何辅助 ----------

// 虚拟桌面包围盒（物理像素）：(x, y, width, height)
fn virtual_desktop_bounds(app: &AppHandle) -> Result<(i32, i32, i32, i32), String> {
    let monitors = app
        .available_monitors()
        .map_err(|e| format!("获取显示器失败: {}", e))?;
    if monitors.is_empty() {
        return Err("未找到可用显示器".to_string());
    }
    let mut min_x = i32::MAX;
    let mut min_y = i32::MAX;
    let mut max_x = i32::MIN;
    let mut max_y = i32::MIN;
    for m in &monitors {
        let (x, y) = (m.position().x, m.position().y);
        let (w, h) = (m.size().width as i32, m.size().height as i32);
        min_x = min_x.min(x);
        min_y = min_y.min(y);
        max_x = max_x.max(x + w);
        max_y = max_y.max(y + h);
    }
    Ok((min_x, min_y, max_x - min_x, max_y - min_y))
}

// ---------- 抓屏 ----------

// 抓取整个虚拟桌面，返回 PNG 字节
fn capture_virtual_desktop(app: &AppHandle) -> Result<Vec<u8>, String> {
    let (vx, vy, vw, vh) = virtual_desktop_bounds(app)?;
    let screens = screenshots::Screen::all()
        .map_err(|e| format!("获取显示器信息失败: {}", e))?;
    if screens.is_empty() {
        return Err("未找到可用显示器".to_string());
    }

    let mut canvas = image::RgbaImage::new(vw as u32, vh as u32);
    for screen in &screens {
        let info = &screen.display_info;
        let shot = screen.capture().map_err(|e| format!("抓取屏幕失败: {}", e))?;
        let sx = info.x - vx;
        let sy = info.y - vy;
        for (px, py, pixel) in shot.enumerate_pixels() {
            let dx = sx + px as i32;
            let dy = sy + py as i32;
            if dx >= 0 && dy >= 0 && dx < vw && dy < vh {
                canvas.put_pixel(dx as u32, dy as u32, *pixel);
            }
        }
    }

    let mut png = Vec::new();
    let encoder = image::codecs::png::PngEncoder::new(std::io::Cursor::new(&mut png));
    image::ImageEncoder::write_image(
        encoder,
        canvas.as_raw(),
        canvas.width(),
        canvas.height(),
        image::ExtendedColorType::Rgba8,
    )
    .map_err(|e| format!("编码截图失败: {}", e))?;
    Ok(png)
}

// ---------- 本地 HTTP 出图服务 ----------

fn stop_server() {
    SERVER_STOP.store(true, Ordering::Relaxed);
    *SERVER_LISTENER.lock() = None;
    SERVER_PORT.store(0, Ordering::Relaxed);
}

fn handle_client(mut stream: TcpStream) {
    let mut buf = [0u8; 1024];
    let _ = stream.read(&mut buf);
    let payload = PNG_PAYLOAD.lock().clone();
    if payload.is_empty() {
        let _ = stream.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n");
        return;
    }
    let header = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: image/png\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n",
        payload.len()
    );
    let _ = stream.write_all(header.as_bytes());
    let _ = stream.write_all(&payload);
    let _ = stream.flush();
}

fn start_server(png: Vec<u8>) -> Result<String, String> {
    stop_server();
    *PNG_PAYLOAD.lock() = png;
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| format!("启动本地截图服务失败: {}", e))?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    SERVER_PORT.store(port, Ordering::Relaxed);
    *SERVER_LISTENER.lock() = Some(listener);
    SERVER_STOP.store(false, Ordering::Relaxed);

    std::thread::spawn(|| loop {
        if SERVER_STOP.load(Ordering::Relaxed) {
            break;
        }
        let guard = SERVER_LISTENER.lock();
        if let Some(listener) = guard.as_ref() {
            listener.set_nonblocking(true).ok();
            match listener.accept() {
                Ok((stream, _)) => {
                    drop(guard);
                    handle_client(stream);
                }
                Err(_) => {
                    drop(guard);
                    std::thread::sleep(std::time::Duration::from_millis(80));
                }
            }
        } else {
            break;
        }
    });

    Ok(format!("http://127.0.0.1:{}/screenshot.png", port))
}

// ---------- 窗口管理 ----------

fn ensure_overlay_window(app: &AppHandle) -> Result<tauri::WebviewWindow, String> {
    if let Some(window) = app.get_webview_window(OVERLAY_LABEL) {
        return Ok(window);
    }
    let window = WebviewWindowBuilder::new(
        app,
        OVERLAY_LABEL,
        WebviewUrl::App("windows/screenshot/index.html".into()),
    )
    .title("截图")
    .resizable(false)
    .maximizable(false)
    .minimizable(false)
    .decorations(false)
    .transparent(true)
    .shadow(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .focused(false)
    .visible(false)
    .drag_and_drop(false)
    .build()
    .map_err(|e| format!("创建截屏窗口失败: {}", e))?;
    Ok(window)
}

// 热键/托盘入口
pub fn start_screenshot_session(app: &AppHandle) -> Result<(), String> {
    if SCREENSHOT_WINDOW_VISIBLE.load(Ordering::Relaxed) {
        return Ok(());
    }
    let window = ensure_overlay_window(app)?;
    show_impl(app, &window)
}

fn show_impl(app: &AppHandle, window: &tauri::WebviewWindow) -> Result<(), String> {
    let (vx, vy, vw, vh) = virtual_desktop_bounds(app)?;
    window
        .set_size(PhysicalSize::new(vw as u32, vh as u32))
        .map_err(|e| format!("设置截屏窗口尺寸失败: {}", e))?;
    window
        .set_position(PhysicalPosition::new(vx, vy))
        .map_err(|e| format!("设置截屏窗口位置失败: {}", e))?;

    let png = capture_virtual_desktop(app)?;
    let capture_width = vw;
    let capture_height = vh;

    window
        .show()
        .map_err(|e| format!("显示截屏窗口失败: {}", e))?;
    window
        .set_focus()
        .map_err(|e| format!("聚焦截屏窗口失败: {}", e))?;
    SCREENSHOT_WINDOW_VISIBLE.store(true, Ordering::Relaxed);

    let window_for_data = window.clone();
    std::thread::spawn(move || match start_server(png) {
        Ok(image_url) => {
            let payload = serde_json::json!({
                "width": capture_width,
                "height": capture_height,
                "image_url": image_url,
            });
            let _ = window_for_data.emit("screenshot-ready", payload);
        }
        Err(_) => {
            let _ = window_for_data.emit("screenshot-error", "HTTP服务器启动失败");
        }
    });
    Ok(())
}

fn hide_impl(app: &AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window(OVERLAY_LABEL)
        .ok_or_else(|| "截屏窗口未找到".to_string())?;
    stop_server();
    let _ = window.set_position(PhysicalPosition::new(-10000, -10000));
    window
        .hide()
        .map_err(|e| format!("隐藏截屏窗口失败: {}", e))?;
    SCREENSHOT_WINDOW_VISIBLE.store(false, Ordering::Relaxed);
    let _ = window.eval("window.location.reload()");
    Ok(())
}

// ---------- Tauri 命令（与 0.4.x 前端 API 对齐） ----------

#[derive(serde::Serialize)]
pub struct CssMonitorInfo {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub is_primary: bool,
}

#[tauri::command]
pub fn get_css_monitors(window: tauri::WebviewWindow) -> Result<Vec<CssMonitorInfo>, String> {
    let app = window.app_handle().clone();
    let primary = app.primary_monitor().ok().flatten();
    let monitors = app
        .available_monitors()
        .map_err(|e| format!("获取显示器失败: {}", e))?;
    let mut result = Vec::new();
    for m in monitors {
        let scale = m.scale_factor();
        let (x, y) = (m.position().x as f64, m.position().y as f64);
        let (w, h) = (m.size().width as f64, m.size().height as f64);
        result.push(CssMonitorInfo {
            x: x / scale,
            y: y / scale,
            width: w / scale,
            height: h / scale,
            is_primary: primary
                .as_ref()
                .map(|p| p.label() == m.label())
                .unwrap_or(false),
        });
    }
    Ok(result)
}

#[tauri::command]
pub fn constrain_selection_bounds(
    window: tauri::WebviewWindow,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(f64, f64), String> {
    let app = window.app_handle().clone();
    let (vx, vy, vw, vh) = virtual_desktop_bounds(&app)?;
    let scale = window.scale_factor().unwrap_or(1.0);
    let (lx, ly) = (vx as f64 / scale, vy as f64 / scale);
    let (lw, lh) = (vw as f64 / scale, vh as f64 / scale);
    let cx = x.max(lx).min(lx + lw - width.min(lw));
    let cy = y.max(ly).min(ly + lh - height.min(lh));
    Ok((cx, cy))
}

#[tauri::command]
pub fn show_screenshot_window(app: AppHandle) -> Result<(), String> {
    if SCREENSHOT_WINDOW_VISIBLE.load(Ordering::Relaxed) {
        return Ok(());
    }
    let window = ensure_overlay_window(&app)?;
    show_impl(&app, &window)
}

#[tauri::command]
pub fn hide_screenshot_window(app: AppHandle) -> Result<(), String> {
    hide_impl(&app)
}

#[tauri::command]
pub fn set_cursor_position_physical(x: i32, y: i32) -> Result<(), String> {
    use windows::Win32::UI::WindowsAndMessaging::SetCursorPos;
    if unsafe { SetCursorPos(x, y) }.is_ok() {
        Ok(())
    } else {
        Err("设置鼠标位置失败".to_string())
    }
}

#[tauri::command]
pub fn get_settings(_app: AppHandle) -> Result<serde_json::Value, String> {
    let settings = crate::get_settings();
    serde_json::to_value(&settings).map_err(|e| format!("序列化设置失败: {}", e))
}

// 元素检测：预留桩，后续基于 UIA 移植
#[tauri::command]
pub fn start_auto_selection() -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub fn stop_auto_selection() -> Result<(), String> {
    Ok(())
}

// 长截图：预留桩，后续移植 image_stitcher + scrolling_screenshot
#[tauri::command]
pub fn init_scrolling_screenshot() -> Result<(), String> {
    Err("长截图功能移植中，敬请期待".to_string())
}

#[tauri::command]
pub fn start_scrolling_screenshot() -> Result<(), String> {
    Err("长截图功能移植中，敬请期待".to_string())
}

#[tauri::command]
pub fn pause_scrolling_screenshot() -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub fn resume_scrolling_screenshot() -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub fn stop_scrolling_screenshot() -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub fn cancel_scrolling_screenshot() -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub fn update_scrolling_panel_rect() -> Result<(), String> {
    Ok(())
}

// 贴图：接收前端导出的 PNG 字节，落盘后走现有贴图管线
#[tauri::command]
pub async fn create_pin_image_window(
    app: AppHandle,
    imageData: Vec<u8>,
    width: f64,
    height: f64,
    x: f64,
    y: f64,
) -> Result<(), String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("pin_images");
    std::fs::create_dir_all(&dir).map_err(|e| format!("创建贴图目录失败: {}", e))?;
    let path = dir.join(format!("pin_{}.png", chrono::Local::now().timestamp_millis()));
    std::fs::write(&path, &imageData).map_err(|e| format!("保存贴图失败: {}", e))?;
    let path_str = path.to_string_lossy().to_string();
    crate::windows::pin_image_window::pin_image_from_file(
        app,
        path_str,
        Some(x as i32),
        Some(y as i32),
        Some(width as u32),
        Some(height as u32),
        None,
        None,
        None,
        None,
        None,
        None,
        None,
    )
    .await
    .map_err(|e| format!("创建贴图窗口失败: {}", e))?;
    let _ = (width, height, x, y);
    Ok(())
}
