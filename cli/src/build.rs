//! `hone plugin build` — compile the plugin to a .dylib via Perry.

use std::path::Path;
use std::process::Command;

/// Find the Perry compiler binary.
fn find_perry(perry_override: Option<&str>) -> Result<String, String> {
    if let Some(p) = perry_override {
        if Path::new(p).exists() {
            return Ok(p.to_string());
        }
        return Err(format!("Perry not found at: {}", p));
    }

    // Check common locations
    let candidates = [
        "perry",
        "../perry/target/release/perry",
        "../../perry/target/release/perry",
    ];

    for candidate in &candidates {
        if let Ok(output) = Command::new("which").arg(candidate).output() {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path.is_empty() {
                    return Ok(path);
                }
            }
        }
        if Path::new(candidate).exists() {
            return Ok(candidate.to_string());
        }
    }

    Err("Perry compiler not found. Install Perry or use --perry <path>".to_string())
}

/// Find the @honeide/sdk package for resolution.
/// Searches common locations relative to the plugin dir and the hone-extension dir.
fn find_sdk_path() -> Option<String> {
    let candidates = [
        // Relative to plugin directory (symlinked or installed)
        "node_modules/@honeide/sdk",
        // Relative to hone-extension workspace
        "../sdk",
        "../../hone-extension/sdk",
        "../../../hone-extension/sdk",
    ];

    for candidate in &candidates {
        let path = Path::new(candidate);
        if path.is_dir() && path.join("src").join("index.ts").exists() {
            return Some(path.canonicalize().ok()?.to_string_lossy().to_string());
        }
    }

    // Also check if @honeide/sdk is in node_modules (npm/bun install)
    if let Ok(home) = std::env::var("HOME") {
        let global_path = Path::new(&home).join(".hone").join("sdk");
        if global_path.is_dir() && global_path.join("src").join("index.ts").exists() {
            return Some(global_path.to_string_lossy().to_string());
        }
    }

    None
}

/// Ensure @honeide/sdk is resolvable by symlinking into node_modules if needed.
fn ensure_sdk_resolution() -> Result<(), String> {
    let node_modules_sdk = Path::new("node_modules").join("@hone").join("sdk");

    // Already resolvable
    if node_modules_sdk.is_dir() || node_modules_sdk.is_symlink() {
        return Ok(());
    }

    // Find the SDK
    let sdk_path = match find_sdk_path() {
        Some(p) => p,
        None => {
            return Err(
                "@honeide/sdk not found. Ensure it is installed or symlinked in node_modules.".to_string()
            );
        }
    };

    // Create node_modules/@hone/ directory
    let parent = Path::new("node_modules").join("@hone");
    std::fs::create_dir_all(&parent)
        .map_err(|e| format!("Failed to create node_modules/@hone/: {}", e))?;

    // Symlink the SDK
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(&sdk_path, &node_modules_sdk)
            .map_err(|e| format!("Failed to symlink @honeide/sdk: {}", e))?;
    }

    #[cfg(windows)]
    {
        std::os::windows::fs::symlink_dir(&sdk_path, &node_modules_sdk)
            .map_err(|e| format!("Failed to symlink @honeide/sdk: {}", e))?;
    }

    println!("Linked @honeide/sdk -> {}", sdk_path);
    Ok(())
}

/// Ensure @honeide/plugins (host FFI) is resolvable.
/// The SDK's host-impl.ts imports from @honeide/plugins/perry/live.
fn ensure_host_resolution() -> Result<(), String> {
    let node_modules_host = Path::new("node_modules").join("@honeide").join("plugins");

    // Already resolvable
    if node_modules_host.is_dir() || node_modules_host.is_symlink() {
        return Ok(());
    }

    // Search for the host package relative to common locations
    let candidates = [
        "../host",
        "../../hone-extension/host",
        "../../../hone-extension/host",
    ];

    let mut host_path: Option<String> = None;
    for candidate in &candidates {
        let path = Path::new(candidate);
        if path.is_dir() && path.join("perry").join("live.ts").exists() {
            if let Ok(canonical) = path.canonicalize() {
                host_path = Some(canonical.to_string_lossy().to_string());
                break;
            }
        }
    }

    let host_path = match host_path {
        Some(p) => p,
        None => return Ok(()), // Not found — may be installed via npm
    };

    // Create node_modules/@honeide/ directory
    let parent = Path::new("node_modules").join("@honeide");
    std::fs::create_dir_all(&parent)
        .map_err(|e| format!("Failed to create node_modules/@honeide/: {}", e))?;

    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(&host_path, &node_modules_host)
            .map_err(|e| format!("Failed to symlink @honeide/plugins: {}", e))?;
    }

    #[cfg(windows)]
    {
        std::os::windows::fs::symlink_dir(&host_path, &node_modules_host)
            .map_err(|e| format!("Failed to symlink @honeide/plugins: {}", e))?;
    }

    println!("Linked @honeide/plugins -> {}", host_path);
    Ok(())
}

pub fn run(perry_override: Option<&str>) -> Result<(), String> {
    // Check we're in a plugin directory
    let manifest_path = Path::new("plugin.hone.json");
    if !manifest_path.exists() {
        return Err("No plugin.hone.json found. Run this command from a plugin directory.".to_string());
    }

    // Read manifest to get plugin name
    let manifest_json = std::fs::read_to_string(manifest_path)
        .map_err(|e| format!("Failed to read manifest: {}", e))?;
    let manifest: hone_plugin_host::PluginManifest =
        serde_json::from_str(&manifest_json)
            .map_err(|e| format!("Invalid manifest: {}", e))?;

    let perry = find_perry(perry_override)?;

    println!("Building plugin '{}'...", manifest.name);

    // Ensure @honeide/sdk and @honeide/plugins are resolvable for import
    ensure_sdk_resolution()?;
    ensure_host_resolution()?;

    // Invoke perry compile --output-type dylib
    let entry = Path::new("src").join("index.ts");
    if !entry.exists() {
        return Err("src/index.ts not found".to_string());
    }

    let output_name = &manifest.name;

    let mut cmd = Command::new(&perry);
    cmd.arg("compile")
        .arg(entry.to_str().unwrap())
        .arg("--output-type")
        .arg("dylib")
        .arg("--output")
        .arg(output_name);

    let output = cmd.output().map_err(|e| format!("Failed to run perry: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Err(format!(
            "Build failed:\n{}\n{}",
            stdout.trim(),
            stderr.trim()
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    println!("{}", stdout.trim());
    println!("Plugin '{}' built successfully.", manifest.name);

    Ok(())
}
