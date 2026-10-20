#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod context_files;
mod knowledge;
#[cfg(test)]
mod memory_smoke;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
#[cfg(unix)]
use std::os::unix::{fs::PermissionsExt, process::CommandExt};
use std::{
    collections::HashMap,
    io::{BufRead, BufReader, Write},
    path::PathBuf,
    process::{Child, ChildStdin, Command, Stdio},
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};
use tauri::{ipc::Channel, Manager, State};
use tokio::sync::oneshot;

type Pending = Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value, String>>>>>;
#[derive(Default)]
struct Worker {
    child: Mutex<Option<Child>>,
    input: Arc<Mutex<Option<ChildStdin>>>,
    channel: Arc<Mutex<Option<Channel<Value>>>>,
    pending: Pending,
    sequence: AtomicU64,
}

impl Worker {
    fn write(&self, value: &Value) -> Result<(), String> {
        let mut input = self.input.lock().map_err(|_| "Browser input unavailable")?;
        let pipe = input.as_mut().ok_or("The browser service is not running")?;
        writeln!(pipe, "{}", value).map_err(|e| e.to_string())?;
        pipe.flush().map_err(|e| e.to_string())
    }
    fn stop(&self) {
        let _ = self.write(&json!({"action":"shutdown"}));
        if let Ok(mut slot) = self.child.lock() {
            if let Some(mut child) = slot.take() {
                for _ in 0..120 {
                    if matches!(child.try_wait(), Ok(Some(_))) {
                        return;
                    }
                    std::thread::sleep(Duration::from_millis(50));
                }
                let _ = child.kill();
                #[cfg(unix)]
                unsafe {
                    libc::kill(-(child.id() as i32), libc::SIGKILL);
                }
                let _ = child.wait();
            }
        }
    }
}

fn worker_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let resource = app
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?
        .join("worker/main.mjs");
    if resource.exists() {
        return Ok(resource);
    }
    let development = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../worker/main.mjs");
    if development.exists() {
        return Ok(development);
    }
    Err("The bundled browser service could not be found".into())
}

#[tauri::command]
fn start_browser(
    app: tauri::AppHandle,
    worker: State<'_, Worker>,
    on_event: Channel<Value>,
) -> Result<(), String> {
    *worker
        .channel
        .lock()
        .map_err(|_| "Browser channel unavailable")? = Some(on_event);
    let mut child_slot = worker
        .child
        .lock()
        .map_err(|_| "Browser process unavailable")?;
    if let Some(child) = child_slot.as_mut() {
        if matches!(child.try_wait(), Ok(None)) {
            return Ok(());
        }
    }
    let node = [
        "/opt/homebrew/bin/node",
        "/usr/local/bin/node",
        "/usr/bin/node",
    ]
    .into_iter()
    .find(|p| PathBuf::from(p).exists())
    .unwrap_or("node");
    let script = worker_path(&app)?;
    let data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&data).map_err(|e| e.to_string())?;
    let mut process = Command::new(node);
    #[cfg(unix)]
    process.process_group(0);
    let mut child = process
        .arg(&script)
        .arg(&data)
        .current_dir(script.parent().unwrap())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            format!("Could not start the browser service. Node.js must be installed. {e}")
        })?;
    *worker
        .input
        .lock()
        .map_err(|_| "Browser input unavailable")? = child.stdin.take();
    let output = child.stdout.take().ok_or("No browser output")?;
    let errors = child.stderr.take().ok_or("No browser diagnostics")?;
    let channel = worker.channel.clone();
    let pending = worker.pending.clone();
    let worker_pid = child.id();
    let host = app.clone();
    let replies = worker.input.clone();
    std::thread::spawn(move || {
        for line in BufReader::new(output).lines().map_while(Result::ok) {
            let Ok(value) = serde_json::from_str::<Value>(&line) else {
                continue;
            };
            if value["type"] == "knowledge" {
                let result = host
                    .state::<Mutex<knowledge::Knowledge>>()
                    .lock()
                    .map_err(|_| "Knowledge store unavailable".to_string())
                    .and_then(|mut store| store.host(value["request"].clone()));
                let reply = match result {
                    Ok(result) => {
                        json!({"action":"knowledgeReply","requestId":value["requestId"],"result":result})
                    }
                    Err(error) => {
                        json!({"action":"knowledgeReply","requestId":value["requestId"],"error":error})
                    }
                };
                if let Ok(mut input) = replies.lock() {
                    if let Some(pipe) = input.as_mut() {
                        let _ = writeln!(pipe, "{}", reply);
                        let _ = pipe.flush();
                    }
                }
            } else if value["type"] == "reply" {
                if let Some(id) = value["id"].as_u64() {
                    if let Ok(mut waiting) = pending.lock() {
                        if let Some(sender) = waiting.remove(&id) {
                            let result = if value["ok"] == true {
                                Ok(value["result"].clone())
                            } else {
                                Err(value["error"]
                                    .as_str()
                                    .unwrap_or("Browser action failed")
                                    .to_owned())
                            };
                            let _ = sender.send(result);
                        }
                    }
                }
            } else if let Ok(slot) = channel.lock() {
                if let Some(ch) = slot.as_ref() {
                    let _ = ch.send(value);
                }
            }
        }
        if let Ok(mut store) = host.state::<Mutex<knowledge::Knowledge>>().lock() {
            store.clear_runs();
        }
        // The browser worker and official CLI children share a process group.
        // If the worker crashes, no model run is left without an owner.
        #[cfg(unix)]
        unsafe {
            libc::kill(-(worker_pid as i32), libc::SIGKILL);
        }
        if let Ok(mut waiting) = pending.lock() {
            for (_, sender) in waiting.drain() {
                let _ = sender.send(Err("The browser service stopped".into()));
            }
        }
        if let Ok(slot) = channel.lock() {
            if let Some(ch) = slot.as_ref() {
                let _ = ch.send(json!({"type":"offline","message":"The browser service stopped. Relaunch Worklive to reconnect."}));
            }
        }
    });
    std::thread::spawn(move || {
        for line in BufReader::new(errors).lines().map_while(Result::ok) {
            eprintln!("[Worklive browser] {line}");
        }
    });
    *child_slot = Some(child);
    Ok(())
}

