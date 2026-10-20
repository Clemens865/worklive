use crate::knowledge::{split_text, Extracted};
use quick_xml::{events::Event, Reader};
use std::{
    io::{Cursor, Read},
    path::Path,
    process::{Command, Stdio},
    time::{Duration, Instant},
};

pub const MAX_BYTES: usize = 10 * 1024 * 1024;
pub fn extension(name: &str) -> Result<String, String> {
    let ext = Path::new(name)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !["txt", "md", "csv", "json", "pdf", "docx"].contains(&ext.as_str()) {
        return Err("Choose TXT, Markdown, CSV, JSON, a text PDF, or DOCX. Images and spreadsheets are not supported yet.".into());
    }
    Ok(ext)
}
pub fn extract(bytes: &[u8], ext: &str) -> Result<Extracted, String> {
    if bytes.is_empty() || bytes.len() > MAX_BYTES {
        return Err("Choose a file between 1 byte and 10 MB.".into());
    }
    let mut warning = String::new();
    let sections: Vec<(String, String)> = match ext {
        "pdf" => {
            warning = "Text layer only. Images and scanned content are not interpreted.".into();
            let pages = pdf_extract::extract_text_from_mem_by_pages(bytes).map_err(|_| {
                "This PDF could not be read. It may be protected, scanned, or damaged."
            })?;
            if pages.len() > 200 {
                return Err("This PDF exceeds 200 pages. Attach a smaller document.".into());
            }
            let empty: Vec<_> = pages
                .iter()
                .enumerate()
                .filter(|(_, p)| p.trim().is_empty())
                .map(|(i, _)| (i + 1).to_string())
                .collect();
            if !empty.is_empty() {
                warning=format!("No readable text on pages {}. Images and scanned text have not been interpreted.",empty.join(", "));
            }
            pages
                .into_iter()
                .enumerate()
                .map(|(i, p)| (format!("Page {}", i + 1), p))
                .collect()
        }
        "docx" => {
            let mut zip = zip::ZipArchive::new(Cursor::new(bytes))
                .map_err(|_| "This Word document could not be opened.")?;
            let file = zip
                .by_name("word/document.xml")
                .map_err(|_| "The document has no readable Word body.")?;
            if file.size() > 4 * 1024 * 1024 {
                return Err(
                    "The expanded Word document is too large. Attach a smaller document.".into(),
                );
            }
            let mut xml = String::new();
            file.take(4 * 1024 * 1024 + 1)
                .read_to_string(&mut xml)
                .map_err(|_| "The Word text is invalid.")?;
            let mut reader = Reader::from_str(&xml);
            let mut body = String::new();
            let mut in_text = false;
            loop {
                match reader
                    .read_event()
                    .map_err(|_| "The Word text is damaged.")?
                {
                    Event::Start(e) => {
                        in_text = e.name().as_ref() == b"w:t";
                    }
                    Event::Text(e) if in_text => {
                        body.push_str(&e.unescape().map_err(|_| "The Word text is invalid.")?)
                    }
                    Event::End(e) => {
                        if e.name().as_ref() == b"w:p" || e.name().as_ref() == b"w:tr" {
                            body.push('\n')
                        } else if e.name().as_ref() == b"w:tc" {
                            body.push('\t')
                        }
                        in_text = false;
                    }
                    Event::Empty(e) => {
                        if [b"w:br".as_slice(), b"w:cr"].contains(&e.name().as_ref()) {
                            body.push('\n')
                        } else if e.name().as_ref() == b"w:tab" {
                            body.push('\t')
                        }
                    }
                    Event::Eof => break,
                    _ => {}
                }
            }
            warning="Main document text only. Images, comments, headers, footnotes and layout are not interpreted.".into();
            vec![("Document".into(), body)]
        }
        _ => {
            let body = String::from_utf8(bytes.to_vec())
                .map_err(|_| "This text file is not UTF-8. Save it as UTF-8 and try again.")?;
            if body.contains('\0') {
                return Err("This is a binary file, not readable text.".into());
            }
            vec![("Text".into(), body)]
        }
    };
    if sections.iter().map(|(_, b)| b.len()).sum::<usize>() > 800_000 {
        return Err("The extracted text exceeds 800 KB. Attach a smaller document; nothing was silently truncated.".into());
    }
    let chunks = sections
        .iter()
        .flat_map(|(label, body)| split_text(body, label))
        .collect::<Vec<_>>();
    if chunks.is_empty() {
        return Err("No readable text was found. Scans and images need OCR, which is not available in this release.".into());
    }
    Ok(Extracted { chunks, warning })
}

