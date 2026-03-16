//! `hone plugin test` — run plugin tests with bun.

use std::path::Path;
use std::process::Command;

pub fn run() -> Result<(), String> {
    // Check we're in a plugin directory
    if !Path::new("plugin.hone.json").exists() {
        return Err("No plugin.hone.json found. Run this command from a plugin directory.".to_string());
    }

    // Check for test directory
    if !Path::new("tests").exists() {
        return Err("No tests/ directory found.".to_string());
    }

    println!("Running plugin tests...");
    println!();

    // Run bun test
    let mut cmd = Command::new("bun");
    cmd.arg("test");

    let status = cmd.status().map_err(|e| format!("Failed to run bun test: {}", e))?;

    if !status.success() {
        return Err("Tests failed.".to_string());
    }

    Ok(())
}
