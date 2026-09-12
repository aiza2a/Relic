// 原生菜单可见状态管理

use std::sync::atomic::{AtomicBool, Ordering};

static MENU_VISIBLE: AtomicBool = AtomicBool::new(false);

pub fn set_menu_visible(visible: bool) {
    MENU_VISIBLE.store(visible, Ordering::SeqCst);
}
