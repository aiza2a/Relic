#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let is_maintenance = std::env::var("QUICKCLIPBOARD_MAINTENANCE").map_or(false, |v| v == "1")
        || std::env::args().any(|a| a == "--maintenance");

    if is_maintenance {
        quickclipboard_lib::install_startup_panic_hook();
        #[cfg(windows)]
        quickclipboard_lib::maintenance::ensure_console();
        quickclipboard_lib::maintenance::run();
        return;
    }

    quickclipboard_lib::install_startup_panic_hook();
    quickclipboard_lib::maintenance::ensure_bat_file();
    quickclipboard_lib::run();
}
