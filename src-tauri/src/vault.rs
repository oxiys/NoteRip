use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileNode {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub extension: Option<String>,
    pub children: Option<Vec<FileNode>>,
    pub updated_at: Option<u64>,
    pub size: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitSyncResult {
    pub success: bool,
    pub message: String,
    pub files_changed: usize,
}

pub fn select_vault_folder() -> Option<String> {
    let dialog = rfd::FileDialog::new().set_title("Seleziona Cartella Vault (NoteRip)");
    let folder = dialog.pick_folder();
    folder.map(|p| p.to_string_lossy().to_string())
}

pub fn scan_directory(dir_path: &Path) -> Result<Vec<FileNode>, String> {
    if !dir_path.exists() || !dir_path.is_dir() {
        return Err(format!("Directory does not exist: {:?}", dir_path));
    }

    let mut nodes: Vec<FileNode> = Vec::new();
    let entries = fs::read_dir(dir_path).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let path = entry.path();
        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        // Skip hidden files and special directories
        if file_name.starts_with('.') {
            continue;
        }

        let metadata = entry.metadata().ok();
        let is_dir = metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false);
        let updated_at = metadata
            .as_ref()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64);
        let size = metadata.as_ref().map(|m| m.len());

        if is_dir {
            let children = scan_directory(&path).unwrap_or_default();
            nodes.push(FileNode {
                path: path.to_string_lossy().to_string(),
                name: file_name,
                is_dir: true,
                extension: None,
                children: Some(children),
                updated_at,
                size: None,
            });
        } else {
            let extension = path
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| e.to_lowercase());

            // Only track markdown and text files for the vault index
            if let Some(ref ext) = extension {
                if ext == "md" || ext == "markdown" || ext == "txt" {
                    nodes.push(FileNode {
                        path: path.to_string_lossy().to_string(),
                        name: file_name,
                        is_dir: false,
                        extension: Some(ext.clone()),
                        children: None,
                        updated_at,
                        size,
                    });
                }
            }
        }
    }

    // Sort: directories first, then alphabetical by name
    nodes.sort_by(|a, b| {
        if a.is_dir && !b.is_dir {
            std::cmp::Ordering::Less
        } else if !a.is_dir && b.is_dir {
            std::cmp::Ordering::Greater
        } else {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });

    Ok(nodes)
}

pub fn read_note_content(file_path: &str) -> Result<String, String> {
    fs::read_to_string(file_path).map_err(|e| format!("Failed to read file: {e}"))
}

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub fn create_silent_command<S: AsRef<std::ffi::OsStr>>(program: S) -> std::process::Command {
    let mut cmd = std::process::Command::new(program);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

pub fn write_note_content(file_path: &str, content: &str) -> Result<(), String> {
    let path = Path::new(file_path);
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("Impossibile creare le cartelle: {e}"))?;
        }
    }

    // Robust retry loop (5 attempts with exponential backoff)
    // Handles transient Windows Defender locks, search indexers, and file system latency
    let mut last_err = None;
    for attempt in 0..5 {
        // Try atomic write via temp file first
        let tmp_path = path.with_extension(format!("tmp.{}", std::process::id()));
        if let Ok(_) = fs::write(&tmp_path, content) {
            if fs::rename(&tmp_path, path).is_ok() {
                return Ok(());
            }
            let _ = fs::remove_file(&tmp_path);
        }

        // Fallback to direct write
        match fs::write(path, content) {
            Ok(_) => return Ok(()),
            Err(e) => {
                last_err = Some(e);
                std::thread::sleep(std::time::Duration::from_millis(60 * (attempt + 1) * (attempt + 1)));
            }
        }
    }

    let err = last_err.unwrap();
    let err_code = err.raw_os_error();
    if err_code == Some(5) {
        Err(format!(
            "Errore di scrittura: Accesso negato (Codice 5). Windows Defender o 'Accesso alle cartelle protetto' ha bloccato la scrittura su '{}'. Consenti l'applicazione NoteRip nelle impostazioni di Sicurezza di Windows o usa una cartella non protetta (es. C:\\NoteRip).",
            file_path
        ))
    } else {
        Err(format!("Errore scrittura file: {}", err))
    }
}

pub fn create_new_note(vault_path: &str, rel_path: &str, content: Option<&str>) -> Result<String, String> {
    let mut clean_rel = rel_path.trim().to_string();
    if !clean_rel.ends_with(".md") && !clean_rel.ends_with(".markdown") {
        clean_rel.push_str(".md");
    }

    let full_path = PathBuf::from(vault_path).join(clean_rel);

    if full_path.exists() {
        return Ok(full_path.to_string_lossy().to_string());
    }

    if let Some(parent) = full_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create folder: {e}"))?;
        }
    }

    let default_content = content.unwrap_or("");
    fs::write(&full_path, default_content).map_err(|e| format!("Failed to create note: {e}"))?;

    Ok(full_path.to_string_lossy().to_string())
}

