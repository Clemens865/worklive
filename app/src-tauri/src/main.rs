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

/// Workspaces: "studio" (the Worklive office) keeps the app data folder exactly as before;
/// "deck7" (the robot crew) gets its own folder, so agents, runs, chats, knowledge, projects,
/// files and browser profiles are fully separate. The choice lives in `<app data>/workspace.txt`.
const WORKSPACES: [&str; 2] = ["studio", "deck7"];
fn workspace_of(base: &std::path::Path) -> String {
    std::fs::read_to_string(base.join("workspace.txt"))
        .map(|s| s.trim().to_string())
        .ok()
        .filter(|s| WORKSPACES.contains(&s.as_str()))
        .unwrap_or_else(|| "studio".into())
}
fn data_dir_for<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<PathBuf> {
    let base = app.path().app_data_dir()?;
    Ok(if workspace_of(&base) == "deck7" { base.join("workspaces").join("deck7") } else { base })
}

#[tauri::command]
fn get_workspace(app: tauri::AppHandle) -> Result<String, String> {
    Ok(workspace_of(&app.path().app_data_dir().map_err(|e| e.to_string())?))
}

/// Switch workspace and restart, so every store (knowledge, worker, browsers) opens the other folder.
#[tauri::command]
fn set_workspace(app: tauri::AppHandle, workspace: String) -> Result<(), String> {
    if !WORKSPACES.contains(&workspace.as_str()) {
        return Err("Unknown workspace".into());
    }
    let base = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    std::fs::write(base.join("workspace.txt"), &workspace).map_err(|e| e.to_string())?;
    app.restart();
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
    let data = data_dir_for(&app).map_err(|e| e.to_string())?;
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
    // 0.9: office desk, saved character look and personality traits. All optional so 0.8 files still load.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    desk: Option<u8>,
    #[serde(rename = "lookSeed", default, skip_serializing_if = "Option::is_none")]
    look_seed: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    look: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    traits: Vec<String>,
}

/// Office capacity: 24 desk slots (the office grows pair by pair).
const MAX_AGENTS: usize = 24;
const TRAITS: [&str; 6] = ["coffee", "lounge", "nature", "books", "chatty", "focused"];

fn valid_agents(agents: &[Agent]) -> bool {
    let mut desks = std::collections::HashSet::new();
    agents.len() <= MAX_AGENTS
        && agents.iter().all(|a| {
            a.id.len() <= 64
                && a.id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
                && a.name.len() <= 120
                && a.role.len() <= 120
                && a.personality.len() <= 2000
                && a.task.len() <= 4000
                && a.color.len() <= 12
                && a.desk.map_or(true, |d| (d as usize) < MAX_AGENTS && desks.insert(d))
                && a.look_seed.as_ref().map_or(true, |s| s.len() <= 64)
                && a.look.as_ref().map_or(true, |l| l.is_object() && l.to_string().len() <= 2048)
                && a.traits.len() <= 4
                && a.traits.iter().all(|t| TRAITS.contains(&t.as_str()))
        })
}

#[tauri::command]
fn load_agents(app: tauri::AppHandle) -> Result<Vec<Agent>, String> {
    let path = data_dir_for(&app)
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
    if !valid_agents(&agents) {
        return Err("Invalid agent details".into());
    }
    let dir = data_dir_for(&app).map_err(|e| e.to_string())?;
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
    let root = data_dir_for(&app)
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

/// A link the user clicked in a rendered document opens in their default browser (public web links only).
#[tauri::command]
fn open_link(url: String) -> Result<(), String> {
    let ok = (url.starts_with("https://") || url.starts_with("http://"))
        && url.len() <= 2000
        && !url.chars().any(|c| c.is_control() || c.is_whitespace());
    if !ok {
        return Err("Only web links (http or https) can be opened.".into());
    }
    Command::new("/usr/bin/open")
        .arg("--")
        .arg(url)
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
    let dir = data_dir_for(&app).map_err(|e| e.to_string())?;
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
        let dir = data_dir_for(&app).map_err(|e| e.to_string())?;
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
#[tauri::command]
async fn import_task_file(
    app: tauri::AppHandle,
    task_id: String,
    revision: i64,
    name: String,
    bytes: Vec<u8>,
) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let dir = data_dir_for(&app).map_err(|e| e.to_string())?;
        let extracted = context_files::isolated_extract(&dir, &name, &bytes)?;
        app.state::<Mutex<knowledge::Knowledge>>()
            .lock()
            .map_err(|_| "Knowledge store unavailable")?
            .import_task_file(&task_id, revision, &name, &bytes, extracted)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn import_task_path(
    app: tauri::AppHandle,
    task_id: String,
    revision: i64,
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
    import_task_file(app, task_id, revision, name, bytes).await
}

#[tauri::command]
fn task_file_command(
    store: State<'_, Mutex<knowledge::Knowledge>>,
    command: Value,
) -> Result<Value, String> {
    store
        .lock()
        .map_err(|_| "Knowledge store unavailable")?
        .task_file_command(command)
}

fn main() {
    if context_files::run_helper() {
        return;
    }
    tauri::Builder::default()
        .manage(Worker::default())
        .setup(|app| {
            let dir = data_dir_for(app.handle())?;
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
            get_workspace,
            set_workspace,
            open_artifact,
            open_link,
            open_provider_terminal,
            knowledge_command,
            import_context_file,
            import_context_path,
            import_task_file,
            import_task_path,
            task_file_command
        ])
        .build(tauri::generate_context!())
        .expect("Could not start Worklive")
        .run(|app, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                app.state::<Worker>().stop();
            }
        });
}

