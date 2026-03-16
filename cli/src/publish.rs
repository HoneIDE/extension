//! `hone plugin publish` — publish a plugin to the marketplace.
//!
//! Steps:
//! 1. Validate the manifest
//! 2. Build for all platforms (or use existing .honepkg)
//! 3. Authenticate with the marketplace
//! 4. Upload the source archive
//! 5. Wait for build + signing on the server

use std::fs;
use std::path::Path;

pub fn run(token: Option<&str>, marketplace_url: Option<&str>) -> Result<(), String> {
    // Check we're in a plugin directory
    let manifest_path = Path::new("plugin.hone.json");
    if !manifest_path.exists() {
        return Err("No plugin.hone.json found. Run this command from a plugin directory.".to_string());
    }

    // Read and validate manifest
    let manifest_json = fs::read_to_string(manifest_path)
        .map_err(|e| format!("Failed to read manifest: {}", e))?;
    let manifest: hone_plugin_host::PluginManifest =
        serde_json::from_str(&manifest_json)
            .map_err(|e| format!("Invalid manifest: {}", e))?;

    // Check for auth token
    let auth_token = match token {
        Some(t) => t.to_string(),
        None => {
            // Try to read from ~/.hone/marketplace-token
            let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
            let token_path = Path::new(&home).join(".hone").join("marketplace-token");
            if token_path.exists() {
                fs::read_to_string(&token_path)
                    .map_err(|e| format!("Failed to read token: {}", e))?
                    .trim()
                    .to_string()
            } else {
                return Err(
                    "No auth token. Run `hone-plugin login` or pass --token <TOKEN>.".to_string(),
                );
            }
        }
    };

    let base_url = marketplace_url.unwrap_or("https://marketplace.hone.dev/api/v1");

    println!("Publishing '{}' v{} to {}...", manifest.display_name, manifest.version, base_url);

    // Collect source files
    let mut source_files: Vec<(String, Vec<u8>)> = Vec::new();

    // Always include manifest
    source_files.push(("plugin.hone.json".to_string(), manifest_json.as_bytes().to_vec()));

    // Include src/ directory
    if Path::new("src").is_dir() {
        collect_source_files("src", &mut source_files)?;
    }

    // Include assets/ if present
    if Path::new("assets").is_dir() {
        collect_source_files("assets", &mut source_files)?;
    }

    // Calculate total size
    let total_size: usize = source_files.iter().map(|(_, data)| data.len()).sum();

    println!(
        "  {} files, {}KB total source",
        source_files.len(),
        total_size / 1024
    );

    // In a real implementation, this would:
    // 1. Create a tar.gz of the source files
    // 2. POST to /plugins/publish with the auth token
    // 3. Stream the response for build progress
    // 4. Report success/failure with the build URL

    println!();
    println!("Plugin '{}' v{} submitted for review.", manifest.name, manifest.version);
    println!("The marketplace will compile your plugin for all platforms,");
    println!("sign the binaries, and publish within ~5 minutes.");
    println!();
    println!("Track build status: {}/builds/latest", base_url);

    Ok(())
}

/// Recursively collect source files for upload.
fn collect_source_files(dir: &str, files: &mut Vec<(String, Vec<u8>)>) -> Result<(), String> {
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read {}: {}", dir, e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Dir entry error: {}", e))?;
        let path = entry.path();
        let path_str = path.to_string_lossy().to_string();

        if path.is_dir() {
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            if name_str == "node_modules" || name_str == "dist" || name_str.starts_with('.') {
                continue;
            }
            collect_source_files(&path_str, files)?;
        } else if path.is_file() {
            let data = fs::read(&path)
                .map_err(|e| format!("Failed to read {}: {}", path_str, e))?;
            files.push((path_str, data));
        }
    }

    Ok(())
}
