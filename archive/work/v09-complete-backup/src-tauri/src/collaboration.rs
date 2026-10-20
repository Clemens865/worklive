use super::*;

impl Knowledge {
    pub(super) fn work_status(&self) -> Result<Value> {
        let mut q = db(self
            .conn
            .prepare("SELECT record FROM work_reviews ORDER BY reviewed_at DESC"))?;
        let reviews: Vec<Value> = db(q.query_map([], |r| r.get::<_, String>(0)))?
            .map(|r| db(r).and_then(|s| serde_json::from_str(&s).map_err(|e| e.to_string())))
            .collect::<Result<_>>()?;
        let mut q = db(self
            .conn
            .prepare("SELECT payload,state,run FROM work_handoffs ORDER BY created_at DESC"))?;
        let rows = db(q.query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
            ))
        }))?;
        let mut handoffs = vec![];
        for row in rows {
            let (payload, state, run) = db(row)?;
            let mut h: Value = serde_json::from_str(&payload).map_err(|e| e.to_string())?;
            h.as_object_mut().unwrap().remove("content");
            h["state"] = json!(state);
            h["runId"] = json!(run);
            handoffs.push(h);
        }
        let projects = self.project_catalog()?;
        let tasks = self.project_tasks()?;
        let mut q = db(self.conn.prepare("SELECT agent,project FROM assignments"))?;
        let assignments: HashMap<String, String> =
            db(q.query_map([], |r| Ok((r.get(0)?, r.get(1)?))))?
                .map(db)
                .collect::<Result<_>>()?;
        let awards: i64 = db(self
            .conn
            .query_row("SELECT COUNT(*) FROM work_awards", [], |r| r.get(0)))?;
        Ok(
            json!({"reviews":reviews,"handoffs":handoffs,"projects":projects,"tasks":tasks,"assignments":assignments,"acceptedMilestones":awards,"busy":!self.runs.is_empty()}),
        )
    }
    pub(super) fn review_record(&self, run: &str) -> Result<Value> {
        let record: Option<String> = db(self
            .conn
            .query_row("SELECT record FROM work_reviews WHERE run=?", [run], |r| {
                r.get(0)
            })
            .optional())?;
        record
            .map(|s| serde_json::from_str(&s).map_err(|e| e.to_string()))
            .unwrap_or(Ok(Value::Null))
    }
    pub(super) fn handoff_record(&self, id: &str) -> Result<(Value, String, String)> {
        let row = db(self
            .conn
            .query_row(
                "SELECT payload,state,run FROM work_handoffs WHERE id=?",
                [id],
                |r| {
                    Ok((
                        r.get::<_, String>(0)?,
                        r.get::<_, String>(1)?,
                        r.get::<_, String>(2)?,
                    ))
                },
            )
            .optional())?
        .ok_or("Handoff not found.")?;
        Ok((
            serde_json::from_str(&row.0).map_err(|e| e.to_string())?,
            row.1,
            row.2,
        ))
    }
    fn shared_project(&self, source: &str, recipient: &str, project: &str) -> Result<String> {
        if source == recipient || project.is_empty() {
            return Err("Choose another agent in the same working project.".into());
        }
        if self.access(source, "")?.project != project
            || self.access(recipient, "")?.project != project
        {
            return Err(
                "Both agents must still be assigned to this project. Update Context & files first."
                    .into(),
            );
        }
        db(self
            .conn
            .query_row("SELECT name FROM projects WHERE id=?", [project], |r| {
                r.get(0)
            }))
    }
    pub(super) fn work_command(&mut self, v: Value) -> Result<Value> {
        match v["op"].as_str().unwrap_or("") {
            "work_status" => self.work_status(),
            "work_preview" => {
                let (mut h, state, run) = self.handoff_record(&text(&v, "handoffId", 80)?)?;
                h["state"] = json!(state);
                h["runId"] = json!(run);
                Ok(h)
            }
            "work_review" => {
                self.idle()?;
                let run = text(&v, "runId", 80)?;
                let root = text(&v, "rootId", 80)?;
                let agent = text(&v, "agentId", 64)?;
                let accepted = v["accepted"].as_bool().ok_or("Choose a review action.")?;
                let old = self.review_record(&run)?;
                let hashes = v["hashes"].as_array().ok_or("Missing reviewed files.")?;
                if accepted && hashes.is_empty() {
                    return Err("Read a saved deliverable before accepting work.".into());
                }
                if old["accepted"] == accepted && old["hashes"] == v["hashes"] {
                    return self.work_status();
                }
                let stamp = now().max(old["reviewedAt"].as_i64().unwrap_or(0) + 1);
                let record = json!({"runId":run,"rootId":root,"agentId":agent,"accepted":accepted,"reviewedAt":stamp,"hashes":hashes});
                let tx = db(self.conn.transaction())?;
                db(tx.execute(
                    "INSERT OR REPLACE INTO work_reviews VALUES(?,?,?)",
                    params![run, stamp, record.to_string()],
                ))?;
                if accepted {
                    db(tx.execute(
                        "INSERT OR IGNORE INTO work_awards VALUES(?,?)",
                        params![root, stamp],
                    ))?;
                } else {
                    db(tx.execute("UPDATE work_handoffs SET state='cancelled' WHERE source_run=? AND state='queued'",[&run]))?;
                }
                db(tx.commit())?;
                self.work_status()
            }
            "work_create" => {
                self.idle()?;
                if v["consent"] != true {
                    return Err(
                        "Review the file and confirm sharing it with the project teammate.".into(),
                    );
                }
                let id = text(&v, "requestId", 80)?;
                let source = text(&v, "agentId", 64)?;
                let recipient = text(&v, "recipient", 64)?;
                let project = text(&v, "projectId", 80)?;
                let run = text(&v, "runId", 80)?;
                let project_name = self.shared_project(&source, &recipient, &project)?;
                let file = text(&v, "fileName", 100)?;
                let hash = text(&v, "hash", 64)?;
                let content = v["content"]
                    .as_str()
                    .ok_or("Missing file contents.")?
                    .to_owned();
                if content.trim().is_empty() || content.len() > 400_000 || content.contains('\0') {
                    return Err("Invalid shared file contents.".into());
                }
                let brief = text(&v, "brief", 4000)?;
                let task_title = if v["taskTitle"].is_null() {
                    String::new()
                } else {
                    text(&v, "taskTitle", 160)?
                };
                let source_task = v["sourceTaskId"].as_str().unwrap_or("");
                if !source_task.is_empty() {
                    let task = self.project_task(source_task)?;
                    if task["runId"] != run
                        || task["agentId"] != source
                        || task["projectId"] != project
                    {
                        return Err("This project task has newer work or a different project. Review its current result before sharing.".into());
                    }
                }
                if content.chars().count() > 100_000
                    || format!("{:x}", Sha256::digest(content.as_bytes())) != hash
                {
                    return Err("The shared file changed. Preview it again.".into());
                }
                let review = self.review_record(&run)?;
                if review["accepted"] != true
                    || review["agentId"] != source
                    || !review["hashes"]
                        .as_array()
                        .map(|xs| xs.iter().any(|x| x["name"] == file && x["hash"] == hash))
                        .unwrap_or(false)
                {
                    return Err("Accept this exact saved result before creating a handoff.".into());
                }
                if let Ok((old, _, _)) = self.handoff_record(&id) {
                    if old["sourceRun"] == run
                        && old["recipient"] == recipient
                        && old["projectId"] == project
                        && old["hash"] == hash
                        && old["brief"] == brief
                        && old["fileName"] == file
                        && old["taskTitle"].as_str().unwrap_or("") == task_title
                        && old["sourceTaskId"].as_str().unwrap_or("") == source_task
                    {
                        return self.work_status();
                    }
                    return Err(
                        "This handoff request already exists with different content.".into(),
                    );
                }
                let stamp = now();
                let task_id = if task_title.is_empty() {
                    String::new()
                } else {
                    Uuid::new_v4().to_string()
                };
                let h = json!({"id":id,"sourceRun":run,"sourceAgent":source,"recipient":recipient,"projectId":project,"projectName":project_name,"fileName":file,"hash":hash,"content":content,"brief":brief,"createdAt":stamp,"sourceReviewedAt":review["reviewedAt"],"taskId":task_id,"taskTitle":task_title,"sourceTaskId":source_task});
                let tx = db(self.conn.transaction())?;
                db(tx.execute(
                    "INSERT INTO work_handoffs VALUES(?,?,?,?,?,'queued','',?,?)",
                    params![id, run, recipient, project, stamp, h.to_string(), source],
                ))?;
                if !task_id.is_empty() {
                    db(tx.execute(
                        "INSERT INTO project_tasks VALUES(?,?,?,?,?,?,1,?,?,'',0)",
                        params![
                            task_id,
                            project,
                            task_title,
                            brief,
                            recipient,
                            source_task,
                            stamp,
                            stamp
                        ],
                    ))?;
                    db(tx.execute(
                        "INSERT INTO task_handoffs VALUES(?,?)",
                        params![task_id, id],
                    ))?;
                }
                db(tx.commit())?;
                self.work_status()
            }
            "work_cancel" => {
                self.idle()?;
                let id = text(&v, "id", 80)?;
                let (_, state, _) = self.handoff_record(&id)?;
                if state == "started" {
                    return Err(
                        "This handoff has started. Pause or stop its run in Work & results.".into(),
                    );
                }
                db(self.conn.execute(
                    "UPDATE work_handoffs SET state='cancelled' WHERE id=?",
                    [id],
                ))?;
                self.work_status()
            }
            _ => Err("Unknown project workflow action.".into()),
        }
    }
    pub(super) fn checked_handoff(&self, a: &Access, v: &Value) -> Result<Option<Value>> {
        let Some(id) = v["handoffId"].as_str().filter(|s| !s.is_empty()) else {
            return Ok(None);
        };
        let (h, state, run) = self.handoff_record(id)?;
        if let Some(task_id) = h["taskId"].as_str().filter(|s| !s.is_empty()) {
            if v["taskId"] != task_id {
                return Err("Start this handoff from its linked project task.".into());
            }
        }
        if let Some(source_task) = h["sourceTaskId"].as_str().filter(|s| !s.is_empty()) {
            if self.project_task(source_task)?["runId"] != h["sourceRun"] {
                return Err("The source task has newer work. Create a handoff from its current accepted result.".into());
            }
        }
        if h["recipient"] != a.agent || h["projectId"] != a.project {
            return Err("This handoff belongs to another agent or project.".into());
        }
        self.shared_project(h["sourceAgent"].as_str().unwrap(), &a.agent, &a.project)?;
        let review = self.review_record(h["sourceRun"].as_str().unwrap())?;
        if state == "cancelled"
            || review["accepted"] != true
            || review["reviewedAt"] != h["sourceReviewedAt"]
        {
            return Err("The source review changed or this handoff was cancelled. Create a newly reviewed handoff.".into());
        }
        if state == "started"
            && run != v["runId"].as_str().unwrap_or("")
            && Some(run.as_str()) != v["previousRunId"].as_str()
        {
            return Err("This handoff already has a run. Continue it from Work & results.".into());
        }
        let mut meta = h;
        meta.as_object_mut().unwrap().remove("content");
        Ok(Some(meta))
    }
    pub(super) fn claim_handoff(&mut self, a: &Access, v: &Value) -> Result<Option<Value>> {
        let h = self.checked_handoff(a, v)?;
        if let Some(meta) = &h {
            db(self.conn.execute(
                "UPDATE work_handoffs SET state='started',run=? WHERE id=?",
                params![
                    v["runId"].as_str().unwrap_or(""),
                    meta["id"].as_str().unwrap()
                ],
            ))?;
        }
        Ok(h)
    }
    pub(super) fn handoff_passage(&self, id: &str, part: usize) -> Result<Value> {
        if id.is_empty() {
            return Err("No project handoff is attached to this run.".into());
        }
        let (h, state, _) = self.handoff_record(id)?;
        if state != "started" {
            return Err("This handoff is unavailable.".into());
        }
        let chars: Vec<char> = h["content"].as_str().unwrap().chars().collect();
        let passages: Vec<_> = chars.chunks(6000).collect();
        let chunk = passages
            .get(part)
            .ok_or("That handoff passage does not exist.")?;
        Ok(
            json!({"id":id,"title":h["fileName"],"scope":"project","revision":1,"part":part,"parts":passages.len(),"hash":h["hash"],"sourceRun":h["sourceRun"],"locator":format!("Handoff · characters {}–{}",part*6000+1,part*6000+chunk.len()),"text":chunk.iter().collect::<String>()}),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn linked_fixture() -> (Knowledge, Value, Value, Value) {
        let (mut k, p, mut h) = fixture();
        let state=k.host(json!({"op":"work_task_save","projectId":p,"agentId":"ada","title":"Research","brief":"Find evidence."})).unwrap();
        let source = state["tasks"][0].clone();
        k.host(json!({"op":"work_task_claim","taskId":source["id"],"revision":1,"runId":"source-run","agentId":"ada"})).unwrap();
        review(&mut k, &h, true);
        h["taskTitle"] = json!("Write a recommendation");
        h["sourceTaskId"] = source["id"].clone();
        let state = k.host(h.clone()).unwrap();
        let target = state["tasks"]
            .as_array()
            .unwrap()
            .iter()
            .find(|t| t["agentId"] == "milo")
            .unwrap()
            .clone();
        (k, h, source, target)
    }
    fn claim_task(k: &mut Knowledge, t: &Value, run: &str, previous: &str) -> Result<Value> {
        k.host(json!({"op":"work_task_claim","taskId":t["id"],"revision":1,"runId":run,"agentId":t["agentId"],"previousRunId":previous}))
    }
    fn linked_begin(k: &mut Knowledge, h: &Value, t: &Value, run: &str) -> Result<Value> {
        k.host(json!({"op":"begin","runId":run,"agentId":"milo","provider":"claude","handoffId":h["requestId"],"taskId":t["id"]}))
    }
    #[test]
    fn linked_handoff_creates_one_immutable_task_and_source_dependency() {
        let (mut k, h, source, t) = linked_fixture();
        let state = k.host(h.clone()).unwrap();
        assert_eq!(state["tasks"].as_array().unwrap().len(), 2);
        assert_eq!(state["handoffs"].as_array().unwrap().len(), 1);
        assert_eq!(t["dependsOn"], source["id"]);
        assert_eq!(t["handoffId"], h["requestId"]);
        assert!(state["handoffs"][0]["content"].is_null());
        assert_eq!(state["handoffs"][0]["taskId"], t["id"]);
        let mut changed = h.clone();
        changed["taskTitle"] = json!("Different title");
        assert!(k.host(changed).is_err());
        assert!(k.host(json!({"op":"work_task_save","id":t["id"],"projectId":t["projectId"],"agentId":"milo","title":"Change","brief":"Change","revision":1})).is_err());
        let preview = k
            .host(json!({"op":"work_preview","handoffId":h["requestId"]}))
            .unwrap();
        assert_eq!(preview["content"], h["content"]);
    }
    #[test]
    fn linked_claim_and_resume_advance_both_records_without_forking() {
        let (mut k, h, _, t) = linked_fixture();
        claim_task(&mut k, &t, "recipient-one", "").unwrap();
        let s = k.work_status().unwrap();
        assert_eq!(s["handoffs"][0]["runId"], "recipient-one");
        assert_eq!(s["handoffs"][0]["state"], "started");
        assert!(begin(&mut k, "milo", "bypass", "handoff-one", None).is_err());
        assert!(k.host(json!({"op":"begin","taskId":t["id"],"runId":"recipient-one","agentId":"milo","provider":"codex"})).is_err());
        let start = linked_begin(&mut k, &h, &t, "recipient-one").unwrap();
        assert_eq!(start["handoff"]["taskId"], t["id"]);
        let read=k.host(json!({"op":"tool","runId":"recipient-one","name":"handoff_read","args":{"part":0}})).unwrap();
        assert_eq!(read["text"], h["content"]);
        end(&mut k, "recipient-one");
        claim_task(&mut k, &t, "recipient-two", "recipient-one").unwrap();
        assert!(claim_task(&mut k, &t, "stale", "recipient-one").is_err());
        assert_eq!(k.handoff_record("handoff-one").unwrap().2, "recipient-two");
        assert_eq!(
            k.project_task(t["id"].as_str().unwrap()).unwrap()["runId"],
            "recipient-two"
        );
        assert!(linked_begin(&mut k, &h, &t, "recipient-one").is_err());
    }
    #[test]
    fn changed_source_and_withdrawn_reviews_cannot_rebind_a_linked_task() {
        let (mut k, h, _, t) = linked_fixture();
        claim_task(&mut k, &t, "recipient-one", "").unwrap();
        review(&mut k, &h, false);
        assert!(claim_task(&mut k, &t, "recipient-two", "recipient-one").is_err());
        review(&mut k, &h, true);
        assert!(claim_task(&mut k, &t, "recipient-two", "recipient-one").is_err());
        assert_eq!(k.handoff_record("handoff-one").unwrap().2, "recipient-one");
        assert_eq!(
            k.project_task(t["id"].as_str().unwrap()).unwrap()["runId"],
            "recipient-one"
        );
        let (mut k, h, _, t) = linked_fixture();
        let source_id = h["sourceTaskId"].as_str().unwrap();
        let source = k.project_task(source_id).unwrap();
        claim_task(&mut k, &source, "new-source", "source-run").unwrap();
        k.host(json!({"op":"work_review","runId":"new-source","rootId":"source-run","agentId":"ada","accepted":true,"hashes":[{"name":"new.md","hash":"fixture"}]})).unwrap();
        assert!(claim_task(&mut k, &t, "recipient-one", "").is_err());
        assert!(k.host(h.clone()).is_err());
        assert_eq!(
            k.project_task(t["id"].as_str().unwrap()).unwrap()["runId"],
            ""
        );
    }
    #[test]
    fn removing_linked_plans_cancels_the_queue_and_cancellation_blocks_start() {
        let (mut k, h, _, t) = linked_fixture();
        k.host(json!({"op":"work_task_archive","id":t["id"],"revision":1}))
            .unwrap();
        assert_eq!(k.handoff_record("handoff-one").unwrap().1, "cancelled");
        assert!(claim_task(&mut k, &t, "r", "").is_err());
        let (mut k, _, _, t) = linked_fixture();
        k.host(json!({"op":"work_cancel","id":"handoff-one"}))
            .unwrap();
        assert!(claim_task(&mut k, &t, "r", "").is_err());
        assert!(linked_begin(&mut k, &h, &t, "r").is_err());
    }
    #[test]
    fn linked_creation_and_claim_roll_back_together_on_storage_failure() {
        let (mut k, _, mut h) = fixture();
        review(&mut k, &h, true);
        h["taskTitle"] = json!("Next task");
        k.conn.execute_batch("CREATE TRIGGER reject_task BEFORE INSERT ON project_tasks BEGIN SELECT RAISE(ABORT,'fixture'); END;").unwrap();
        assert!(k.host(h).is_err());
        assert!(k.work_status().unwrap()["handoffs"]
            .as_array()
            .unwrap()
            .is_empty());
        let (mut k, _, _, t) = linked_fixture();
        k.conn.execute_batch("CREATE TRIGGER reject_claim BEFORE UPDATE ON work_handoffs BEGIN SELECT RAISE(ABORT,'fixture'); END;").unwrap();
        assert!(claim_task(&mut k, &t, "r", "").is_err());
        assert_eq!(
            k.project_task(t["id"].as_str().unwrap()).unwrap()["runId"],
            ""
        );
        assert_eq!(k.handoff_record("handoff-one").unwrap().1, "queued");
    }
    fn fixture() -> (Knowledge, String, Value) {
        let mut k = Knowledge::open(Path::new(":memory:")).unwrap();
        let p = k
            .desktop(json!({"action":"createProject","name":"Atlas"}))
            .unwrap()["id"]
            .as_str()
            .unwrap()
            .to_owned();
        for agent in ["ada", "milo"] {
            assign(&mut k, agent, &p);
        }
        let content = "A reviewed finding with its source.\n";
        let hash = format!("{:x}", Sha256::digest(content.as_bytes()));
        let h = json!({"op":"work_create","requestId":"handoff-one","runId":"source-run","agentId":"ada","recipient":"milo","projectId":p,"fileName":"finding.md","hash":hash,"content":content,"brief":"Write a concise recommendation.","consent":true});
        (k, p, h)
    }
    fn assign(k: &mut Knowledge, agent: &str, p: &str) {
        k.desktop(json!({"action":"assignProject","agentId":agent,"projectId":p}))
            .unwrap();
    }
    fn review(k: &mut Knowledge, h: &Value, accepted: bool) -> Value {
        k.host(json!({"op":"work_review","runId":h["runId"],"rootId":"root-work","agentId":"ada","accepted":accepted,"hashes":[{"name":h["fileName"],"hash":h["hash"]}]})).unwrap()
    }
    fn begin(
        k: &mut Knowledge,
        agent: &str,
        run: &str,
        id: &str,
        previous: Option<&str>,
    ) -> Result<Value> {
        k.host(json!({"op":"begin","runId":run,"agentId":agent,"provider":"codex","query":"unrelated","handoffId":id,"previousRunId":previous}))
    }
    fn end(k: &mut Knowledge, run: &str) {
        k.host(json!({"op":"end","runId":run})).unwrap();
    }
    #[test]
    fn handoff_requires_review_consent_matching_hash_and_membership() {
        let (mut k, p, h) = fixture();
        assert!(k.host(h.clone()).is_err());
        review(&mut k, &h, true);
        let mut invalid = h.clone();
        invalid["consent"] = json!(false);
        assert!(k.host(invalid).is_err());
        let mut invalid = h.clone();
        invalid["content"] = json!("Changed");
        assert!(k.host(invalid).is_err());
        assign(&mut k, "milo", "");
        assert!(k.host(h.clone()).is_err());
        assign(&mut k, "milo", &p);
        let s = k.host(h.clone()).unwrap();
        assert_eq!(s["handoffs"].as_array().unwrap().len(), 1);
        assert!(s["handoffs"][0]["content"].is_null());
        assert_eq!(
            k.host(h.clone()).unwrap()["handoffs"]
                .as_array()
                .unwrap()
                .len(),
            1
        );
    }
    #[test]
    fn target_only_claim_and_resume_preserve_exact_file_without_private_notebook() {
        let (mut k, _, h) = fixture();
        let private=k.desktop(json!({"action":"addNote","agentId":"ada","scope":"agent","title":"Private","content":"Do not transfer this notebook"})).unwrap();
        review(&mut k, &h, true);
        k.host(h.clone()).unwrap();
        assert!(begin(&mut k, "ada", "wrong", "handoff-one", None).is_err());
        let b = begin(&mut k, "milo", "run-one", "handoff-one", None).unwrap();
        assert_eq!(b["handoff"]["hash"], h["hash"]);
        let file = k
            .host(json!({"op":"tool","runId":"run-one","name":"handoff_read","args":{"part":0}}))
            .unwrap();
        assert_eq!(file["text"], h["content"]);
        assert!(k.host(json!({"op":"tool","runId":"run-one","name":"context_read","args":{"id":private["id"],"revision":1,"part":0}})).is_err());
        assert!(begin(&mut k, "milo", "duplicate", "handoff-one", None).is_err());
        end(&mut k, "run-one");
        assert!(begin(&mut k, "milo", "run-two", "handoff-one", Some("run-one")).is_ok());
        end(&mut k, "run-two");
        assert!(begin(&mut k, "milo", "stale", "handoff-one", Some("run-one")).is_err());
    }
    #[test]
    fn changing_project_or_reopening_source_prevents_future_handoff_use() {
        let (mut k, p, h) = fixture();
        review(&mut k, &h, true);
        k.host(h.clone()).unwrap();
        assign(&mut k, "milo", "");
        assert!(begin(&mut k, "milo", "x", "handoff-one", None).is_err());
        assign(&mut k, "milo", &p);
        let reopened = review(&mut k, &h, false);
        assert_eq!(reopened["handoffs"][0]["state"], "cancelled");
        review(&mut k, &h, true);
        assert!(begin(&mut k, "milo", "x", "handoff-one", None).is_err());
    }
    #[test]
    fn reviews_and_revisions_only_award_a_milestone_once() {
        let (mut k, _, mut h) = fixture();
        let epoch = k.epoch().unwrap();
        assert_eq!(review(&mut k, &h, true)["acceptedMilestones"], 1);
        review(&mut k, &h, false);
        assert_eq!(review(&mut k, &h, true)["acceptedMilestones"], 1);
        h["runId"] = json!("revised-run");
        assert_eq!(review(&mut k, &h, true)["acceptedMilestones"], 1);
        assert_eq!(
            k.epoch().unwrap(),
            epoch,
            "Review alone must not discard a provider session"
        );
    }
    #[test]
    fn active_context_locks_review_and_revoked_handoff_cannot_resume() {
        let (mut k, _, h) = fixture();
        review(&mut k, &h, true);
        k.host(h.clone()).unwrap();
        begin(&mut k, "milo", "run-one", "handoff-one", None).unwrap();
        assert!(k.host(json!({"op":"work_review","runId":"source-run","rootId":"root-work","agentId":"ada","accepted":false,"hashes":[]})).is_err());
        end(&mut k, "run-one");
        review(&mut k, &h, false);
        review(&mut k, &h, true);
        assert!(begin(&mut k, "milo", "run-two", "handoff-one", Some("run-one")).is_err());
    }
}
