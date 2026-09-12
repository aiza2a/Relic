use once_cell::sync::Lazy;
use parking_lot::Mutex;

static MOUSE_POSITION: Lazy<Mutex<(f64, f64)>> = Lazy::new(|| Mutex::new((0.0, 0.0)));

// 获取鼠标位置
#[cfg(target_os = "windows")]
pub fn get_cursor_position() -> (i32, i32) {
    use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;
    use windows::Win32::Foundation::POINT;
    
    let mut point = POINT { x: 0, y: 0 };
    unsafe {
        if GetCursorPos(&mut point).is_ok() {
            return (point.x, point.y);
        }
    }
    let pos = MOUSE_POSITION.lock();
    (pos.0 as i32, pos.1 as i32)
}

#[cfg(not(target_os = "windows"))]
pub fn get_cursor_position() -> (i32, i32) {
    if let Ok(pos) = get_system_cursor_position() {
        return pos;
    }
    let pos = MOUSE_POSITION.lock();
    (pos.0 as i32, pos.1 as i32)
}

#[cfg(not(target_os = "windows"))]
fn get_system_cursor_position() -> Result<(i32, i32), String> {
    use enigo::{Enigo, Mouse, Settings};
    
    let enigo = Enigo::new(&Settings::default())
        .map_err(|e| format!("初始化失败: {}", e))?;
    
    let (x, y) = enigo.location()
        .map_err(|e| format!("获取位置失败: {}", e))?;
    
    Ok((x, y))
}

// 更新鼠标位置
pub fn update_cursor_position(x: f64, y: f64) {
    let mut pos = MOUSE_POSITION.lock();
    *pos = (x, y);
}

// 设置鼠标位置
pub fn set_cursor_position(x: i32, y: i32) -> Result<(), String> {
    use enigo::{Enigo, Mouse, Settings};
    
    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|e| format!("初始化输入控制器失败: {}", e))?;
    
    enigo.move_mouse(x, y, enigo::Coordinate::Abs)
        .map_err(|e| format!("设置鼠标位置失败: {}", e))?;
    
    update_cursor_position(x as f64, y as f64);
    Ok(())
}

// 模拟鼠标滚轮
pub fn simulate_scroll(delta: i32) -> Result<(), String> {
    use enigo::{Enigo, Mouse, Settings, Axis};
    
    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|e| format!("初始化输入控制器失败: {}", e))?;
    
    enigo.scroll(delta, Axis::Vertical)
        .map_err(|e| format!("模拟滚轮失败: {}", e))?;
    
    Ok(())
}

// 模拟精细滚轮
#[cfg(target_os = "windows")]
pub fn simulate_scroll_raw(delta: i32) -> Result<(), String> {
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_MOUSE, MOUSEINPUT, MOUSEEVENTF_WHEEL,
    };
    
    let input = INPUT {
        r#type: INPUT_MOUSE,
        Anonymous: windows::Win32::UI::Input::KeyboardAndMouse::INPUT_0 {
            mi: MOUSEINPUT {
                dx: 0,
                dy: 0,
                mouseData: delta as u32,
                dwFlags: MOUSEEVENTF_WHEEL,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };
    
    let result = unsafe { SendInput(&[input], std::mem::size_of::<INPUT>() as i32) };
    
    if result == 0 {
        Err("SendInput 失败".to_string())
    } else {
        Ok(())
    }
}

#[cfg(not(target_os = "windows"))]
pub fn simulate_scroll_raw(delta: i32) -> Result<(), String> {
    // 非 Windows 平台回退到普通滚动
    simulate_scroll(delta / 120)
}

