mod vault;

use std::path::Path;
use vault::{CodeRunResult, FileNode, GitSyncResult};

#[tauri::command]
fn run_code(lang: String, code: String) -> Result<CodeRunResult, String> {
    vault::run_code_snippet(&lang, &code)
}

#[tauri::command]
fn select_vault() -> Result<Option<String>, String> {
    Ok(vault::select_vault_folder())
}

#[tauri::command]
fn scan_vault(vault_path: String) -> Result<Vec<FileNode>, String> {
    vault::scan_directory(Path::new(&vault_path))
}

#[tauri::command]
fn read_note(file_path: String) -> Result<String, String> {
    vault::read_note_content(&file_path)
}

#[tauri::command]
fn write_note(file_path: String, content: String) -> Result<(), String> {
    vault::write_note_content(&file_path, &content)
}

#[tauri::command]
fn create_note(
    vault_path: String,
    rel_path: String,
    content: Option<String>,
) -> Result<String, String> {
    vault::create_new_note(&vault_path, &rel_path, content.as_deref())
}

#[tauri::command]
fn create_folder(vault_path: String, rel_path: String) -> Result<String, String> {
    vault::create_new_folder(&vault_path, &rel_path)
}

#[tauri::command]
fn delete_note(file_path: String) -> Result<(), String> {
    vault::delete_note_file(&file_path)
}

#[tauri::command]
fn rename_note(old_path: String, new_path: String) -> Result<(), String> {
    vault::rename_note_file(&old_path, &new_path)
}

#[tauri::command]
fn git_sync_vault(vault_path: String, commit_msg: Option<String>) -> Result<GitSyncResult, String> {
    vault::git_sync_repo(&vault_path, commit_msg.as_deref())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            select_vault,
            scan_vault,
            read_note,
            write_note,
            create_note,
            create_folder,
            delete_note,
            rename_note,
            git_sync_vault,
            run_code
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
