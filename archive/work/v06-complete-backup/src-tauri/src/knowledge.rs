use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};
use uuid::Uuid;

#[path = "collaboration.rs"]
mod collaboration;
#[path = "projects.rs"]
mod projects;

type Result<T> = std::result::Result<T, String>;
fn db<T>(r: rusqlite::Result<T>) -> Result<T> {
    r.map_err(|e| format!("Could not save or read local knowledge: {e}"))
}
fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}
fn text(v: &Value, key: &str, max: usize) -> Result<String> {
    let s = v[key]
        .as_str()
        .ok_or_else(|| format!("Missing {key}"))?
        .trim();
    if s.is_empty() || s.len() > max || s.contains('\0') {
        return Err(format!("Invalid {key}"));
    }
    Ok(s.to_owned())
}
fn short(s: &str, max: usize) -> String {
    s.chars().take(max).collect()
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Chunk {
    pub locator: String,
    pub text: String,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Extracted {
    pub chunks: Vec<Chunk>,
    pub warning: String,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Entry {
    id: String,
    kind: String,
    scope: String,
    scope_id: String,
    title: String,
    body: String,
    status: String,
    revision: i64,
    active: bool,
    pinned: bool,
    author: String,
    provider: String,
    source_run: String,
    source: String,
    created_at: i64,
    updated_at: i64,
    warning: String,
    hash: String,
}
#[derive(Clone)]
struct Access {
    agent: String,
    project: String,
    provider: String,
    private_read: bool,
    handoff: String,
}
pub struct Knowledge {
    conn: Connection,
    runs: HashMap<String, Access>,
}

impl Knowledge {
    pub fn open(path: &Path) -> Result<Self> {
        let conn = db(Connection::open(path))?;
        db(conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
          CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value INTEGER NOT NULL);
          INSERT OR IGNORE INTO meta VALUES('epoch',1);
          CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,name TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS assignments(agent TEXT PRIMARY KEY,project TEXT NOT NULL REFERENCES projects(id));
          CREATE TABLE IF NOT EXISTS project_plans(project TEXT PRIMARY KEY REFERENCES projects(id),goal TEXT NOT NULL,revision INTEGER NOT NULL,updated_at INTEGER NOT NULL);
          CREATE TABLE IF NOT EXISTS project_tasks(id TEXT PRIMARY KEY,project TEXT NOT NULL REFERENCES projects(id),title TEXT NOT NULL,brief TEXT NOT NULL,agent TEXT NOT NULL,depends_on TEXT NOT NULL,revision INTEGER NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,run TEXT NOT NULL,archived INTEGER NOT NULL DEFAULT 0);
          CREATE TABLE IF NOT EXISTS entries(id TEXT PRIMARY KEY,kind TEXT NOT NULL,scope TEXT NOT NULL,scope_id TEXT NOT NULL,
            title TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL,revision INTEGER NOT NULL,active INTEGER NOT NULL,pinned INTEGER NOT NULL,
            author TEXT NOT NULL,provider TEXT NOT NULL,source_run TEXT NOT NULL,source TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,
            warning TEXT NOT NULL,hash TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS versions(id TEXT NOT NULL,revision INTEGER NOT NULL,record TEXT NOT NULL,PRIMARY KEY(id,revision));
          CREATE TABLE IF NOT EXISTS files(id TEXT NOT NULL,revision INTEGER NOT NULL,bytes BLOB NOT NULL,PRIMARY KEY(id,revision));
          CREATE TABLE IF NOT EXISTS chunks(id TEXT NOT NULL,revision INTEGER NOT NULL,part INTEGER NOT NULL,locator TEXT NOT NULL,body TEXT NOT NULL,PRIMARY KEY(id,revision,part));
          CREATE TABLE IF NOT EXISTS work_reviews(run TEXT PRIMARY KEY,reviewed_at INTEGER NOT NULL,record TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS work_awards(root TEXT PRIMARY KEY,earned_at INTEGER NOT NULL);
          CREATE TABLE IF NOT EXISTS work_handoffs(id TEXT PRIMARY KEY,source_run TEXT NOT NULL,recipient TEXT NOT NULL,project TEXT NOT NULL,created_at INTEGER NOT NULL,state TEXT NOT NULL,run TEXT NOT NULL,payload TEXT NOT NULL,source_agent TEXT NOT NULL);
          CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(id UNINDEXED,part UNINDEXED,title,body,tokenize='unicode61');"))?;
        Ok(Self {
            conn,
            runs: HashMap::new(),
        })
    }
    pub fn clear_runs(&mut self) {
        self.runs.clear();
    }
    fn idle(&self) -> Result<()> {
        if self.runs.is_empty() {
            Ok(())
        } else {
            Err("Pause running tasks before changing shared context. This keeps each run’s knowledge consistent.".into())
        }
    }
    fn epoch(&self) -> Result<i64> {
        db(self
            .conn
            .query_row("SELECT value FROM meta WHERE key='epoch'", [], |r| r.get(0)))
    }
    fn access(&self, agent: &str, provider: &str) -> Result<Access> {
        if agent.is_empty()
            || agent.len() > 64
            || !agent
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        {
            return Err("Invalid agent".into());
        }
        let project = db(self
            .conn
            .query_row(
                "SELECT project FROM assignments WHERE agent=?",
                [agent],
                |r| r.get(0),
            )
            .optional())?
        .unwrap_or_default();
        Ok(Access {
            agent: agent.into(),
            project,
            provider: provider.into(),
            private_read: false,
            handoff: String::new(),
        })
    }
    fn allowed(e: &Entry, a: &Access) -> bool {
        e.scope == "company"
            || (e.scope == "agent"
                && (e.scope_id == a.agent
                    || (!a.project.is_empty()
                        && e.scope_id == format!("{}|{}", a.agent, a.project))))
            || (e.scope == "project" && !a.project.is_empty() && e.scope_id == a.project)
    }
    fn scope_id(scope: &str, a: &Access) -> Result<String> {
        match scope {
            "company" => Ok("company".into()),
            "agent" => Ok(a.agent.clone()),
            "project" if !a.project.is_empty() => Ok(a.project.clone()),
            _ => Err("Choose a project before adding project context.".into()),
        }
    }
    fn entries(&self) -> Result<Vec<Entry>> {
        let mut q = db(self
            .conn
            .prepare("SELECT * FROM entries ORDER BY pinned DESC,updated_at DESC,id"))?;
        let rows = db(q.query_map([], |r| {
            Ok(Entry {
                id: r.get(0)?,
                kind: r.get(1)?,
                scope: r.get(2)?,
                scope_id: r.get(3)?,
                title: r.get(4)?,
                body: r.get(5)?,
                status: r.get(6)?,
                revision: r.get(7)?,
                active: r.get(8)?,
                pinned: r.get(9)?,
                author: r.get(10)?,
                provider: r.get(11)?,
                source_run: r.get(12)?,
                source: r.get(13)?,
                created_at: r.get(14)?,
                updated_at: r.get(15)?,
                warning: r.get(16)?,
                hash: r.get(17)?,
            })
        }))?;
        rows.map(db).collect()
    }
    fn entry(&self, id: &str, a: &Access, agent_tool: bool) -> Result<Entry> {
        self.entries()?
            .into_iter()
            .find(|e| {
                e.id == id
                    && Self::allowed(e, a)
                    && (!agent_tool || (e.active && e.status == "published"))
            })
            .ok_or_else(|| "This context is unavailable in the current task.".into())
    }
    fn save(&mut self, e: &Entry, chunks: &[Chunk], bytes: Option<&[u8]>) -> Result<()> {
        let tx = db(self.conn.transaction())?;
        db(tx.execute(
            "INSERT OR REPLACE INTO entries VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            params![
                e.id,
                e.kind,
                e.scope,
                e.scope_id,
                e.title,
                e.body,
                e.status,
                e.revision,
                e.active,
                e.pinned,
                e.author,
                e.provider,
                e.source_run,
                e.source,
                e.created_at,
                e.updated_at,
                e.warning,
                e.hash
            ],
        ))?;
        db(tx.execute(
            "INSERT INTO versions VALUES(?,?,?)",
            params![
                e.id,
                e.revision,
                serde_json::to_string(e).map_err(|e| e.to_string())?
            ],
        ))?;
        db(tx.execute("DELETE FROM search_index WHERE id=?", [&e.id]))?;
        for (i, c) in chunks.iter().enumerate() {
            db(tx.execute(
                "INSERT INTO chunks VALUES(?,?,?,?,?)",
                params![e.id, e.revision, i as i64, c.locator, c.text],
            ))?;
            if e.active && e.status == "published" {
                db(tx.execute(
                    "INSERT INTO search_index VALUES(?,?,?,?)",
                    params![e.id, i as i64, e.title, c.text],
                ))?;
            }
        }
        if let Some(content) = bytes {
            db(tx.execute(
                "INSERT INTO files VALUES(?,?,?)",
                params![e.id, e.revision, content],
            ))?;
        }
        db(tx.execute("UPDATE meta SET value=value+1 WHERE key='epoch'", []))?;
        db(tx.commit())
    }
    fn chunks(&self, e: &Entry) -> Result<Vec<Chunk>> {
        let mut q = db(self
            .conn
            .prepare("SELECT locator,body FROM chunks WHERE id=? AND revision=? ORDER BY part"))?;
        let rows = db(q.query_map(params![e.id, e.revision], |r| {
            Ok(Chunk {
                locator: r.get(0)?,
                text: r.get(1)?,
            })
        }))?;
        rows.map(db).collect()
    }
    fn summary(e: &Entry) -> Value {
        json!({"id":e.id,"kind":e.kind,"scope":e.scope,"scopeId":e.scope_id,"title":e.title,"status":e.status,"revision":e.revision,"pinned":e.pinned,"author":e.author,"provider":e.provider,"sourceRun":e.source_run,"source":e.source,"createdAt":e.created_at,"updatedAt":e.updated_at,"warning":e.warning,"preview":short(&e.body,180)})
    }
    fn search(&self, a: &Access, query: &str) -> Result<Vec<Value>> {
        let terms: Vec<_> = query
            .split(|c: char| !c.is_alphanumeric())
            .filter(|s| s.chars().count() > 1)
            .take(20)
            .map(|s| format!("\"{s}\"*"))
            .collect();
        if terms.is_empty() {
            return Ok(vec![]);
        }
        let allowed: HashMap<_, _> = self
            .entries()?
            .into_iter()
            .filter(|e| e.active && Self::allowed(e, a) && e.status == "published")
            .map(|e| (e.id.clone(), e))
            .collect();
        // Filter inside SQL before LIMIT so private hits cannot crowd out permitted evidence.
        let mut q=db(self.conn.prepare("SELECT s.id,s.part FROM search_index s JOIN entries e ON e.id=s.id
          WHERE search_index MATCH ? AND e.active=1 AND e.status='published' AND (e.scope='company' OR (e.scope='agent' AND (e.scope_id=? OR e.scope_id=?)) OR (e.scope='project' AND e.scope_id=? AND ?<>''))
          ORDER BY bm25(search_index,0,0,5,1),s.id,s.part LIMIT 12"))?;
        let personal_project = if a.project.is_empty() {
            String::new()
        } else {
            format!("{}|{}", a.agent, a.project)
        };
        let rows = db(q.query_map(
            params![
                terms.join(" OR "),
                a.agent,
                personal_project,
                a.project,
                a.project
            ],
            |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)? as usize)),
        ))?;
        let mut out = vec![];
        for row in rows {
            let (id, part) = db(row)?;
            if let Some(e) = allowed.get(&id) {
                if let Some(c) = self.chunks(e)?.get(part) {
                    out.push(json!({"id":id,"revision":e.revision,"part":part,"title":e.title,"scope":e.scope,"kind":e.kind,"locator":c.locator,"excerpt":short(&c.text,650)}));
                }
            }
        }
        Ok(out)
    }
    fn new_note(&mut self, a: &Access, v: &Value, run: Option<&str>) -> Result<Value> {
        let scope = text(v, "scope", 20)?;
        let mut scope_id = Self::scope_id(&scope, a)?;
        if run.is_some() {
            if scope == "company" && (!a.project.is_empty() || a.private_read) {
                return Err("This run has private or project context. Save a scoped note; the user can deliberately share a reviewed summary with the company.".into());
            }
            if scope == "project" && a.private_read {
                return Err("This run has read private context. Save a personal note; the user can share a reviewed summary with the project.".into());
            }
            if scope == "agent" && !a.project.is_empty() {
                scope_id = format!("{}|{}", a.agent, a.project);
            }
        }
        let title = text(v, "title", 160)?;
        let body = text(v, "content", 8000)?;
        let stamp = now();
        let e = Entry {
            id: Uuid::new_v4().to_string(),
            kind: "note".into(),
            scope: scope.clone(),
            scope_id,
            title,
            body: body.clone(),
            status: if run.is_some() && scope == "company" {
                "proposal"
            } else {
                "published"
            }
            .into(),
            revision: 1,
            active: true,
            pinned: run.is_none() && v["pinned"] == true,
            author: if run.is_some() {
                a.agent.clone()
            } else {
                "You".into()
            },
            provider: if run.is_some() {
                a.provider.clone()
            } else {
                String::new()
            },
            source_run: run.unwrap_or_default().into(),
            source: v["source"]
                .as_str()
                .unwrap_or_default()
                .chars()
                .take(1000)
                .collect(),
            created_at: stamp,
            updated_at: stamp,
            warning: String::new(),
            hash: format!("{:x}", Sha256::digest(body.as_bytes())),
        };
        if let Some(existing) = self.entries()?.iter().find(|x| {
            x.active
                && x.scope == e.scope
                && x.scope_id == e.scope_id
                && x.title == e.title
                && x.hash == e.hash
                && x.source_run == e.source_run
        }) {
            return Ok(Self::summary(existing));
        }
        self.save(&e, &split_text(&body, "Note"), None)?;
        Ok(Self::summary(&e))
    }
    pub fn desktop(&mut self, v: Value) -> Result<Value> {
        let a = self.access(v["agentId"].as_str().unwrap_or("owner"), "")?;
        match v["action"].as_str().unwrap_or("") {
            "list" => {
                let mut q = db(self
                    .conn
                    .prepare("SELECT id,name FROM projects ORDER BY name"))?;
                let projects: Vec<Value> = db(q.query_map([], |r| {
                    Ok(json!({"id":r.get::<_,String>(0)?,"name":r.get::<_,String>(1)?}))
                }))?
                .map(db)
                .collect::<Result<_>>()?;
                Ok(
                    json!({"entries":self.entries()?.iter().filter(|e|Self::allowed(e,&a)&&(e.active || v["archived"]==true)).map(|e|{let mut s=Self::summary(e);s["active"]=json!(e.active);s}).collect::<Vec<_>>(),"projects":projects,"projectId":a.project,"busy":!self.runs.is_empty()}),
                )
            }
            "read" => {
                let e = self.entry(&text(&v, "id", 80)?, &a, false)?;
                let chunks = self.chunks(&e)?;
                let mut q = db(self.conn.prepare(
                    "SELECT record FROM versions WHERE id=? ORDER BY revision DESC LIMIT 20",
                ))?;
                let versions: Vec<Value> = db(q.query_map([&e.id], |r| r.get::<_, String>(0)))?
                    .map(|r| {
                        db(r).and_then(|s| serde_json::from_str(&s).map_err(|e| e.to_string()))
                    })
                    .collect::<Result<_>>()?;
                Ok(json!({"entry":e,"chunks":chunks,"versions":versions}))
            }
            "addNote" => {
                self.idle()?;
                self.new_note(&a, &v, None)
            }
            "editNote" | "publish" | "archive" | "restore" => {
                self.idle()?;
                let mut e = self.entry(&text(&v, "id", 80)?, &a, false)?;
                if v["revision"].as_i64() != Some(e.revision) {
                    return Err("This entry changed. Reopen it before saving.".into());
                }
                let mut chunks = self.chunks(&e)?;
                match v["action"].as_str().unwrap() {
                    "editNote" => {
                        if e.kind != "note" {
                            return Err("Only notes can be edited here.".into());
                        }
                        e.title = text(&v, "title", 160)?;
                        e.body = text(&v, "content", 8000)?;
                        e.pinned = v["pinned"] == true;
                        e.source = v["source"]
                            .as_str()
                            .unwrap_or_default()
                            .chars()
                            .take(1000)
                            .collect();
                        chunks = split_text(&e.body, "Note");
                        e.hash = format!("{:x}", Sha256::digest(e.body.as_bytes()));
                    }
                    "publish" => e.status = "published".into(),
                    "archive" => e.active = false,
                    "restore" => e.active = true,
                    _ => {}
                }
                e.revision += 1;
                e.updated_at = now();
                e.author = "You".into();
                self.save(&e, &chunks, None)?;
                Ok(Self::summary(&e))
            }
            "createProject" => {
                self.idle()?;
                let id = Uuid::new_v4().to_string();
                db(self.conn.execute(
                    "INSERT INTO projects VALUES(?,?)",
                    params![id, text(&v, "name", 120)?],
                ))?;
                Ok(json!({"id":id}))
            }
            "assignProject" => {
                self.idle()?;
                let project = v["projectId"].as_str().unwrap_or("");
                if project.is_empty() {
                    db(self
                        .conn
                        .execute("DELETE FROM assignments WHERE agent=?", [&a.agent]))?;
                } else {
                    db(self.conn.execute(
                        "INSERT OR REPLACE INTO assignments VALUES(?,?)",
                        params![a.agent, project],
                    ))?;
                }
                db(self
                    .conn
                    .execute("UPDATE meta SET value=value+1 WHERE key='epoch'", []))?;
                Ok(json!({}))
            }
            _ => Err("Unknown context action".into()),
        }
    }
    pub fn import(
        &mut self,
        agent: &str,
        scope: &str,
        name: &str,
        bytes: &[u8],
        extracted: Extracted,
    ) -> Result<Value> {
        self.idle()?;
        let a = self.access(agent, "")?;
        let scope_id = Self::scope_id(scope, &a)?;
        if name.len() > 180
            || bytes.is_empty()
            || bytes.len() > 10 * 1024 * 1024
            || extracted.chunks.is_empty()
        {
            return Err(
                "The file could not be imported. Choose a readable file up to 10 MB.".into(),
            );
        }
        let hash = format!("{:x}", Sha256::digest(bytes));
        if let Some(e) = self.entries()?.iter().find(|e| {
            e.active
                && e.kind == "file"
                && e.scope == scope
                && e.scope_id == scope_id
                && e.hash == hash
        }) {
            return Ok(Self::summary(e));
        }
        let stamp = now();
        let e = Entry {
            id: Uuid::new_v4().to_string(),
            kind: "file".into(),
            scope: scope.into(),
            scope_id,
            title: name.into(),
            body: extracted
                .chunks
                .iter()
                .map(|c| c.text.as_str())
                .collect::<Vec<_>>()
                .join("\n"),
            status: "published".into(),
            revision: 1,
            active: true,
            pinned: false,
            author: "You".into(),
            provider: String::new(),
            source_run: String::new(),
            source: name.into(),
            created_at: stamp,
            updated_at: stamp,
            warning: extracted.warning,
            hash,
        };
        self.save(&e, &extracted.chunks, Some(bytes))?;
        Ok(Self::summary(&e))
    }
    pub fn host(&mut self, v: Value) -> Result<Value> {
        if v["op"].as_str().unwrap_or("").starts_with("work_project_")
            || v["op"].as_str().unwrap_or("").starts_with("work_task_")
        {
            return self.project_command(v);
        }
        if v["op"].as_str().unwrap_or("").starts_with("work_") {
            return self.work_command(v);
        }
        let run = text(&v, "runId", 80)?;
        match v["op"].as_str().unwrap_or("") {
            "begin" => {
                let agent = text(&v, "agentId", 64)?;
                let provider = text(&v, "provider", 12)?;
                if !["codex", "claude"].contains(&provider.as_str()) {
                    return Err("Invalid provider".into());
                }
                let mut a = self.access(&agent, &provider)?;
                self.check_task_run(&a, &v)?;
                let handoff = self.claim_handoff(&a, &v)?;
                a.handoff = handoff
                    .as_ref()
                    .and_then(|h| h["id"].as_str())
                    .unwrap_or("")
                    .to_owned();
                let mut items = vec![];
                if let Some(goal) = self.project_goal(&a.project)? {
                    items.push(goal);
                }
                for e in self
                    .entries()?
                    .iter()
                    .filter(|e| {
                        e.active && Self::allowed(e, &a) && e.status == "published" && e.pinned
                    })
                    .take(4)
                {
                    items.push(json!({"id":e.id,"revision":e.revision,"title":e.title,"scope":e.scope,"part":0,"locator":"Note","excerpt":short(&e.body,650)}));
                }
                for hit in self.search(&a, v["query"].as_str().unwrap_or(""))? {
                    if items.len() >= 8 {
                        break;
                    }
                    if !items
                        .iter()
                        .any(|i| i["id"] == hit["id"] && i["part"] == hit["part"])
                    {
                        items.push(hit)
                    }
                }
                let context_key = self.epoch()?.to_string();
                a.private_read = items.iter().any(|i| i["scope"] == "agent")
                    || (v["previousContextKey"].as_str() == Some(context_key.as_str())
                        && v["previousPrivateContext"] == true);
                let result = json!({"contextKey":context_key,"projectId":a.project,"items":items,"privateContext":a.private_read,"handoff":handoff});
                self.runs.insert(run, a);
                Ok(result)
            }
            "end" => {
                self.runs.remove(&run);
                Ok(json!({}))
            }
            "tool" => {
                let a = self
                    .runs
                    .get(&run)
                    .cloned()
                    .ok_or("This task no longer has context access.")?;
                let args = &v["args"];
                match v["name"].as_str().unwrap_or("") {
                    "handoff_read" => self
                        .handoff_passage(&a.handoff, args["part"].as_u64().unwrap_or(0) as usize),
                    "context_list" => {
                        let entries: Vec<_> = self
                            .entries()?
                            .iter()
                            .filter(|e| e.active && Self::allowed(e, &a) && e.status == "published")
                            .take(150)
                            .map(Self::summary)
                            .collect();
                        if entries.iter().any(|e| e["scope"] == "agent") {
                            self.runs.get_mut(&run).unwrap().private_read = true;
                        }
                        Ok(
                            json!({"entries":entries,"note":"Company context is shared. Personal and project context is scoped to this task. This list includes at most 150 items; use search to find others."}),
                        )
                    }
                    "context_search" => {
                        let matches = self.search(&a, &text(args, "query", 600)?)?;
                        if matches.iter().any(|e| e["scope"] == "agent") {
                            self.runs.get_mut(&run).unwrap().private_read = true;
                        }
                        Ok(json!({"matches":matches}))
                    }
                    "context_read" => {
                        let e = self.entry(&text(args, "id", 80)?, &a, true)?;
                        if e.scope == "agent" {
                            self.runs.get_mut(&run).unwrap().private_read = true;
                        }
                        if args["revision"].as_i64() != Some(e.revision) {
                            return Err("That source version changed. Search again.".into());
                        }
                        let chunks = self.chunks(&e)?;
                        let part = args["part"].as_u64().unwrap_or(0) as usize;
                        let c = chunks.get(part).ok_or("That passage does not exist.")?;
                        Ok(
                            json!({"id":e.id,"revision":e.revision,"title":e.title,"scope":e.scope,"part":part,"parts":chunks.len(),"locator":c.locator,"text":c.text,"warning":e.warning}),
                        )
                    }
                    "memory_append" => self.new_note(&a, args, Some(&run)),
                    _ => Err("Unknown context tool".into()),
                }
            }
            _ => Err("Unknown context request".into()),
        }
    }
}

pub fn split_text(body: &str, label: &str) -> Vec<Chunk> {
    let mut chunks = vec![];
    let mut buf = String::new();
    let mut start = 1;
    let mut last = 1;
    for (i, line) in body.lines().enumerate() {
        last = i + 1;
        for fragment in line.chars().collect::<Vec<_>>().chunks(1400) {
            let piece: String = fragment.iter().collect();
            if buf.chars().count() + piece.chars().count() > 1800 && !buf.is_empty() {
                chunks.push(Chunk {
                    locator: format!("{label} · lines {start}–{}", i + 1),
                    text: std::mem::take(&mut buf),
                });
                start = i + 1;
            }
            buf.push_str(&piece);
            buf.push('\n');
        }
    }
    if !buf.trim().is_empty() {
        chunks.push(Chunk {
            locator: format!("{label} · lines {start}–{last}"),
            text: buf,
        });
    }
    chunks
}

#[cfg(test)]
mod tests {
    use super::*;
    fn store() -> Knowledge {
        Knowledge::open(Path::new(":memory:")).unwrap()
    }
    fn note(k: &mut Knowledge, agent: &str, scope: &str, title: &str, body: &str) -> Value {
        k.desktop(
            json!({"action":"addNote","agentId":agent,"scope":scope,"title":title,"content":body}),
        )
        .unwrap()
    }
    fn project(k: &mut Knowledge, agent: &str, name: &str) -> String {
        let id = k
            .desktop(json!({"action":"createProject","name":name}))
            .unwrap()["id"]
            .as_str()
            .unwrap()
            .to_owned();
        assign(k, agent, &id);
        id
    }
    fn assign(k: &mut Knowledge, agent: &str, id: &str) {
        k.desktop(json!({"action":"assignProject","agentId":agent,"projectId":id}))
            .unwrap();
    }
    fn begin(k: &mut Knowledge, agent: &str, provider: &str) -> Value {
        k.host(
            json!({"op":"begin","runId":"run","agentId":agent,"provider":provider,"query":"atlas"}),
        )
        .unwrap()
    }
    fn end(k: &mut Knowledge) {
        k.host(json!({"op":"end","runId":"run"})).unwrap();
    }
    fn tool(k: &mut Knowledge, name: &str, args: Value) -> Result<Value> {
        k.host(json!({"op":"tool","runId":"run","name":name,"args":args}))
    }
    #[test]
    fn scoped_retrieval_and_guessed_ids_do_not_leak() {
        let mut k = store();
        let p = project(&mut k, "ada", "Atlas");
        assign(&mut k, "milo", &p);
        let private = note(&mut k, "ada", "agent", "Atlas private", "atlas secret");
        let shared = note(&mut k, "ada", "project", "Atlas project", "atlas shared");
        note(&mut k, "ada", "company", "Atlas company", "atlas mission");
        begin(&mut k, "milo", "codex");
        let hits = tool(&mut k, "context_search", json!({"query":"atlas"})).unwrap();
        assert_eq!(hits["matches"].as_array().unwrap().len(), 2);
        assert!(tool(
            &mut k,
            "context_read",
            json!({"id":private["id"],"revision":1,"part":0})
        )
        .is_err());
        end(&mut k);
        assign(&mut k, "milo", "");
        begin(&mut k, "milo", "claude");
        assert!(tool(
            &mut k,
            "context_read",
            json!({"id":shared["id"],"revision":1,"part":0})
        )
        .is_err());
        assert_eq!(
            tool(&mut k, "context_list", json!({})).unwrap()["entries"]
                .as_array()
                .unwrap()
                .len(),
            1
        );
    }
    #[test]
    fn provider_switch_keeps_memory_and_changed_revisions_change_context_key() {
        let mut k = store();
        let n = note(&mut k, "ada", "agent", "Atlas nickname", "atlas is Juniper");
        let first = begin(&mut k, "ada", "codex");
        end(&mut k);
        let second = begin(&mut k, "ada", "claude");
        assert_eq!(first, second);
        end(&mut k);
        k.desktop(json!({"action":"editNote","agentId":"ada","id":n["id"],"revision":1,"title":"Atlas nickname","content":"atlas is Cedar","source":"Correction"})).unwrap();
        assert!(k.desktop(json!({"action":"editNote","agentId":"ada","id":n["id"],"revision":1,"title":"Old","content":"Old"})).is_err());
        let next = begin(&mut k, "ada", "codex");
        assert_ne!(first["contextKey"], next["contextKey"]);
        assert!(tool(
            &mut k,
            "context_read",
            json!({"id":n["id"],"revision":1,"part":0})
        )
        .is_err());
        let new = tool(
            &mut k,
            "context_read",
            json!({"id":n["id"],"revision":2,"part":0}),
        )
        .unwrap();
        assert!(new["text"].as_str().unwrap().contains("Cedar"));
        end(&mut k);
        let read = k
            .desktop(json!({"action":"read","agentId":"ada","id":n["id"]}))
            .unwrap();
        assert_eq!(read["entry"]["source"], "Correction");
        assert_eq!(read["versions"].as_array().unwrap().len(), 2);
    }
    #[test]
    fn company_proposals_require_owner_review_and_edits_wait_for_runs() {
        let mut k = store();
        begin(&mut k, "ada", "codex");
        let n=tool(&mut k,"memory_append",json!({"scope":"company","title":"Atlas learning","content":"atlas is evergreen","source":"Observed reference"})).unwrap();
        assert_eq!(n["status"], "proposal");
        assert!(tool(&mut k, "context_list", json!({})).unwrap()["entries"]
            .as_array()
            .unwrap()
            .is_empty());
        assert!(k
            .desktop(json!({"action":"publish","agentId":"ada","id":n["id"],"revision":1}))
            .is_err());
        end(&mut k);
        assert!(tool(&mut k, "context_list", json!({})).is_err());
        k.desktop(json!({"action":"publish","agentId":"ada","id":n["id"],"revision":1}))
            .unwrap();
        begin(&mut k, "milo", "claude");
        assert_eq!(
            tool(&mut k, "context_list", json!({})).unwrap()["entries"][0]["status"],
            "published"
        );
    }
    #[test]
    fn derived_notes_cannot_widen_private_or_project_context() {
        let mut k = store();
        let p = project(&mut k, "ada", "Atlas");
        note(&mut k, "ada", "agent", "Atlas secret", "atlas confidential");
        begin(&mut k, "ada", "codex");
        for scope in ["company", "project"] {
            assert!(tool(
                &mut k,
                "memory_append",
                json!({"scope":scope,"title":"Copied","content":"Secret"})
            )
            .is_err())
        }
        let derived = tool(
            &mut k,
            "memory_append",
            json!({"scope":"agent","title":"Atlas lesson","content":"atlas lesson"}),
        )
        .unwrap();
        assert_eq!(derived["scopeId"], format!("ada|{p}"));
        end(&mut k);
        assign(&mut k, "ada", "");
        begin(&mut k, "ada", "claude");
        assert!(tool(
            &mut k,
            "context_read",
            json!({"id":derived["id"],"revision":1,"part":0})
        )
        .is_err());
    }
    #[test]
    fn archive_revokes_search_and_restore_keeps_history_and_original_bytes() {
        let mut k = store();
        let bytes = b"atlas imported fact";
        let n = k
            .import(
                "ada",
                "company",
                "atlas.txt",
                bytes,
                Extracted {
                    chunks: split_text("atlas imported fact", "Text"),
                    warning: String::new(),
                },
            )
            .unwrap();
        let dup = k
            .import(
                "milo",
                "company",
                "renamed.txt",
                bytes,
                Extracted {
                    chunks: split_text("atlas imported fact", "Text"),
                    warning: String::new(),
                },
            )
            .unwrap();
        assert_eq!(n["id"], dup["id"]);
        k.desktop(json!({"action":"archive","agentId":"ada","id":n["id"],"revision":1}))
            .unwrap();
        begin(&mut k, "ada", "codex");
        assert!(
            tool(&mut k, "context_search", json!({"query":"atlas"})).unwrap()["matches"]
                .as_array()
                .unwrap()
                .is_empty()
        );
        end(&mut k);
        k.desktop(json!({"action":"restore","agentId":"ada","id":n["id"],"revision":2}))
            .unwrap();
        begin(&mut k, "ada", "claude");
        assert_eq!(
            tool(&mut k, "context_search", json!({"query":"atlas"})).unwrap()["matches"][0]
                ["revision"],
            3
        );
        let original: Vec<u8> = k
            .conn
            .query_row(
                "SELECT bytes FROM files WHERE id=? AND revision=1",
                [n["id"].as_str().unwrap()],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(original, bytes);
    }
    #[test]
    fn continued_history_keeps_private_scope_until_context_is_reset() {
        let mut k = store();
        let n = note(&mut k, "ada", "agent", "Atlas secret", "atlas confidential");
        let first = begin(&mut k, "ada", "codex");
        assert_eq!(first["privateContext"], true);
        end(&mut k);
        let next=k.host(json!({"op":"begin","runId":"run","agentId":"ada","provider":"codex","query":"unrelated","previousContextKey":first["contextKey"],"previousPrivateContext":true})).unwrap();
        assert!(next["items"].as_array().unwrap().is_empty());
        assert_eq!(next["privateContext"], true);
        assert!(tool(
            &mut k,
            "memory_append",
            json!({"scope":"company","title":"Private copy","content":"confidential"})
        )
        .is_err());
        end(&mut k);
        k.desktop(json!({"action":"archive","agentId":"ada","id":n["id"],"revision":1}))
            .unwrap();
        let fresh=k.host(json!({"op":"begin","runId":"run","agentId":"ada","provider":"codex","query":"unrelated","previousContextKey":first["contextKey"],"previousPrivateContext":true})).unwrap();
        assert_eq!(fresh["privateContext"], false);
    }
    #[test]
    fn private_matches_cannot_crowd_public_results_out_of_limit() {
        let mut k = store();
        for n in 0..20 {
            note(
                &mut k,
                "ada",
                "agent",
                &format!("Atlas {n}"),
                "atlas atlas atlas",
            );
        }
        note(&mut k, "ada", "company", "Shared atlas", "atlas");
        begin(&mut k, "milo", "codex");
        assert_eq!(
            tool(&mut k, "context_search", json!({"query":"atlas"})).unwrap()["matches"]
                .as_array()
                .unwrap()
                .len(),
            1
        );
    }
}