pub fn create_new_folder(vault_path: &str, rel_path: &str) -> Result<String, String> {
    let clean_rel = rel_path.trim();
    let full_path = PathBuf::from(vault_path).join(clean_rel);
    fs::create_dir_all(&full_path).map_err(|e| format!("Failed to create folder: {e}"))?;
    Ok(full_path.to_string_lossy().to_string())
}

pub fn delete_note_file(file_path: &str) -> Result<(), String> {
    let path = Path::new(file_path);
    if !path.exists() {
        return Err("File does not exist".to_string());
    }

    if path.is_dir() {
        fs::remove_dir_all(path).map_err(|e| format!("Failed to remove directory: {e}"))
    } else {
        fs::remove_file(path).map_err(|e| format!("Failed to remove file: {e}"))
    }
}

pub fn rename_note_file(old_path: &str, new_path: &str) -> Result<(), String> {
    let source = Path::new(old_path);
    let target = Path::new(new_path);

    if !source.exists() {
        return Err("Source file does not exist".to_string());
    }

    if let Some(parent) = target.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create parent directory: {e}"))?;
        }
    }

    fs::rename(source, target).map_err(|e| format!("Failed to rename file: {e}"))
}

pub fn git_sync_repo(vault_path: &str, commit_message: Option<&str>) -> Result<GitSyncResult, String> {
    let path = Path::new(vault_path);
    if !path.exists() {
        return Err("Vault path does not exist".to_string());
    }

    // Check if git repository
    let git_dir = path.join(".git");
    if !git_dir.exists() {
        return Err("Vault is not a Git repository. Run 'git init' first.".to_string());
    }

    // 1. Git add .
    let add_status = create_silent_command("git")
        .arg("add")
        .arg(".")
        .current_dir(path)
        .output()
        .map_err(|e| format!("Failed to execute git add: {e}"))?;

    if !add_status.status.success() {
        return Err(String::from_utf8_lossy(&add_status.stderr).to_string());
    }

    // 2. Git status --porcelain
    let status_out = create_silent_command("git")
        .args(["status", "--porcelain"])
        .current_dir(path)
        .output()
        .map_err(|e| format!("Failed to execute git status: {e}"))?;

    let status_str = String::from_utf8_lossy(&status_out.stdout);
    let changed_lines = status_str.lines().count();

    if changed_lines == 0 {
        return Ok(GitSyncResult {
            success: true,
            message: "Nessuna modifica da sincronizzare".to_string(),
            files_changed: 0,
        });
    }

    // 3. Git commit
    let msg = commit_message.unwrap_or("Auto-sync notes via NoteRip");
    let commit_out = create_silent_command("git")
        .args(["commit", "-m", msg])
        .current_dir(path)
        .output()
        .map_err(|e| format!("Failed to execute git commit: {e}"))?;

    if !commit_out.status.success() {
        let err = String::from_utf8_lossy(&commit_out.stderr);
        return Err(format!("Commit failed: {err}"));
    }

    // 4. Git push (optional / silent attempt)
    let push_out = create_silent_command("git")
        .args(["push"])
        .current_dir(path)
        .output();

    let mut message = format!("Salvato commit con {changed_lines} file modificati.");
    match push_out {
        Ok(out) if out.status.success() => {
            message.push_str(" Push su remote completato con successo!");
        }
        Ok(out) => {
            let err_msg = String::from_utf8_lossy(&out.stderr);
            if !err_msg.trim().is_empty() {
                message.push_str(&format!(" (Push ignorato o in sospeso: {})", err_msg.trim()));
            }
        }
        Err(_) => {
            message.push_str(" (Git push non eseguito: nessun remote configurato)");
        }
    }

    Ok(GitSyncResult {
        success: true,
        message,
        files_changed: changed_lines,
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CodeRunResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
    pub execution_time_ms: u64,
}

pub fn run_code_snippet(lang: &str, code: &str) -> Result<CodeRunResult, String> {
    let start_time = std::time::Instant::now();
    let unique_id = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let temp_dir = std::env::temp_dir().join(format!("noterip_run_{unique_id}"));
    std::fs::create_dir_all(&temp_dir).map_err(|e| format!("Failed to create temp dir: {e}"))?;

    let result = match lang.to_lowercase().as_str() {
        "c" | "cpp" => {
            let src_file = temp_dir.join("main.c");
            let out_file = temp_dir.join("main.exe");
            std::fs::write(&src_file, code).map_err(|e| format!("Failed to write source: {e}"))?;

            let comp_res = create_silent_command("gcc")
                .args([src_file.to_str().unwrap(), "-o", out_file.to_str().unwrap()])
                .output();

            match comp_res {
                Ok(comp_out) => {
                    if !comp_out.status.success() {
                        let stderr = String::from_utf8_lossy(&comp_out.stderr).to_string();
                        return Ok(CodeRunResult {
                            success: false,
                            stdout: String::new(),
                            stderr: format!("Errore di compilazione GCC:\n{stderr}"),
                            exit_code: comp_out.status.code(),
                            execution_time_ms: start_time.elapsed().as_millis() as u64,
                        });
                    }

                    let run_out = create_silent_command(&out_file).output();
                    match run_out {
                        Ok(out) => Ok(CodeRunResult {
                            success: out.status.success(),
                            stdout: String::from_utf8_lossy(&out.stdout).to_string(),
                            stderr: String::from_utf8_lossy(&out.stderr).to_string(),
                            exit_code: out.status.code(),
                            execution_time_ms: start_time.elapsed().as_millis() as u64,
                        }),
                        Err(e) => Err(format!("Errore esecuzione binario C: {e}")),
                    }
                }
                Err(_) => {
                    let clang_res = create_silent_command("clang")
                        .args([src_file.to_str().unwrap(), "-o", out_file.to_str().unwrap()])
                        .output();
                    match clang_res {
                        Ok(comp_out) => {
                            if !comp_out.status.success() {
                                return Ok(CodeRunResult {
                                    success: false,
                                    stdout: String::new(),
                                    stderr: format!("Errore di compilazione Clang:\n{}", String::from_utf8_lossy(&comp_out.stderr)),
                                    exit_code: comp_out.status.code(),
                                    execution_time_ms: start_time.elapsed().as_millis() as u64,
                                });
                            }
                            let run_out = create_silent_command(&out_file).output();
                            match run_out {
                                Ok(out) => Ok(CodeRunResult {
                                    success: out.status.success(),
                                    stdout: String::from_utf8_lossy(&out.stdout).to_string(),
                                    stderr: String::from_utf8_lossy(&out.stderr).to_string(),
                                    exit_code: out.status.code(),
                                    execution_time_ms: start_time.elapsed().as_millis() as u64,
                                }),
                                Err(e) => Err(format!("Errore esecuzione binario: {e}")),
                            }
                        }
                        Err(_) => Ok(CodeRunResult {
                            success: false,
                            stdout: String::new(),
                            stderr: "Compilatore C non trovato (gcc o clang non presenti nel PATH).\nInstalla MinGW-w64 o Clang per compilare ed eseguire direttamente da NoteRip.".to_string(),
                            exit_code: Some(127),
                            execution_time_ms: start_time.elapsed().as_millis() as u64,
                        }),
                    }
                }
            }
        }
        "java" => {
            let class_name = code
                .lines()
                .find_map(|line| {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    for i in 0..parts.len() {
                        if (parts[i] == "class" || parts[i] == "record") && i + 1 < parts.len() {
                            let name = parts[i + 1].trim_matches(|c: char| !c.is_alphanumeric() && c != '_');
                            if !name.is_empty() {
                                return Some(name.to_string());
                            }
                        }
                    }
                    None
                })
                .unwrap_or_else(|| "Main".to_string());

            let src_file = temp_dir.join(format!("{class_name}.java"));
            std::fs::write(&src_file, code).map_err(|e| format!("Failed to write source: {e}"))?;

            let javac_res = create_silent_command("javac")
                .arg(&src_file)
                .current_dir(&temp_dir)
                .output();

            match javac_res {
                Ok(comp_out) => {
                    if !comp_out.status.success() {
                        return Ok(CodeRunResult {
                            success: false,
                            stdout: String::new(),
                            stderr: format!("Errore di compilazione Javac:\n{}", String::from_utf8_lossy(&comp_out.stderr)),
                            exit_code: comp_out.status.code(),
                            execution_time_ms: start_time.elapsed().as_millis() as u64,
                        });
                    }

                    let java_res = create_silent_command("java")
                        .arg(&class_name)
                        .current_dir(&temp_dir)
                        .output();

                    match java_res {
                        Ok(run_out) => Ok(CodeRunResult {
                            success: run_out.status.success(),
                            stdout: String::from_utf8_lossy(&run_out.stdout).to_string(),
                            stderr: String::from_utf8_lossy(&run_out.stderr).to_string(),
                            exit_code: run_out.status.code(),
                            execution_time_ms: start_time.elapsed().as_millis() as u64,
                        }),
                        Err(e) => Err(format!("Errore esecuzione Java: {e}")),
                    }
                }
                Err(_) => Ok(CodeRunResult {
                    success: false,
                    stdout: String::new(),
                    stderr: "Compilatore javac non trovato nel PATH.\nInstalla OpenJDK / Oracle JDK per compilare ed eseguire Java direttamente da NoteRip.".to_string(),
                    exit_code: Some(127),
                    execution_time_ms: start_time.elapsed().as_millis() as u64,
                }),
            }
        }
        _ => Err(format!("Linguaggio non supportato per l'esecuzione diretta: {lang}")),
    };

    let _ = std::fs::remove_dir_all(&temp_dir);
    result
}