#[tauri::command]
async fn browser_command(worker: State<'_, Worker>, mut command: Value) -> Result<Value, String> {
    if !command.is_object() {
        return Err("Invalid browser action".into());
    }
    let id = worker.sequence.fetch_add(1, Ordering::Relaxed);
    command["id"] = json!(id);
    let (sender, receiver) = oneshot::channel();
    worker
        .pending
        .lock()
        .map_err(|_| "Browser queue unavailable")?
        .insert(id, sender);
    if let Err(e) = worker.write(&command) {
        worker.pending.lock().ok().map(|mut p| p.remove(&id));
        return Err(e);
    }
    let result = tokio::time::timeout(Duration::from_secs(50), receiver).await;
    worker.pending.lock().ok().map(|mut p| p.remove(&id));
    match result {
        Ok(Ok(value)) => value,
        Ok(Err(_)) => Err("Browser response was interrupted".into()),
        Err(_) => Err("Browser action timed out".into()),
    }
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
enum Provider {
    Codex,
    Claude,
}
impl Default for Provider {
    fn default() -> Self {
        Self::Codex
    }
}

#[derive(Serialize, Deserialize)]
struct Agent {
    id: String,
    name: String,
    role: String,
    personality: String,
    task: String,
    color: String,
    #[serde(default)]
    provider: Provider,
}

#[tauri::command]
fn load_agents(app: tauri::AppHandle) -> Result<Vec<Agent>, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("agents.json");
    if !path.exists() {
        return Ok(vec![]);
    }
    serde_json::from_slice(&std::fs::read(path).map_err(|e| e.to_string())?)
        .map_err(|e| format!("Could not read saved agents: {e}"))
}