// Parse documents in a disposable process so a damaged parser input cannot take
// down the office. The process has time and memory limits and no model connection.
pub fn isolated_extract(dir: &Path, name: &str, bytes: &[u8]) -> Result<Extracted, String> {
    let ext = extension(name)?;
    if bytes.is_empty() || bytes.len() > MAX_BYTES {
        return Err("Choose a file between 1 byte and 10 MB.".into());
    }
    let work = dir.join(format!("import-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&work).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&work, std::fs::Permissions::from_mode(0o700));
    }
    let result = (|| {
        let input = work.join(format!("source.{ext}"));
        let output = work.join("extracted.json");
        std::fs::write(&input, bytes).map_err(|e| e.to_string())?;
        let mut child = Command::new(std::env::current_exe().map_err(|e| e.to_string())?)
            .arg("--worklive-extract")
            .arg(&input)
            .arg(&output)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| e.to_string())?;
        let deadline = Instant::now() + Duration::from_secs(20);
        loop {
            match child.try_wait() {
                Ok(Some(status)) => {
                    if !status.success() {
                        return Err("The file parser could not finish safely. Try a smaller or simpler file.".into());
                    }
                    break;
                }
                Ok(None) => {}
                Err(e) => {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(e.to_string());
                }
            }
            if Instant::now() > deadline {
                let _ = child.kill();
                let _ = child.wait();
                return Err("Preparing the file took too long. Try a smaller document.".into());
            }
            std::thread::sleep(Duration::from_millis(40));
        }
        serde_json::from_slice::<Result<Extracted, String>>(
            &std::fs::read(output).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?
    })();
    let _ = std::fs::remove_dir_all(work);
    result
}
pub fn run_helper() -> bool {
    let args: Vec<_> = std::env::args().collect();
    if args.get(1).map(String::as_str) != Some("--worklive-extract") {
        return false;
    }
    if args.len() != 4 {
        return true;
    }
    #[cfg(unix)]
    unsafe {
        let cpu = libc::rlimit {
            rlim_cur: 15,
            rlim_max: 15,
        };
        libc::setrlimit(libc::RLIMIT_CPU, &cpu);
        let files = libc::rlimit {
            rlim_cur: 4 * 1024 * 1024,
            rlim_max: 4 * 1024 * 1024,
        };
        libc::setrlimit(libc::RLIMIT_FSIZE, &files);
        let memory = libc::rlimit {
            rlim_cur: 2 * 1024 * 1024 * 1024,
            rlim_max: 2 * 1024 * 1024 * 1024,
        };
        libc::setrlimit(libc::RLIMIT_AS, &memory);
    }
    let result = std::fs::metadata(&args[2])
        .map_err(|e| e.to_string())
        .and_then(|m| {
            if m.len() > MAX_BYTES as u64 {
                Err("File too large".into())
            } else {
                std::fs::read(&args[2]).map_err(|e| e.to_string())
            }
        })
        .and_then(|b| extension(&args[2]).and_then(|ext| extract(&b, &ext)));
    if let Ok(bytes) = serde_json::to_vec(&result) {
        let _ = std::fs::write(&args[3], bytes);
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    #[test]
    fn rejects_empty_binary_invalid_and_oversized_documents() {
        assert!(extension("sheet.xlsx").is_err());
        assert!(extract(b"\0binary", "txt").is_err());
        assert!(extract(b"\xff", "txt").is_err());
        assert!(extract(b"   \n", "txt").is_err());
        assert!(extract(b"broken", "pdf").is_err());
        assert!(extract(b"broken", "docx").is_err());
        assert!(extract(&vec![b'a'; 800_001], "txt").is_err());
    }
    #[test]
    fn unicode_chunks_preserve_content_and_locators() {
        let body = format!("First line\n{}\nFinal line", "é🌿".repeat(1800));
        let out = extract(body.as_bytes(), "txt").unwrap();
        assert!(out.chunks.len() > 2);
        assert!(out
            .chunks
            .iter()
            .all(|c| c.text.chars().count() <= 1801 && c.locator.contains("lines")));
        let compact: String = out
            .chunks
            .iter()
            .map(|c| c.text.replace('\n', ""))
            .collect();
        assert_eq!(compact, body.replace('\n', ""));
    }
    #[test]
    fn word_body_extracts_text_and_reports_omissions() {
        let mut z = zip::ZipWriter::new(Cursor::new(Vec::new()));
        z.start_file(
            "word/document.xml",
            zip::write::SimpleFileOptions::default(),
        )
        .unwrap();
        z.write_all(br#"<w:document xmlns:w="test"><w:body><w:p><w:r><w:t>Juniper &amp; Cedar</w:t></w:r></w:p><w:p><w:r><w:t>Second paragraph</w:t></w:r></w:p></w:body></w:document>"#).unwrap();
        let bytes = z.finish().unwrap().into_inner();
        let out = extract(&bytes, "docx").unwrap();
        assert!(out.chunks[0]
            .text
            .contains("Juniper & Cedar\nSecond paragraph"));
        assert!(out.warning.contains("Images"));
    }
}
