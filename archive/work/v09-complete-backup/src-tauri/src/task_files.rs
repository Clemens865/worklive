use super::*;

impl Knowledge {
    pub(super) fn task_file_entries(&self, task: &str) -> Result<Vec<Entry>> {
        Ok(self
            .entries()?
            .into_iter()
            .filter(|e| e.scope == "task" && e.scope_id == task && e.active)
            .collect())
    }
    fn editable_task_files(&self, task: &str, revision: i64) -> Result<Value> {
        self.idle()?;
        let t = self.project_task(task)?;
        if t["runId"] != "" {
            return Err("References stay fixed after a task starts. Create a new task to use different files.".into());
        }
        if t["revision"].as_i64() != Some(revision) {
            return Err("This task changed. Reopen its references before editing.".into());
        }
        Ok(t)
    }
    pub fn import_task_file(
        &mut self,
        task: &str,
        revision: i64,
        name: &str,
        bytes: &[u8],
        extracted: Extracted,
    ) -> Result<Value> {
        self.editable_task_files(task, revision)?;
        let files = self.task_file_entries(task)?;
        let hash = format!("{:x}", Sha256::digest(bytes));
        if files.iter().any(|e| e.title == name && e.hash != hash) {
            return Err("A different file has this name. Remove that reference first or rename the new file.".into());
        }
        self.import_scoped("task", task.into(), name, bytes, extracted)?;
        self.project_task(task)
    }
    // Desktop-only operations. Models receive files through their bound run context.
    pub fn task_file_command(&mut self, v: Value) -> Result<Value> {
        let task = text(&v, "taskId", 80)?;
        self.project_task(&task)?;
        let id = text(&v, "fileId", 80)?;
        let mut e = self
            .task_file_entries(&task)?
            .into_iter()
            .find(|e| e.id == id)
            .ok_or("Reference not found in this task.")?;
        match v["action"].as_str().unwrap_or("") {
            "read" => Ok(json!({"entry":Self::summary(&e),"chunks":self.chunks(&e)?})),
            "document" => self.document(&e),
            "edit" => {
                // Like adding or removing references: only before the task starts.
                self.editable_task_files(&task, v["revision"].as_i64().unwrap_or(-1))?;
                let content = v["content"].as_str().ok_or("Write some content first.")?;
                self.edit_document(e, v["fileRevision"].as_i64().unwrap_or(-1), content)
            }
            "remove" => {
                self.editable_task_files(&task, v["revision"].as_i64().unwrap_or(-1))?;
                let chunks = self.chunks(&e)?;
                e.active = false;
                e.revision += 1;
                e.updated_at = now();
                self.save(&e, &chunks, None)?;
                self.project_task(&task)
            }
            _ => Err("Unknown reference action.".into()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture() -> (Knowledge, Value, Value) {
        let mut k = Knowledge::open(Path::new(":memory:")).unwrap();
        let p = k
            .host(json!({"op":"work_project_save","name":"Studio","goal":"Make useful things"}))
            .unwrap()["savedProjectId"]
            .clone();
        k.desktop(json!({"action":"assignProject","agentId":"ada","projectId":p}))
            .unwrap();
        for title in ["First", "Second"] {
            k.host(json!({"op":"work_task_save","projectId":p,"agentId":"ada","title":title,"brief":"Write a summary."})).unwrap();
        }
        let tasks = k.project_tasks().unwrap();
        (k, tasks[0].clone(), tasks[1].clone())
    }
    fn attach(k: &mut Knowledge, t: &Value, name: &str, body: &str) -> Result<Value> {
        k.import_task_file(
            t["id"].as_str().unwrap(),
            t["revision"].as_i64().unwrap(),
            name,
            body.as_bytes(),
            Extracted {
                chunks: split_text(body, "Text"),
                warning: String::new(),
            },
        )
    }
    fn start(k: &mut Knowledge, t: &Value, run: &str, provider: &str) -> Value {
        k.host(json!({"op":"work_task_claim","taskId":t["id"],"revision":t["revision"],"agentId":"ada","runId":run,"previousRunId":t["runId"]})).unwrap();
        k.host(
            json!({"op":"begin","taskId":t["id"],"runId":run,"agentId":"ada","provider":provider}),
        )
        .unwrap()
    }
    fn tool(k: &mut Knowledge, run: &str, name: &str, args: Value) -> Result<Value> {
        k.host(json!({"op":"tool","runId":run,"name":name,"args":args}))
    }
    #[test]
    fn references_are_task_scoped_in_start_list_search_read_and_memory() {
        let (mut k, t, other) = fixture();
        let t = attach(&mut k, &t, "launch.md", "Juniper launch is on Friday.").unwrap();
        let id = t["files"][0]["id"].clone();
        let one = start(&mut k, &t, "one", "codex");
        assert_eq!(one["items"][0]["title"], "launch.md");
        assert_eq!(one["items"][0]["scope"], "task");
        assert_eq!(
            one["items"][0]["hash"],
            format!("{:x}", Sha256::digest(b"Juniper launch is on Friday."))
        );
        assert_eq!(
            tool(&mut k, "one", "context_search", json!({"query":"Juniper"})).unwrap()["matches"]
                [0]["id"],
            id
        );
        let passage = tool(
            &mut k,
            "one",
            "context_read",
            json!({"id":id,"revision":1,"part":0}),
        )
        .unwrap();
        assert_eq!(passage["text"], "Juniper launch is on Friday.\n");
        assert_eq!(passage["parts"], 1);
        for scope in ["agent", "project", "company"] {
            assert!(tool(
                &mut k,
                "one",
                "memory_append",
                json!({"scope":scope,"title":"Leaked","content":"Friday","source":"file"})
            )
            .is_err());
        }
        k.host(json!({"op":"end","runId":"one"})).unwrap();
        start(&mut k, &other, "other", "claude");
        assert!(tool(
            &mut k,
            "other",
            "context_read",
            json!({"id":id,"revision":1,"part":0})
        )
        .is_err());
        assert!(tool(
            &mut k,
            "other",
            "context_search",
            json!({"query":"Juniper"})
        )
        .unwrap()["matches"]
            .as_array()
            .unwrap()
            .is_empty());
        assert!(
            !tool(&mut k, "other", "context_list", json!({})).unwrap()["entries"]
                .as_array()
                .unwrap()
                .iter()
                .any(|e| e["id"] == id)
        );
        k.host(json!({"op":"end","runId":"other"})).unwrap();
        k.host(json!({"op":"begin","runId":"free","agentId":"ada","provider":"codex"}))
            .unwrap();
        assert!(tool(
            &mut k,
            "free",
            "context_read",
            json!({"id":id,"revision":1,"part":0})
        )
        .is_err());
        assert!(k
            .desktop(json!({"action":"read","agentId":"ada","id":id}))
            .is_err());
    }
    #[test]
    fn uploads_deduplicate_enforce_limits_and_cannot_change_started_inputs() {
        let (mut k, old, _) = fixture();
        let mut t = attach(&mut k, &old, "brief.md", "One").unwrap();
        assert!(attach(&mut k, &old, "stale.md", "Two").is_err());
        let same = attach(&mut k, &t, "brief.md", "One").unwrap();
        assert_eq!(same["revision"], t["revision"]);
        assert!(attach(&mut k, &t, "brief.md", "Different").is_err());
        for i in 1..10 {
            t = attach(&mut k, &t, &format!("{i}.md"), &format!("Body {i}")).unwrap();
        }
        assert!(attach(&mut k, &t, "extra.md", "Extra").is_err());
        assert!(attach(&mut k, &t, "bad/escape.md", "Invalid").is_err());
        let started = start(&mut k, &t, "run", "codex");
        assert_eq!(
            started["items"]
                .as_array()
                .unwrap()
                .iter()
                .filter(|e| e["scope"] == "task")
                .count(),
            10
        );
        k.host(json!({"op":"end","runId":"run"})).unwrap();
        assert!(attach(&mut k, &t, "later.md", "Later").is_err());
        assert!(k.task_file_command(json!({"action":"remove","taskId":t["id"],"fileId":t["files"][0]["id"],"revision":t["revision"]})).is_err());
        let t = k.project_task(t["id"].as_str().unwrap()).unwrap();
        let resumed = start(&mut k, &t, "continued", "claude");
        assert_eq!(started["items"], resumed["items"]);
    }
    #[test]
    fn removal_is_scoped_versioned_and_keeps_original_bytes() {
        let (mut k, t, other) = fixture();
        let t = attach(&mut k, &t, "reference.md", "Only here").unwrap();
        let id = t["files"][0]["id"].clone();
        assert!(k
            .task_file_command(json!({"action":"read","taskId":other["id"],"fileId":id}))
            .is_err());
        let removed = k
            .task_file_command(
                json!({"action":"remove","taskId":t["id"],"fileId":id,"revision":t["revision"]}),
            )
            .unwrap();
        assert!(removed["files"].as_array().unwrap().is_empty());
        assert_eq!(
            removed["revision"].as_i64().unwrap(),
            t["revision"].as_i64().unwrap() + 1
        );
        assert!(k
            .task_file_command(json!({"action":"read","taskId":t["id"],"fileId":id}))
            .is_err());
        let bytes: Vec<u8> = k
            .conn
            .query_row(
                "SELECT bytes FROM files WHERE id=? AND revision=1",
                [id.as_str().unwrap()],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(bytes, b"Only here");
        let again = attach(&mut k, &removed, "reference.md", "New copy").unwrap();
        assert_ne!(again["files"][0]["id"], id);
    }
    #[test]
    fn file_and_task_revision_roll_back_together_on_failure() {
        let (mut k, t, _) = fixture();
        k.conn.execute_batch("CREATE TRIGGER fail_task_revision BEFORE UPDATE OF revision ON project_tasks BEGIN SELECT RAISE(FAIL,'disk test'); END;").unwrap();
        assert!(attach(&mut k, &t, "brief.md", "Body").is_err());
        assert!(k
            .task_file_entries(t["id"].as_str().unwrap())
            .unwrap()
            .is_empty());
        assert_eq!(
            k.project_task(t["id"].as_str().unwrap()).unwrap()["revision"],
            t["revision"]
        );
        assert_eq!(
            k.conn
                .query_row("SELECT COUNT(*) FROM files", [], |r| r.get::<_, i64>(0))
                .unwrap(),
            0
        );
    }
}
