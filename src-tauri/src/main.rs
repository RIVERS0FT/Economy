mod commands;
mod save;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::save_game_state,
            commands::load_game_state,
            commands::clear_save,
            commands::get_app_version
        ])
        .run(tauri::generate_context!())
        .expect("error while running Economy Arena");
}

fn main() {
    run();
}
