use super::*;

// Desktop document viewer/editor for context and task files. Text formats can be edited by the
// user; every save is a new revision (original bytes, extracted passages and search index).
const TEXT_FORMATS: [&str; 4] = ["md", "txt", "csv", "json"];
fn text_format(e: &Entry) -> Option<String> {
    if e.kind == "note" {
        return Some("md".into());
    }
    let ext = e.title.rsplit_once('.')?.1.to_ascii_lowercase();
    TEXT_FORMATS.contains(&ext.as_str()).then_some(ext)
}

impl Knowledge {
    /// Full text for the viewer: the saved original for text files, the note body, or the extracted passages.
    pub(super) fn document(&self, e: &Entry) -> Result<Value> {
        let format = text_format(e);
        let text = match (&format, e.kind.as_str()) {
            (Some(_), "file") => db(self
                .conn
                .query_row(
                    "SELECT bytes FROM files WHERE id=? ORDER BY revision DESC LIMIT 1",
                    [&e.id],
                    |r| r.get::<_, Vec<u8>>(0),
                )
                .optional())?
            .map(|b| String::from_utf8_lossy(&b).into_owned())
            .unwrap_or_else(|| e.body.clone()),
            _ => e.body.clone(),
        };
        Ok(json!({
            "entry": Self::summary(e),
            "text": text,
            "format": format.clone().unwrap_or_else(|| "text".into()),
            "editable": e.active && format.is_some() && e.kind == "file",
        }))
    }
    /// Replace a text file's content with the user's edit as a new revision.
    pub(super) fn edit_document(&mut self, mut e: Entry, revision: i64, content: &str) -> Result<Value> {
        let ext = match text_format(&e) {
            Some(ext) if e.kind == "file" => ext,
            _ => return Err("Only Markdown, TXT, CSV and JSON files can be edited here.".into()),
        };
        if !e.active {
            return Err("Restore this file before editing it.".into());
        }
        if revision != e.revision {
            return Err("This file changed since you opened it. Reopen it before saving.".into());
        }
        let extracted = crate::context_files::extract(content.as_bytes(), &ext)?;
        e.body = extracted
            .chunks
            .iter()
            .map(|c| c.text.as_str())
            .collect::<Vec<_>>()
            .join("\n");
        e.warning = extracted.warning;
        e.hash = format!("{:x}", Sha256::digest(content.as_bytes()));
        e.revision += 1;
        e.updated_at = now();
        e.author = "You".into();
        self.save(&e, &extracted.chunks, Some(content.as_bytes()))?;
        self.document(&e)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn import(k: &mut Knowledge, name: &str, body: &str) -> Value {
        k.import(
            "ada",
            "company",
            name,
            body.as_bytes(),
            Extracted { chunks: split_text(body, "Text"), warning: String::new() },
        )
        .unwrap()
    }
    #[test]
    fn text_files_open_whole_and_edits_are_new_searchable_revisions() {
        let mut k = Knowledge::open(Path::new(":memory:")).unwrap();
        let f = import(&mut k, "brief.md", "# Atlas\n\nOld plan");
        let doc = k.desktop(json!({"action":"document","agentId":"ada","id":f["id"]})).unwrap();
        assert_eq!(doc["text"], "# Atlas\n\nOld plan");
        assert_eq!(doc["format"], "md");
        assert_eq!(doc["editable"], true);
        let saved = k
            .desktop(json!({"action":"editFile","agentId":"ada","id":f["id"],"revision":1,"content":"# Atlas\n\nNew zephyr plan"}))
            .unwrap();
        assert_eq!(saved["entry"]["revision"], 2);
        assert_eq!(saved["text"], "# Atlas\n\nNew zephyr plan");
        // Stale revision is refused; the search index follows the edit.
        let stale = k.desktop(json!({"action":"editFile","agentId":"ada","id":f["id"],"revision":1,"content":"x"}));
        assert!(stale.unwrap_err().contains("changed"));
        let read = k.desktop(json!({"action":"read","agentId":"ada","id":f["id"]})).unwrap();
        assert_eq!(read["versions"].as_array().unwrap().len(), 2);
        assert!(read["chunks"].to_string().contains("zephyr"));
    }
    #[test]
    fn notes_and_binary_formats_are_not_edited_as_files() {
        let mut k = Knowledge::open(Path::new(":memory:")).unwrap();
        let n = k
            .desktop(json!({"action":"addNote","agentId":"ada","scope":"company","title":"Tone","content":"Be brief"}))
            .unwrap();
        let doc = k.desktop(json!({"action":"document","agentId":"ada","id":n["id"]})).unwrap();
        assert_eq!(doc["editable"], false);
        assert!(k
            .desktop(json!({"action":"editFile","agentId":"ada","id":n["id"],"revision":1,"content":"x"}))
            .is_err());
        let pdf = import(&mut k, "report.pdf", "extracted text");
        let doc = k.desktop(json!({"action":"document","agentId":"ada","id":pdf["id"]})).unwrap();
        assert_eq!((doc["format"].as_str(), doc["editable"].as_bool()), (Some("text"), Some(false)));
    }
}
