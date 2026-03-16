//! `hone plugin dev` — watch source files and rebuild on change.

use std::collections::HashMap;
use std::path::Path;
use std::time::{Duration, SystemTime};

pub fn run(perry_override: Option<&str>, interval_ms: u64) -> Result<(), String> {
    // Check we're in a plugin directory
    if !Path::new("plugin.hone.json").exists() {
        return Err("No plugin.hone.json found. Run this command from a plugin directory.".to_string());
    }

    println!("Watching for changes (poll interval: {}ms)...", interval_ms);
    println!("Press Ctrl+C to stop.");
    println!();

    // Initial build
    if let Err(e) = crate::build::run(perry_override) {
        eprintln!("Initial build failed: {}", e);
    }

    // Track file modification times
    let mut mtimes: HashMap<String, SystemTime> = HashMap::new();
    collect_mtimes("src", &mut mtimes);
    collect_mtimes(".", &mut mtimes); // plugin.hone.json

    let interval = Duration::from_millis(interval_ms);

    loop {
        std::thread::sleep(interval);

        let mut changed = false;
        let mut new_mtimes: HashMap<String, SystemTime> = HashMap::new();
        collect_mtimes("src", &mut new_mtimes);
        collect_mtimes(".", &mut new_mtimes);

        // Check for changes
        for (path, mtime) in &new_mtimes {
            match mtimes.get(path) {
                Some(old_mtime) => {
                    if mtime != old_mtime {
                        println!("Changed: {}", path);
                        changed = true;
                    }
                }
                None => {
                    println!("New file: {}", path);
                    changed = true;
                }
            }
        }

        // Check for deletions
        for path in mtimes.keys() {
            if !new_mtimes.contains_key(path) {
                println!("Deleted: {}", path);
                changed = true;
            }
        }

        if changed {
            println!();
            match crate::build::run(perry_override) {
                Ok(()) => println!("Rebuild complete."),
                Err(e) => eprintln!("Rebuild failed: {}", e),
            }
            println!();
        }

        mtimes = new_mtimes;
    }
}

/// Recursively collect file modification times for .ts and .json files.
fn collect_mtimes(dir: &str, mtimes: &mut HashMap<String, SystemTime>) {
    let dir_path = Path::new(dir);
    if !dir_path.exists() || !dir_path.is_dir() {
        return;
    }

    let entries = match std::fs::read_dir(dir_path) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        let path = entry.path();
        let path_str = path.to_string_lossy().to_string();

        if path.is_dir() {
            // Skip node_modules, dist, .git
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            if name_str == "node_modules" || name_str == "dist" || name_str.starts_with('.') {
                continue;
            }
            collect_mtimes(&path_str, mtimes);
        } else if path.is_file() {
            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
            let name = entry.file_name();
            let name_str = name.to_string_lossy();

            // Only watch .ts, .json files and plugin.hone.json
            if ext == "ts" || name_str == "plugin.hone.json" {
                if let Ok(metadata) = entry.metadata() {
                    if let Ok(mtime) = metadata.modified() {
                        mtimes.insert(path_str, mtime);
                    }
                }
            }
        }
    }
}
