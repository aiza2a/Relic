use std::sync::atomic::{AtomicBool, Ordering};

// 快捷粘贴窗口可见性状态
pub static QUICKPASTE_VISIBLE: AtomicBool = AtomicBool::new(false);

// 初始化快捷粘贴窗口状态
pub fn init_quickpaste_state() {
    QUICKPASTE_VISIBLE.store(false, Ordering::SeqCst);
}

// 检查窗口是否可见
pub fn is_visible() -> bool {
    QUICKPASTE_VISIBLE.load(Ordering::SeqCst)
}

// 设置窗口可见性
pub fn set_visible(visible: bool) {
    QUICKPASTE_VISIBLE.store(visible, Ordering::SeqCst);
}