#[tauri::command]
fn save_agents(app: tauri::AppHandle, agents: Vec<Agent>) -> Result<(), String> {
    if agents.len() > 6
        || agents.iter().any(|a| {
            a.id.len() > 64
                || !a
                    .id
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
                || a.name.len() > 120
                || a.role.len() > 120
                || a.personality.len() > 2000
                || a.task.len() > 4000
                || a.color.len() > 12
        })
    {
        return Err("Invalid agent details".into());
    }
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let temp = dir.join("agents.pending.json");
    std::fs::write(
        &temp,
        serde_json::to_vec_pretty(&agents).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    std::fs::rename(temp, dir.join("agents.json")).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_artifact(app: tauri::AppHandle, run_id: String, name: String) -> Result<(), String> {
    if run_id.len() != 36
        || !run_id.chars().all(|c| c.is_ascii_hexdigit() || c == '-')
        || name.contains('/')
        || name.contains('\\')
        || name.contains("..")
        || ![".md", ".txt", ".csv"]
            .iter()
            .any(|ext| name.ends_with(ext))
    {
        return Err("Invalid output reference".into());
    }
    let root = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("runs")
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let file = root
        .join(run_id)
        .join("outputs")
        .join(name)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    if !file.starts_with(&root) || !file.is_file() {
        return Err("Output is outside Worklive".into());
    }
    Command::new("/usr/bin/open")
        .arg("--")
        .arg(file)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn open_provider_terminal(app: tauri::AppHandle, provider: Provider) -> Result<(), String> {
    let name = match provider {
        Provider::Codex => "codex",
        Provider::Claude => "claude",
    };
    let home = app.path().home_dir().map_err(|e| e.to_string())?;
    let binary = [
        home.join(".local/bin").join(name),
        PathBuf::from("/opt/homebrew/bin").join(name),
        PathBuf::from("/usr/local/bin").join(name),
    ]
    .into_iter()
    .find(|p| p.is_file())
    .ok_or("Install the official command-line tool first.")?;
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(format!("login-{name}.command"));
    let quoted = format!("'{}'", binary.to_string_lossy().replace('\'', "'\\''"));
    let command = format!("#!/bin/zsh\n# Sign in through the official tool. Worklive never handles credentials.\nexec /usr/bin/env -u OPENAI_API_KEY -u CODEX_API_KEY -u ANTHROPIC_API_KEY -u ANTHROPIC_AUTH_TOKEN {quoted}{}\n", if name == "codex" { " login" } else { "" });
    std::fs::write(&path, command).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o700))
        .map_err(|e| e.to_string())?;
    Command::new("/usr/bin/open")
        .args(["-a", "Terminal"])
        .arg(path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn knowledge_command(
    store: State<'_, Mutex<knowledge::Knowledge>>,
    command: Value,
) -> Result<Value, String> {
    store
        .lock()
        .map_err(|_| "Knowledge store unavailable")?
        .desktop(command)
}
#[tauri::command]
async fn import_context_file(
    app: tauri::AppHandle,
    agent_id: String,
    scope: String,
    name: String,
    bytes: Vec<u8>,
) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
        let extracted = context_files::isolated_extract(&dir, &name, &bytes)?;
        app.state::<Mutex<knowledge::Knowledge>>()
            .lock()
            .map_err(|_| "Knowledge store unavailable")?
            .import(&agent_id, &scope, &name, &bytes, extracted)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn import_context_path(
    app: tauri::AppHandle,
    agent_id: String,
    scope: String,
    path: String,
) -> Result<Value, String> {
    let file = PathBuf::from(path);
    let size = std::fs::metadata(&file).map_err(|e| e.to_string())?;
    if !size.is_file() || size.len() > context_files::MAX_BYTES as u64 {
        return Err("Choose a file up to 10 MB.".into());
    }
    let name = file
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or("Invalid file name")?
        .to_owned();
    context_files::extension(&name)?;
    let mut bytes = Vec::new();
    std::io::Read::read_to_end(
        &mut std::io::Read::take(
            std::fs::File::open(file).map_err(|e| e.to_string())?,
            context_files::MAX_BYTES as u64 + 1,
        ),
        &mut bytes,
    )
    .map_err(|e| e.to_string())?;
    if bytes.len() > context_files::MAX_BYTES {
        return Err("Choose a file up to 10 MB.".into());
    }
    import_context_file(app, agent_id, scope, name, bytes).await
}

fn main() {
    if context_files::run_helper() {
        return;
    }
    tauri::Builder::default()
        .manage(Worker::default())
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let file = dir.join("knowledge.sqlite");
            let store = knowledge::Knowledge::open(&file).map_err(std::io::Error::other)?;
            #[cfg(unix)]
            std::fs::set_permissions(&file, std::fs::Permissions::from_mode(0o600))?;
            app.manage(Mutex::new(store));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_browser,
            browser_command,
            load_agents,
            save_agents,
            open_artifact,
            open_provider_terminal,
            knowledge_command,
            import_context_file,
            import_context_path
        ])
        .build(tauri::generate_context!())
        .expect("Could not start Worklive")
        .run(|app, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                app.state::<Worker>().stop();
            }
        });
}
