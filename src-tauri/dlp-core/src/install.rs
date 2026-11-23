use std::path::Path;

#[derive(Debug, Clone, serde::Serialize)]
pub struct StepLog {
    pub step: String,
    pub detail: String,
    pub skipped: bool,
}

/// UTC timestamp helper (backup folder names; no chrono dep needed).
pub fn timestamp_utc(secs: u64) -> String {
    // days->y/m/d civil algorithm (Howard Hinnant), no external crate
    let days = (secs / 86400) as i64;
    let secs_of_day = secs % 86400;
    let (h, m, s) = (secs_of_day / 3600, (secs_of_day % 3600) / 60, secs_of_day % 60);
    let z = days + 719468;
    let era = z.div_euclid(146097);
    let doe = z.rem_euclid(146097);
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let mth = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if mth <= 2 { y + 1 } else { y };
    format!("{y:04}-{mth:02}-{d:02}_{h:02}{m:02}{s:02}")
}

pub fn write_test(citadel: &Path) -> Result<(), String> {
    let p = citadel.join("_wtest.tmp");
    match std::fs::write(&p, b"t").and_then(|_| std::fs::remove_file(&p)) {
        Ok(_) => Ok(()),
        Err(_) => Err("NeedsAdmin: cannot write to the game folder - run the app as administrator".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn timestamp_shape() {
        let ts = timestamp_utc(0);
        assert_eq!(ts, "1970-01-01_000000");
        // 2026-09-12 00:00:00 UTC = 1789171200
        assert_eq!(timestamp_utc(1789171200), "2026-09-12_000000");
    }
}
