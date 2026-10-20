use super::*;

impl Knowledge {
    pub(super) fn project_catalog(&self) -> Result<Vec<Value>> {
        let mut q = db(self.conn.prepare("SELECT p.id,p.name,COALESCE(g.goal,''),COALESCE(g.revision,0),COALESCE(g.updated_at,0) FROM projects p LEFT JOIN project_plans g ON g.project=p.id ORDER BY p.name"))?;
        let rows = db(q.query_map([], |r| Ok(json!({"id":r.get::<_,String>(0)?,"name":r.get::<_,String>(1)?,"goal":r.get::<_,String>(2)?,"revision":r.get::<_,i64>(3)?,"updatedAt":r.get::<_,i64>(4)?}))))?;
        rows.map(db).collect()
    }
    pub(super) fn project_tasks(&self) -> Result<Vec<Value>> {
        let mut q = db(self.conn.prepare("SELECT t.id,t.project,t.title,t.brief,t.agent,t.depends_on,t.revision,t.created_at,t.updated_at,t.run,COALESCE(h.handoff,'') FROM project_tasks t LEFT JOIN task_handoffs h ON h.task=t.id WHERE t.archived=0 ORDER BY t.created_at,t.id"))?;
        let rows = db(q.query_map([], |r| Ok(json!({"id":r.get::<_,String>(0)?,"projectId":r.get::<_,String>(1)?,"title":r.get::<_,String>(2)?,"brief":r.get::<_,String>(3)?,"agentId":r.get::<_,String>(4)?,"dependsOn":r.get::<_,String>(5)?,"revision":r.get::<_,i64>(6)?,"createdAt":r.get::<_,i64>(7)?,"updatedAt":r.get::<_,i64>(8)?,"runId":r.get::<_,String>(9)?,"handoffId":r.get::<_,String>(10)?}))))?;
        rows.map(db).collect()
    }
    pub(super) fn project_task(&self, id: &str) -> Result<Value> {
        self.project_tasks()?
            .into_iter()
            .find(|t| t["id"] == id)
            .ok_or("Task not found.".into())
    }
    pub(super) fn project_goal(&self, project: &str) -> Result<Option<Value>> {
        Ok(self.project_catalog()?.into_iter().find(|p| p["id"] == project && p["goal"].as_str().is_some_and(|g| !g.is_empty())).map(|p|
            json!({"id":format!("project-goal:{project}"),"revision":p["revision"],"title":format!("{} — project goal",p["name"].as_str().unwrap_or("Project")),"scope":"project","locator":"Project brief","text":p["goal"],"updatedAt":p["updatedAt"],"source":"Project owner"})
        ))
    }
    fn task_access(&self, t: &Value, agent: &str) -> Result<()> {
        if t["agentId"] != agent
            || t["projectId"].as_str() != Some(self.access(agent, "")?.project.as_str())
        {
            return Err("The task owner must still belong to this project.".into());
        }
        let dependency = t["dependsOn"].as_str().unwrap_or("");
        if !dependency.is_empty() {
            let d = self.project_task(dependency)?;
            let run = d["runId"].as_str().unwrap_or("");
            if run.is_empty() || self.review_record(run)?["accepted"] != true {
                return Err("Accept the prerequisite’s current result before starting or resuming this task.".into());
            }
        }
        Ok(())
    }
    pub(super) fn check_task_run(&self, a: &Access, v: &Value) -> Result<()> {
        let Some(id) = v["taskId"].as_str().filter(|s| !s.is_empty()) else {
            return Ok(());
        };
        let t = self.project_task(id)?;
        if t["handoffId"].as_str().unwrap_or("") != v["handoffId"].as_str().unwrap_or("") {
            return Err("The shared input does not match this project task.".into());
        }
        self.task_access(&t, &a.agent)?;
        if t["runId"] != v["runId"] {
            return Err(
                "This is not the task’s current run. Open its latest work from Projects.".into(),
            );
        }
        Ok(())
    }
    pub(super) fn project_command(&mut self, v: Value) -> Result<Value> {
        match v["op"].as_str().unwrap_or("") {
            "work_project_save" => {
                self.idle()?;
                let name = text(&v, "name", 120)?;
                let goal = v["goal"].as_str().unwrap_or("").trim();
                if goal.len() > 8000 || goal.contains('\0') {
                    return Err("Keep the project goal below 8,000 bytes.".into());
                }
                let given = v["id"].as_str().unwrap_or("");
                let id = if given.is_empty() {
                    Uuid::new_v4().to_string()
                } else {
                    given.to_owned()
                };
                let old = self.project_catalog()?.into_iter().find(|p| p["id"] == id);
                if !given.is_empty() && old.is_none() {
                    return Err("Project not found.".into());
                }
                let revision = old
                    .as_ref()
                    .and_then(|p| p["revision"].as_i64())
                    .unwrap_or(0);
                if old.is_some() && v["revision"].as_i64() != Some(revision) {
                    return Err("This project changed. Reopen its brief before editing.".into());
                }
                let tx = db(self.conn.transaction())?;
                db(tx.execute("INSERT INTO projects VALUES(?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name",params![id,name]))?;
                db(tx.execute(
                    "INSERT OR REPLACE INTO project_plans VALUES(?,?,?,?)",
                    params![id, goal, revision + 1, now()],
                ))?;
                db(tx.execute("UPDATE meta SET value=value+1 WHERE key='epoch'", []))?;
                db(tx.commit())?;
                let mut state = self.work_status()?;
                state["savedProjectId"] = json!(id);
                Ok(state)
            }
            "work_task_save" => {
                self.idle()?;
                let project = text(&v, "projectId", 80)?;
                let agent = text(&v, "agentId", 64)?;
                let title = text(&v, "title", 160)?;
                let brief = text(&v, "brief", 4000)?;
                if self.access(&agent, "")?.project != project {
                    return Err("Assign the task owner to this project first.".into());
                }
                let given = v["id"].as_str().unwrap_or("");
                let id = if given.is_empty() {
                    Uuid::new_v4().to_string()
                } else {
                    given.to_owned()
                };
                let old = if given.is_empty() {
                    None
                } else {
                    Some(self.project_task(given)?)
                };
                if let Some(t) = &old {
                    if t["handoffId"].as_str().is_some_and(|s| !s.is_empty()) {
                        return Err("A reviewed handoff keeps its agreed owner, brief, and input. Remove the planned task and create a new handoff to change them.".into());
                    }
                    if t["projectId"] != project || t["runId"] != "" {
                        return Err("Started tasks keep their original brief. Use Work & results for revisions.".into());
                    }
                    if t["revision"] != v["revision"] {
                        return Err("This task changed. Reopen it before editing.".into());
                    }
                }
                let dependency = v["dependsOn"].as_str().unwrap_or("");
                let mut next = dependency.to_owned();
                let mut seen = std::collections::HashSet::new();
                while !next.is_empty() {
                    if next == id || !seen.insert(next.clone()) {
                        return Err("Tasks cannot depend on themselves or form a loop.".into());
                    }
                    let d = self.project_task(&next)?;
                    if d["projectId"] != project {
                        return Err("Choose a prerequisite in the same project.".into());
                    }
                    next = d["dependsOn"].as_str().unwrap_or("").to_owned();
                }
                let stamp = now();
                let created = old
                    .as_ref()
                    .and_then(|t| t["createdAt"].as_i64())
                    .unwrap_or(stamp);
                let revision = old
                    .as_ref()
                    .and_then(|t| t["revision"].as_i64())
                    .unwrap_or(0)
                    + 1;
                db(self.conn.execute("INSERT INTO project_tasks VALUES(?,?,?,?,?,?,?,?,?,'',0) ON CONFLICT(id) DO UPDATE SET title=excluded.title,brief=excluded.brief,agent=excluded.agent,depends_on=excluded.depends_on,revision=excluded.revision,updated_at=excluded.updated_at",params![id,project,title,brief,agent,dependency,revision,created,stamp]))?;
                self.work_status()
            }
            "work_task_archive" => {
                self.idle()?;
                let id = text(&v, "id", 80)?;
                let t = self.project_task(&id)?;
                if t["runId"] != "" {
                    return Err("Started tasks stay in project history. Stop their run from Work & results.".into());
                }
                if t["revision"] != v["revision"] {
                    return Err("This task changed. Refresh the board.".into());
                }
                if self.project_tasks()?.iter().any(|d| d["dependsOn"] == id) {
                    return Err(
                        "Remove this task’s dependencies from other planned tasks first.".into(),
                    );
                }
                let tx = db(self.conn.transaction())?;
                if let Some(handoff) = t["handoffId"].as_str().filter(|s| !s.is_empty()) {
                    db(tx.execute(
                        "UPDATE work_handoffs SET state='cancelled' WHERE id=? AND state='queued'",
                        [handoff],
                    ))?;
                }
                db(tx.execute("UPDATE project_tasks SET archived=1 WHERE id=?", [&id]))?;
                db(tx.commit())?;
                self.work_status()
            }
            "work_task_claim" => {
                let id = text(&v, "taskId", 80)?;
                let run = text(&v, "runId", 80)?;
                let agent = text(&v, "agentId", 64)?;
                let t = self.project_task(&id)?;
                self.task_access(&t, &agent)?;
                let current = t["runId"].as_str().unwrap_or("");
                let previous = v["previousRunId"].as_str().unwrap_or("");
                if current != previous {
                    return Err(
                        "This task already has newer work. Continue its latest run from Projects."
                            .into(),
                    );
                }
                if v["revision"] != t["revision"] {
                    return Err("The brief changed. Refresh Projects before starting.".into());
                }
                if !current.is_empty() && self.runs.contains_key(current) {
                    return Err("Pause the current task first.".into());
                }
                let handoff = t["handoffId"].as_str().unwrap_or("");
                let access = self.access(&agent, "")?;
                self.checked_handoff(
                    &access,
                    &json!({"handoffId":handoff,"taskId":id,"runId":run,"previousRunId":previous}),
                )?;
                let tx = db(self.conn.transaction())?;
                db(tx.execute(
                    "UPDATE project_tasks SET run=?,updated_at=? WHERE id=? AND run=?",
                    params![run, now(), id, current],
                ))?;
                if !handoff.is_empty() {
                    db(tx.execute(
                        "UPDATE work_handoffs SET state='started',run=? WHERE id=?",
                        params![run, handoff],
                    ))?;
                }
                db(tx.commit())?;
                Ok(t)
            }
            _ => Err("Unknown project action.".into()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture() -> (Knowledge, String) {
        let mut k = Knowledge::open(Path::new(":memory:")).unwrap();
        let state=k.host(json!({"op":"work_project_save","name":"Launch","goal":"A calm, useful first launch."})).unwrap();
        let p = state["savedProjectId"].as_str().unwrap().to_owned();
        for a in ["ada", "milo"] {
            k.desktop(json!({"action":"assignProject","agentId":a,"projectId":p}))
                .unwrap();
        }
        (k, p)
    }
    fn task(k: &mut Knowledge, p: &str, agent: &str, dependency: &str) -> Value {
        let state=k.host(json!({"op":"work_task_save","projectId":p,"agentId":agent,"title":format!("Task for {agent}"),"brief":"Save a useful summary.","dependsOn":dependency})).unwrap();
        state["tasks"]
            .as_array()
            .unwrap()
            .iter()
            .find(|t| t["agentId"] == agent)
            .unwrap()
            .clone()
    }
    fn claim(k: &mut Knowledge, t: &Value, run: &str, previous: &str) -> Result<Value> {
        k.host(json!({"op":"work_task_claim","taskId":t["id"],"revision":t["revision"],"agentId":t["agentId"],"runId":run,"previousRunId":previous}))
    }
    fn review(k: &mut Knowledge, run: &str, accepted: bool) {
        k.host(json!({"op":"work_review","runId":run,"rootId":run,"agentId":"ada","accepted":accepted,"hashes":[{"name":"result.md","hash":"fixture"}]})).unwrap();
    }
    fn begin(k: &mut Knowledge, t: &Value, run: &str) -> Result<Value> {
        k.host(json!({"op":"begin","taskId":t["id"],"runId":run,"agentId":t["agentId"],"provider":"codex","query":"summary"}))
    }
    #[test]
    fn dependencies_require_latest_accepted_run_on_start_and_resume() {
        let (mut k, p) = fixture();
        let a = task(&mut k, &p, "ada", "");
        let b = task(&mut k, &p, "milo", a["id"].as_str().unwrap());
        assert!(claim(&mut k, &b, "b1", "").is_err());
        claim(&mut k, &a, "a1", "").unwrap();
        assert!(claim(&mut k, &b, "b1", "").is_err());
        review(&mut k, "a1", true);
        claim(&mut k, &b, "b1", "").unwrap();
        review(&mut k, "a1", false);
        assert!(claim(&mut k, &b, "b2", "b1").is_err());
        assert!(begin(&mut k, &b, "b1").is_err());
        review(&mut k, "a1", true);
        claim(&mut k, &a, "a2", "a1").unwrap();
        assert!(claim(&mut k, &b, "b2", "b1").is_err());
        review(&mut k, "a2", true);
        claim(&mut k, &b, "b2", "b1").unwrap();
    }
    #[test]
    fn ownership_membership_current_run_and_revision_are_rechecked() {
        let (mut k, p) = fixture();
        let t = task(&mut k, &p, "ada", "");
        let mut wrong = t.clone();
        wrong["agentId"] = json!("milo");
        assert!(claim(&mut k, &wrong, "r1", "").is_err());
        wrong = t.clone();
        wrong["revision"] = json!(9);
        assert!(claim(&mut k, &wrong, "r1", "").is_err());
        claim(&mut k, &t, "r1", "").unwrap();
        assert!(claim(&mut k, &t, "duplicate", "").is_err());
        claim(&mut k, &t, "r2", "r1").unwrap();
        assert!(claim(&mut k, &t, "stale", "r1").is_err());
        assert!(begin(&mut k, &t, "r1").is_err());
        k.desktop(json!({"action":"assignProject","agentId":"ada","projectId":""}))
            .unwrap();
        assert!(begin(&mut k, &t, "r2").is_err());
        assert!(claim(&mut k, &t, "r3", "r2").is_err());
    }
    #[test]
    fn edits_reject_cycles_cross_project_links_started_tasks_and_stale_versions() {
        let (mut k, p) = fixture();
        let a = task(&mut k, &p, "ada", "");
        let b = task(&mut k, &p, "milo", a["id"].as_str().unwrap());
        let edit = json!({"op":"work_task_save","id":a["id"],"projectId":p,"agentId":"ada","title":"Revised","brief":"Save a brief.","revision":1,"dependsOn":b["id"]});
        assert!(k.host(edit.clone()).is_err());
        let mut clean = edit.clone();
        clean["dependsOn"] = json!("");
        k.host(clean.clone()).unwrap();
        assert!(k.host(clean.clone()).is_err());
        let a = k.project_task(a["id"].as_str().unwrap()).unwrap();
        claim(&mut k, &a, "a1", "").unwrap();
        clean["revision"] = json!(2);
        assert!(k.host(clean).is_err());
        let other = k
            .desktop(json!({"action":"createProject","name":"Other"}))
            .unwrap();
        k.desktop(json!({"action":"assignProject","agentId":"third","projectId":other["id"]}))
            .unwrap();
        assert!(k.host(json!({"op":"work_task_save","projectId":other["id"],"agentId":"third","title":"Other task","brief":"Write.","dependsOn":b["id"]})).is_err());
    }
    #[test]
    fn goal_is_versioned_scoped_and_invalidates_prior_context() {
        let (mut k, p) = fixture();
        let a = task(&mut k, &p, "ada", "");
        claim(&mut k, &a, "a1", "").unwrap();
        let one = begin(&mut k, &a, "a1").unwrap();
        assert_eq!(one["items"][0]["text"], "A calm, useful first launch.");
        assert_eq!(one["items"][0]["revision"], 1);
        let edit = json!({"op":"work_project_save","id":p,"revision":1,"name":"Launch","goal":"A revised goal."});
        assert!(k.host(edit.clone()).is_err());
        k.host(json!({"op":"end","runId":"a1"})).unwrap();
        k.host(edit.clone()).unwrap();
        assert!(k.host(edit).is_err());
        claim(&mut k, &a, "a2", "a1").unwrap();
        let two = begin(&mut k, &a, "a2").unwrap();
        assert_ne!(one["contextKey"], two["contextKey"]);
        assert_eq!(two["items"][0]["revision"], 2);
        let outsider = k
            .host(json!({"op":"begin","runId":"outside","agentId":"outside","provider":"claude"}))
            .unwrap();
        assert!(outsider["items"].as_array().unwrap().is_empty());
    }
    #[test]
    fn removing_planned_tasks_keeps_dependency_and_run_history_intact() {
        let (mut k, p) = fixture();
        let a = task(&mut k, &p, "ada", "");
        let b = task(&mut k, &p, "milo", a["id"].as_str().unwrap());
        let archive =
            |t: &Value| json!({"op":"work_task_archive","id":t["id"],"revision":t["revision"]});
        assert!(k.host(archive(&a)).is_err());
        k.host(archive(&b)).unwrap();
        claim(&mut k, &a, "a1", "").unwrap();
        assert!(k.host(archive(&a)).is_err());
        assert_eq!(k.project_tasks().unwrap().len(), 1);
    }
    #[test]
    fn old_projects_upgrade_without_losing_assignments_and_tasks_survive_reopen() {
        let path =
            std::env::temp_dir().join(format!("worklive-project-test-{}.sqlite", Uuid::new_v4()));
        {
            let c = Connection::open(&path).unwrap();
            c.execute_batch("CREATE TABLE projects(id TEXT PRIMARY KEY,name TEXT NOT NULL);INSERT INTO projects VALUES('legacy','Existing project');CREATE TABLE assignments(agent TEXT PRIMARY KEY,project TEXT NOT NULL REFERENCES projects(id));INSERT INTO assignments VALUES('ada','legacy');").unwrap();
        }
        let mut k = Knowledge::open(&path).unwrap();
        assert_eq!(k.work_status().unwrap()["projects"][0]["revision"], 0);
        let t = task(&mut k, "legacy", "ada", "");
        claim(&mut k, &t, "r1", "").unwrap();
        drop(k);
        let k = Knowledge::open(&path).unwrap();
        let s = k.work_status().unwrap();
        assert_eq!(s["assignments"]["ada"], "legacy");
        assert_eq!(s["tasks"][0]["runId"], "r1");
        drop(k);
        std::fs::remove_file(path).unwrap();
    }
}
