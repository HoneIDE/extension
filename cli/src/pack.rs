//! `hone plugin pack` — create a .honepkg archive.
//!
//! The .honepkg format is a gzip-compressed tar containing:
//! - plugin.hone.json
//! - binaries/<platform>/plugin.dylib (or .so/.dll)
//! - assets/ (icon, README, etc.)

use std::fs;
use std::io::Write;
use std::path::Path;

pub fn run(output_dir: &str) -> Result<(), String> {
    // Check we're in a plugin directory
    let manifest_path = Path::new("plugin.hone.json");
    if !manifest_path.exists() {
        return Err("No plugin.hone.json found. Run this command from a plugin directory.".to_string());
    }

    // Read manifest
    let manifest_json = fs::read_to_string(manifest_path)
        .map_err(|e| format!("Failed to read manifest: {}", e))?;
    let manifest: hone_plugin_host::PluginManifest =
        serde_json::from_str(&manifest_json)
            .map_err(|e| format!("Invalid manifest: {}", e))?;

    let pkg_name = format!("{}-{}.honepkg", manifest.name, manifest.version);
    let output_path = Path::new(output_dir).join(&pkg_name);

    println!("Packing plugin '{}'...", manifest.name);

    // Collect files to include
    let mut files: Vec<(String, Vec<u8>)> = Vec::new();

    // Always include manifest
    files.push(("plugin.hone.json".to_string(), manifest_json.into_bytes()));

    // Include dylib if it exists
    let dylib_name = format!("{}.dylib", manifest.name);
    if Path::new(&dylib_name).exists() {
        let data = fs::read(&dylib_name)
            .map_err(|e| format!("Failed to read {}: {}", dylib_name, e))?;
        let archive_path = format!("binaries/darwin-arm64/{}", dylib_name);
        files.push((archive_path, data));
    }

    // Include .so if it exists
    let so_name = format!("lib{}.so", manifest.name);
    if Path::new(&so_name).exists() {
        let data = fs::read(&so_name)
            .map_err(|e| format!("Failed to read {}: {}", so_name, e))?;
        let archive_path = format!("binaries/linux-x64/{}", so_name);
        files.push((archive_path, data));
    }

    // Include assets/ if directory exists
    if Path::new("assets").is_dir() {
        collect_dir_files("assets", &mut files)?;
    }

    // Include source if src/ exists (for source distribution)
    if Path::new("src").is_dir() {
        collect_dir_files("src", &mut files)?;
    }

    // Write a simple tar-like archive (tar header + file data)
    // For simplicity, we write a concatenated format that's easy to parse
    let mut archive_data: Vec<u8> = Vec::new();

    // Magic header
    archive_data.extend_from_slice(b"HONEPKG\x01"); // version 1

    // File count (4 bytes LE)
    let count = files.len() as u32;
    archive_data.extend_from_slice(&count.to_le_bytes());

    // Each file: path_len(4) + path + data_len(4) + data
    for (path, data) in &files {
        let path_bytes = path.as_bytes();
        let path_len = path_bytes.len() as u32;
        archive_data.extend_from_slice(&path_len.to_le_bytes());
        archive_data.extend_from_slice(path_bytes);

        let data_len = data.len() as u32;
        archive_data.extend_from_slice(&data_len.to_le_bytes());
        archive_data.extend_from_slice(data);
    }

    // Gzip compress
    let compressed = gzip_compress(&archive_data);

    // Write output
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create output directory: {}", e))?;
    }

    let mut file = fs::File::create(&output_path)
        .map_err(|e| format!("Failed to create {}: {}", output_path.display(), e))?;
    file.write_all(&compressed)
        .map_err(|e| format!("Failed to write archive: {}", e))?;

    let size_kb = compressed.len() / 1024;
    println!(
        "Created {} ({}KB, {} files)",
        output_path.display(),
        size_kb,
        files.len()
    );

    Ok(())
}

/// Recursively collect files from a directory.
fn collect_dir_files(dir: &str, files: &mut Vec<(String, Vec<u8>)>) -> Result<(), String> {
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory {}: {}", dir, e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Dir entry error: {}", e))?;
        let path = entry.path();
        let path_str = path.to_string_lossy().to_string();

        if path.is_dir() {
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            if name_str == "node_modules" || name_str.starts_with('.') {
                continue;
            }
            collect_dir_files(&path_str, files)?;
        } else if path.is_file() {
            let data = fs::read(&path)
                .map_err(|e| format!("Failed to read {}: {}", path_str, e))?;
            files.push((path_str, data));
        }
    }

    Ok(())
}

/// Simple DEFLATE-less gzip compression (store only).
/// For a real implementation, use flate2 crate. This is a minimal version.
fn gzip_compress(data: &[u8]) -> Vec<u8> {
    // Gzip header
    let mut out = Vec::with_capacity(data.len() + 18);
    out.extend_from_slice(&[0x1f, 0x8b]); // Magic
    out.push(0x00); // Compression method: stored (no compression for simplicity)
    out.push(0x00); // Flags
    out.extend_from_slice(&[0, 0, 0, 0]); // Modification time
    out.push(0x00); // Extra flags
    out.push(0xff); // OS: unknown

    // For a simple implementation, just store the raw data
    // Real implementation would use DEFLATE
    out.extend_from_slice(data);

    // CRC32 + original size
    let crc = crc32(data);
    out.extend_from_slice(&crc.to_le_bytes());
    let size = data.len() as u32;
    out.extend_from_slice(&size.to_le_bytes());

    out
}

/// Simple CRC32 implementation.
fn crc32(data: &[u8]) -> u32 {
    let mut crc: u32 = 0xFFFFFFFF;
    for &byte in data {
        crc ^= byte as u32;
        for _ in 0..8 {
            if crc & 1 != 0 {
                crc = (crc >> 1) ^ 0xEDB88320;
            } else {
                crc >>= 1;
            }
        }
    }
    !crc
}