#[cfg(test)]
mod agent_file_tests {
    use super::*;

    #[test]
    fn loads_agents_saved_by_0_8() {
        let old = r##"[{"id":"ada","name":"Ada","role":"Researcher","personality":"Curious","task":"","color":"#aec49a","provider":"codex"}]"##;
        let agents: Vec<Agent> = serde_json::from_str(old).unwrap();
        assert_eq!(agents[0].desk, None);
        assert!(agents[0].look.is_none() && agents[0].look_seed.is_none() && agents[0].traits.is_empty());
        assert!(valid_agents(&agents));
        // Saving an old agent again writes no new keys.
        let saved = serde_json::to_string(&agents).unwrap();
        assert!(!saved.contains("desk") && !saved.contains("lookSeed") && !saved.contains("traits"));
    }

    #[test]
    fn keeps_desk_look_and_traits() {
        let new = r##"[{"id":"agent-1","name":"Noor","role":"Analyst","personality":"","task":"","color":"#aec49a","provider":"claude",
            "desk":13,"lookSeed":"k3j","look":{"hair":"afro","skin":4,"glasses":null},"traits":["coffee","chatty"]}]"##;
        let agents: Vec<Agent> = serde_json::from_str(new).unwrap();
        assert!(valid_agents(&agents));
        let again: Vec<Agent> = serde_json::from_str(&serde_json::to_string(&agents).unwrap()).unwrap();
        assert_eq!(again[0].desk, Some(13));
        assert_eq!(again[0].look_seed.as_deref(), Some("k3j"));
        assert_eq!(again[0].look.as_ref().unwrap()["hair"], "afro");
        assert_eq!(again[0].traits, vec!["coffee", "chatty"]);
    }

    #[test]
    fn rejects_bad_office_data() {
        let agent = |id: &str, desk: Option<u8>, traits: Vec<&str>| Agent {
            id: id.into(), name: "A".into(), role: "R".into(), personality: String::new(), task: String::new(), color: "#fff".into(),
            provider: Provider::default(), desk, look_seed: None, look: None, traits: traits.into_iter().map(String::from).collect(),
        };
        assert!(!valid_agents(&[agent("a", Some(1), vec![]), agent("b", Some(1), vec![])]), "two agents on one desk");
        assert!(!valid_agents(&[agent("a", Some(24), vec![])]), "desk outside the office");
        assert!(!valid_agents(&[agent("a", None, vec!["sleepy"])]), "unknown trait");
        let team: Vec<Agent> = (0..25).map(|i| agent(&format!("a{i}"), None, vec![])).collect();
        assert!(!valid_agents(&team), "more than 24 agents");
        assert!(valid_agents(&team[..24]));
    }

    #[test]
    fn workspace_defaults_to_studio_and_only_accepts_known_names() {
        let base = std::env::temp_dir().join(format!("worklive-ws-{}", std::process::id()));
        std::fs::create_dir_all(&base).unwrap();
        assert_eq!(workspace_of(&base), "studio", "no file: the studio keeps the original folder");
        std::fs::write(base.join("workspace.txt"), "deck7\n").unwrap();
        assert_eq!(workspace_of(&base), "deck7");
        std::fs::write(base.join("workspace.txt"), "../../etc").unwrap();
        assert_eq!(workspace_of(&base), "studio", "unknown names fall back to the studio");
        std::fs::remove_dir_all(&base).ok();
    }
}
