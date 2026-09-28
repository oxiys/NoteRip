// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Strip unnecessary Chromium background services to reduce memory footprint
    #[cfg(target_os = "windows")]
    {
        let existing = std::env::var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS").unwrap_or_default();
        let memory_flags = "--disable-features=Translate,OptimizationHints,MediaRouter,DialMediaRouteProvider --disable-component-update";
        let combined = if existing.is_empty() {
            memory_flags.to_string()
        } else {
            format!("{existing} {memory_flags}")
        };
        // SAFETY: Called single-threaded at process entry before initializing Tauri
        unsafe {
            std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", combined);
        }
    }

    app_lib::run();
}
