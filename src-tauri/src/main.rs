#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let is_maintenance = std::env::var("RELIC_MAINTENANCE").map_or(false, |v| v == "1")
        || std::env::args().any(|a| a == "--maintenance");

    if is_maintenance {
        relic_lib::install_startup_panic_hook();
        #[cfg(windows)]
        relic_lib::maintenance::ensure_console();
        relic_lib::maintenance::run();
        return;
    }

    relic_lib::install_startup_panic_hook();
    relic_lib::maintenance::ensure_bat_file();
    relic_lib::run();
}
