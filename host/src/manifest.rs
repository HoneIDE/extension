//! Plugin manifest parsing — plugin.hone.json schema.

use serde::Deserialize;
use std::collections::HashMap;
use std::path::Path;

/// Parsed plugin manifest from plugin.hone.json.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginManifest {
    pub name: String,
    pub display_name: String,
    pub version: String,
    pub author: String,
    pub license: String,
    pub description: String,
    pub entry: String,
    #[serde(default)]
    pub capabilities: Capabilities,
    #[serde(default)]
    pub hooks: Vec<String>,
    #[serde(default)]
    pub config_schema: HashMap<String, ConfigEntry>,
    pub hone: String,
    pub repository: Option<String>,
    pub icon: Option<String>,
    pub perry_version: Option<String>,
}

/// Declared capabilities determining which Host API functions are available.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Capabilities {
    #[serde(default, rename = "editor.read")]
    pub editor_read: bool,
    #[serde(default, rename = "editor.write")]
    pub editor_write: bool,
    #[serde(default, rename = "editor.decorations")]
    pub editor_decorations: bool,
    #[serde(default, rename = "filesystem.read")]
    pub filesystem_read: Option<Vec<String>>,
    #[serde(default, rename = "filesystem.write")]
    pub filesystem_write: bool,
    #[serde(default)]
    pub network: bool,
    #[serde(default, rename = "process.spawn")]
    pub process_spawn: Option<Vec<String>>,
    #[serde(default)]
    pub terminal: bool,
    #[serde(default, rename = "ui.panel")]
    pub ui_panel: bool,
    #[serde(default, rename = "ui.statusbar")]
    pub ui_statusbar: bool,
    #[serde(default, rename = "ui.gutter")]
    pub ui_gutter: bool,
    #[serde(default, rename = "ui.commandPalette")]
    pub ui_command_palette: bool,
    #[serde(default, rename = "ui.contextMenu")]
    pub ui_context_menu: bool,
    #[serde(default, rename = "ui.notifications")]
    pub ui_notifications: bool,
    #[serde(default, rename = "ui.webview")]
    pub ui_webview: bool,
}

/// A configuration entry in the plugin's config schema.
#[derive(Debug, Clone, Deserialize)]
pub struct ConfigEntry {
    #[serde(rename = "type")]
    pub value_type: String,
    pub default: Option<serde_json::Value>,
    pub description: Option<String>,
    #[serde(rename = "enum")]
    pub enum_values: Option<Vec<String>>,
}

/// Manifest validation error.
#[derive(Debug)]
pub struct ManifestError {
    pub field: String,
    pub message: String,
}

impl std::fmt::Display for ManifestError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.field, self.message)
    }
}

/// Parse a plugin manifest from a JSON string.
pub fn parse_manifest(json: &str) -> Result<PluginManifest, Vec<ManifestError>> {
    let manifest: PluginManifest = serde_json::from_str(json).map_err(|e| {
        vec![ManifestError {
            field: "root".to_string(),
            message: format!("Invalid JSON: {}", e),
        }]
    })?;

    let errors = validate_manifest(&manifest);
    if !errors.is_empty() {
        return Err(errors);
    }

    Ok(manifest)
}

/// Parse a plugin manifest from a file path.
pub fn parse_manifest_file(path: &Path) -> Result<PluginManifest, Vec<ManifestError>> {
    let json = std::fs::read_to_string(path).map_err(|e| {
        vec![ManifestError {
            field: "file".to_string(),
            message: format!("Cannot read file: {}", e),
        }]
    })?;
    parse_manifest(&json)
}

