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
        let mut q = db(self
            .conn
            .prepare("SELECT id,name FROM projects ORDER BY name"))?;
        let projects: Vec<Value> = db(q.query_map([], |r| {
            Ok(json!({"id":r.get::<_,String>(0)?,"name":r.get::<_,String>(1)?}))
        }))?
        .map(db)
        .collect::<Result<_>>()?;
        let mut q = db(self.conn.prepare("SELECT agent,project FROM assignments"))?;
        let assignments: HashMap<String, String> =
            db(q.query_map([], |r| Ok((r.get(0)?, r.get(1)?))))?
                .map(db)
                .collect::<Result<_>>()?;
        let awards: i64 = db(self
            .conn
            .query_row("SELECT COUNT(*) FROM work_awards", [], |r| r.get(0)))?;
        Ok(
            json!({"reviews":reviews,"handoffs":handoffs,"projects":projects,"assignments":assignments,"acceptedMilestones":awards,"busy":!self.runs.is_empty()}),
        )
    }
    fn review_record(&self, run: &str) -> Result<Value> {
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
    fn handoff_record(&self, id: &str) -> Result<(Value, String, String)> {
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
                    {
                        return self.work_status();
                    }
                    return Err(
                        "This handoff request already exists with different content.".into(),
                    );
                }
                let stamp = now();
                let h = json!({"id":id,"sourceRun":run,"sourceAgent":source,"recipient":recipient,"projectId":project,"projectName":project_name,"fileName":file,"hash":hash,"content":content,"brief":brief,"createdAt":stamp,"sourceReviewedAt":review["reviewedAt"]});
                db(self.conn.execute(
                    "INSERT INTO work_handoffs VALUES(?,?,?,?,?,'queued','',?,?)",
                    params![id, run, recipient, project, stamp, h.to_string(), source],
                ))?;
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
    pub(super) fn claim_handoff(&mut self, a: &Access, v: &Value) -> Result<Option<Value>> {
        let Some(id) = v["handoffId"].as_str().filter(|s| !s.is_empty()) else {
            return Ok(None);
        };
        let (h, state, run) = self.handoff_record(id)?;
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
        db(self.conn.execute(
            "UPDATE work_handoffs SET state='started',run=? WHERE id=?",
            params![v["runId"].as_str().unwrap_or(""), id],
        ))?;
        let mut meta = h;
        meta.as_object_mut().unwrap().remove("content");
        Ok(Some(meta))
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
