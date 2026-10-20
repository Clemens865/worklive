#[test]
#[ignore = "Uses installed Codex and Claude Code subscriptions with synthetic local context"]
fn subscription_memory_smoke() {
    run_fixture("memory-smoke.mjs");
}

#[test]
#[ignore = "Uses the installed Claude Code subscription with a synthetic reviewed handoff"]
fn subscription_handoff_smoke() {
    run_fixture("handoff-smoke.mjs");
}

fn run_fixture(script: &str) {
    use crate::{context_files, knowledge::Knowledge};
    use serde_json::{json, Value};
    use std::{
        io::{BufRead, BufReader, Write},
        path::PathBuf,
        process::{Command, Stdio},
    };
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .to_owned();
    let data = std::env::var("WORKLIVE_SMOKE_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            std::env::temp_dir().join(format!("worklive-memory-{}", uuid::Uuid::new_v4()))
        });
    std::fs::create_dir_all(&data).unwrap();
    let mut store = Knowledge::open(&data.join("knowledge.sqlite")).unwrap();
    let mut child = Command::new("node")
        .arg(root.join("worker").join(script))
        .arg(&data)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .unwrap();
    let mut input = child.stdin.take().unwrap();
    for line in BufReader::new(child.stdout.take().unwrap()).lines() {
        let v: Value = serde_json::from_str(&line.unwrap()).unwrap();
        let result = if !v["desktop"].is_null() {
            store.desktop(v["desktop"].clone())
        } else if !v["file"].is_null() {
            let f = &v["file"];
            let bytes = f["content"].as_str().unwrap().as_bytes();
            context_files::extract(bytes, "txt").and_then(|extracted| {
                store.import(
                    f["agentId"].as_str().unwrap(),
                    f["scope"].as_str().unwrap(),
                    f["name"].as_str().unwrap(),
                    bytes,
                    extracted,
                )
            })
        } else {
            store.host(v["host"].clone())
        };
        let reply = match result {
            Ok(result) => json!({"id":v["id"],"result":result}),
            Err(error) => json!({"id":v["id"],"error":error}),
        };
        writeln!(input, "{}", reply).unwrap();
        input.flush().unwrap();
    }
    assert!(child.wait().unwrap().success());
    eprintln!("Report: {}", data.display());
}
