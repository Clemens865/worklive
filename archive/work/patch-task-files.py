from pathlib import Path
root=Path('outputs/worklive')
p=root/'src-tauri/src/knowledge.rs'
s=p.read_text().replace('mod projects;','mod projects;\n#[path = "task_files.rs"]\nmod task_files;')
s=s.replace('    handoff: String,','    handoff: String,\n    task: String,\n    task_files: bool,')
s=s.replace('            handoff: String::new(),','            handoff: String::new(),\n            task: String::new(),\n            task_files: false,')
s=s.replace('        e.scope == "company"','        (e.scope == "task" && !a.task.is_empty() && e.scope_id == a.task)\n            || e.scope == "company"',1)
s=s.replace('        db(tx.execute("UPDATE meta SET value=value+1 WHERE key=\'epoch\'", []))?;\n        db(tx.commit())','''        if e.scope == "task" {
            db(tx.execute("UPDATE project_tasks SET revision=revision+1,updated_at=? WHERE id=?", params![now(),e.scope_id]))?;
        }
        db(tx.execute("UPDATE meta SET value=value+1 WHERE key='epoch'", []))?;
        db(tx.commit())''',1)
s=s.replace('"preview":short(&e.body,180)', '"preview":short(&e.body,180),"hash":e.hash')
s=s.replace("OR (e.scope='project' AND e.scope_id=? AND ?<>''))", "OR (e.scope='project' AND e.scope_id=? AND ?<>'') OR (e.scope='task' AND e.scope_id=? AND ?<>''))")
s=s.replace('                a.project\n            ],','                a.project,\n                a.task,\n                a.task\n            ],',1)
s=s.replace('        if run.is_some() {\n            if scope', '''        if run.is_some() {
            if a.task_files {
                return Err("This run has task-only references. Save a deliverable; the user can share a reviewed summary into memory.".into());
            }
            if scope''',1)
s=s.replace('        if name.len() > 180', '''        self.import_scoped(scope, scope_id, name, bytes, extracted)
    }
    fn import_scoped(&mut self, scope: &str, scope_id: String, name: &str, bytes: &[u8], extracted: Extracted) -> Result<Value> {
        if name.is_empty() || name.contains(['\\0','/','\\\\']) || name.len() > 180''',1)
s=s.replace('        let stamp = now();\n        let e = Entry {\n            id: Uuid::new_v4().to_string(),\n            kind: "file".into(),', '''        if scope == "task" && self.task_file_entries(&scope_id)?.len() >= 10 {
            return Err("Each task can hold up to ten reference files. Remove one before attaching another.".into());
        }
        let stamp = now();
        let e = Entry {
            id: Uuid::new_v4().to_string(),
            kind: "file".into(),''',1)
s=s.replace('                self.check_task_run(&a, &v)?;','''                self.check_task_run(&a, &v)?;
                a.task = v["taskId"].as_str().unwrap_or("").to_owned();
                let references = self.task_file_entries(&a.task)?;
                a.task_files = !references.is_empty();''',1)
s=s.replace('                let mut items = vec![];', '''                let mut items = vec![];
                for e in &references {
                    let chunks = self.chunks(e)?;
                    if let Some(c) = chunks.first() {
                        items.push(json!({"id":e.id,"revision":e.revision,"title":e.title,"scope":"task","hash":e.hash,"part":0,"parts":chunks.len(),"locator":c.locator,"excerpt":short(&c.text,400),"warning":e.warning}));
                    }
                }''',1)
s=s.replace('let context_key = self.epoch()?.to_string();','let context_key = format!("{}:task:{}",self.epoch()?,a.task);')
s=s.replace('Company context is shared. Personal and project context is scoped to this task.', 'Company context is shared. Task files are visible only during their assigned task; personal and project context retain their scopes.')
s=s.replace('"text":c.text,"warning":e.warning','"text":c.text,"warning":e.warning,"hash":e.hash')
p.write_text(s)
p=root/'src-tauri/src/projects.rs';s=p.read_text();s=s.replace('        rows.map(db).collect()\n    }\n    pub(super) fn project_task', '''        let mut tasks: Vec<Value> = rows.map(db).collect::<Result<_>>()?;
        for task in &mut tasks {
            task["files"] = json!(self.task_file_entries(task["id"].as_str().unwrap())?.iter().map(Self::summary).collect::<Vec<_>>());
        }
        Ok(tasks)
    }
    pub(super) fn project_task''',1);p.write_text(s)
