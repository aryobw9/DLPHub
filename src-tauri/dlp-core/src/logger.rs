use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};

pub fn log_path(data_dir: &Path) -> PathBuf {
    data_dir.join("logs").join("app.log")
}

/// Append a line to %APPDATA%\DLPHub\logs\app.log, rotating if larger than 1MB.
pub fn log(data_dir: &Path, level: &str, msg: &str) {
    let logs_dir = data_dir.join("logs");
    let _ = std::fs::create_dir_all(&logs_dir);
    let p = logs_dir.join("app.log");

    if let Ok(meta) = std::fs::metadata(&p) {
        if meta.len() > 1_000_000 {
            let old = logs_dir.join("app.old.log");
            let _ = std::fs::remove_file(&old);
            let _ = std::fs::rename(&p, &old);
        }
    }

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let ts = crate::install::timestamp_utc(now);
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&p) {
        let _ = writeln!(f, "[{ts}] [{level}] {msg}");
    }
}

/// Retrieve the last `lines_count` log lines for diagnostics reporting.
pub fn recent_logs(data_dir: &Path, lines_count: usize) -> Vec<String> {
    let p = log_path(data_dir);
    let Ok(content) = std::fs::read_to_string(&p) else {
        return vec![];
    };
    let all: Vec<&str> = content.lines().collect();
    let start = all.len().saturating_sub(lines_count);
    all[start..].iter().map(|s| s.to_string()).collect()
}