/// Validate a parsed manifest.
fn validate_manifest(m: &PluginManifest) -> Vec<ManifestError> {
    let mut errors = Vec::new();

    if m.name.is_empty() {
        errors.push(ManifestError {
            field: "name".to_string(),
            message: "name must be non-empty".to_string(),
        });
    }
    if m.display_name.is_empty() {
        errors.push(ManifestError {
            field: "displayName".to_string(),
            message: "displayName must be non-empty".to_string(),
        });
    }
    if m.version.is_empty() {
        errors.push(ManifestError {
            field: "version".to_string(),
            message: "version must be non-empty".to_string(),
        });
    }
    if m.author.is_empty() {
        errors.push(ManifestError {
            field: "author".to_string(),
            message: "author must be non-empty".to_string(),
        });
    }
    if m.license.is_empty() {
        errors.push(ManifestError {
            field: "license".to_string(),
            message: "license must be non-empty".to_string(),
        });
    }
    if m.hone.is_empty() {
        errors.push(ManifestError {
            field: "hone".to_string(),
            message: "hone engine version must be non-empty".to_string(),
        });
    }

    errors
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_valid_manifest() {
        let json = r#"{
            "name": "test-plugin",
            "displayName": "Test Plugin",
            "version": "1.0.0",
            "author": "Test Author",
            "license": "MIT",
            "description": "A test plugin",
            "entry": "TestPlugin",
            "capabilities": { "editor.read": true, "ui.statusbar": true },
            "hooks": ["onDocumentOpen"],
            "hone": ">=0.1.0"
        }"#;
        let manifest = parse_manifest(json).unwrap();
        assert_eq!(manifest.name, "test-plugin");
        assert!(manifest.capabilities.editor_read);
        assert!(manifest.capabilities.ui_statusbar);
        assert!(!manifest.capabilities.network);
        assert_eq!(manifest.hooks.len(), 1);
    }

    #[test]
    fn parse_minimal_manifest() {
        let json = r#"{
            "name": "min",
            "displayName": "Min",
            "version": "0.1.0",
            "author": "A",
            "license": "MIT",
            "description": "",
            "entry": "",
            "capabilities": {},
            "hooks": [],
            "hone": ">=0.1.0"
        }"#;
        let manifest = parse_manifest(json).unwrap();
        assert_eq!(manifest.name, "min");
    }

    #[test]
    fn parse_invalid_json() {
        let result = parse_manifest("not json");
        assert!(result.is_err());
    }

    #[test]
    fn parse_missing_name() {
        let json = r#"{
            "displayName": "X",
            "version": "1.0.0",
            "author": "A",
            "license": "MIT",
            "description": "",
            "entry": "X",
            "capabilities": {},
            "hooks": [],
            "hone": ">=0.1.0"
        }"#;
        // serde will fail because name is required
        let result = parse_manifest(json);
        assert!(result.is_err());
    }

    #[test]
    fn parse_filesystem_read_globs() {
        let json = r#"{
            "name": "fs-plugin",
            "displayName": "FS Plugin",
            "version": "1.0.0",
            "author": "A",
            "license": "MIT",
            "description": "desc",
            "entry": "FsPlugin",
            "capabilities": { "filesystem.read": ["**/*.ts", "**/*.js"] },
            "hooks": [],
            "hone": ">=0.1.0"
        }"#;
        let manifest = parse_manifest(json).unwrap();
        let globs = manifest.capabilities.filesystem_read.as_ref().unwrap();
        assert_eq!(globs.len(), 2);
        assert_eq!(globs[0], "**/*.ts");
    }

    #[test]
    fn parse_process_spawn_allowlist() {
        let json = r#"{
            "name": "lint",
            "displayName": "Lint",
            "version": "1.0.0",
            "author": "A",
            "license": "MIT",
            "description": "desc",
            "entry": "LintPlugin",
            "capabilities": { "process.spawn": ["eslint", "prettier"] },
            "hooks": [],
            "hone": ">=0.1.0"
        }"#;
        let manifest = parse_manifest(json).unwrap();
        let bins = manifest.capabilities.process_spawn.as_ref().unwrap();
        assert_eq!(bins.len(), 2);
    }

    #[test]
    fn parse_config_schema() {
        let json = r#"{
            "name": "cfg",
            "displayName": "Cfg",
            "version": "1.0.0",
            "author": "A",
            "license": "MIT",
            "description": "",
            "entry": "CfgPlugin",
            "capabilities": {},
            "hooks": [],
            "hone": ">=0.1.0",
            "configSchema": {
                "printWidth": { "type": "number", "default": 80, "description": "Line width" },
                "semi": { "type": "boolean", "default": true }
            }
        }"#;
        let manifest = parse_manifest(json).unwrap();
        assert_eq!(manifest.config_schema.len(), 2);
        assert_eq!(manifest.config_schema["printWidth"].value_type, "number");
    }
}
