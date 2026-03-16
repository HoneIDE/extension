//! Plugin registry — ~/.hone/plugins/registry.json management.

use crate::manifest::Capabilities;
use crate::tier::Tier;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// Trust level for a plugin.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TrustLevel {
    /// Apply changes immediately.
    AutoApply,
    /// Show inline diff, user accepts/rejects.
    ShowDiff,
    /// Add to pending queue for batch review.
    Queue,
    /// Don't apply, just log.
    Block,
}

/// Per-plugin registry entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginEntry {
    pub version: String,
    pub installed_at: String,
    pub updated_at: String,
    pub tier: u8,
    pub capabilities: CapabilitiesSnapshot,
    pub trust_level: TrustLevel,
    pub enabled: bool,
    pub source_type: String,
    pub signature_verified: bool,
}

/// Snapshot of capabilities at install time (for diff on update).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CapabilitiesSnapshot {
    #[serde(default)]
    pub editor_read: bool,
    #[serde(default)]
    pub editor_write: bool,
    #[serde(default)]
    pub editor_decorations: bool,
    #[serde(default)]
    pub filesystem_read: Vec<String>,
    #[serde(default)]
    pub filesystem_write: bool,
    #[serde(default)]
    pub network: bool,
    #[serde(default)]
    pub process_spawn: Vec<String>,
    #[serde(default)]
    pub terminal: bool,
    #[serde(default)]
    pub ui_panel: bool,
    #[serde(default)]
    pub ui_statusbar: bool,
    #[serde(default)]
    pub ui_gutter: bool,
    #[serde(default)]
    pub ui_command_palette: bool,
    #[serde(default)]
    pub ui_context_menu: bool,
    #[serde(default)]
    pub ui_notifications: bool,
    #[serde(default)]
    pub ui_webview: bool,
}

impl From<&Capabilities> for CapabilitiesSnapshot {
    fn from(caps: &Capabilities) -> Self {
        Self {
            editor_read: caps.editor_read,
            editor_write: caps.editor_write,
            editor_decorations: caps.editor_decorations,
            filesystem_read: caps.filesystem_read.clone().unwrap_or_default(),
            filesystem_write: caps.filesystem_write,
            network: caps.network,
            process_spawn: caps.process_spawn.clone().unwrap_or_default(),
            terminal: caps.terminal,
            ui_panel: caps.ui_panel,
            ui_statusbar: caps.ui_statusbar,
            ui_gutter: caps.ui_gutter,
            ui_command_palette: caps.ui_command_palette,
            ui_context_menu: caps.ui_context_menu,
            ui_notifications: caps.ui_notifications,
            ui_webview: caps.ui_webview,
        }
    }
}

/// The registry file format.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistryFile {
    pub version: u32,
    pub plugins: HashMap<String, PluginEntry>,
}

impl Default for RegistryFile {
    fn default() -> Self {
        Self {
            version: 1,
            plugins: HashMap::new(),
        }
    }
}

/// Plugin registry — manages installed plugins.
pub struct PluginRegistry {
    data: RegistryFile,
    path: PathBuf,
}

impl PluginRegistry {
    /// Create a new registry backed by the given file path.
    pub fn new(path: PathBuf) -> Self {
        Self {
            data: RegistryFile::default(),
            path,
        }
    }

    /// Load registry from disk. Creates default if file doesn't exist.
    pub fn load(path: &Path) -> Self {
        let data = if path.exists() {
            match std::fs::read_to_string(path) {
                Ok(json) => serde_json::from_str(&json).unwrap_or_default(),
                Err(_) => RegistryFile::default(),
            }
        } else {
            RegistryFile::default()
        };
        Self {
            data,
            path: path.to_path_buf(),
        }
    }

    /// Save registry to disk.
    pub fn save(&self) -> Result<(), std::io::Error> {
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(&self.data)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
        std::fs::write(&self.path, json)
    }

    /// Register a plugin. Overwrites if already registered.
    pub fn register(
        &mut self,
        name: &str,
        version: &str,
        tier: Tier,
        capabilities: &Capabilities,
        trust_level: TrustLevel,
    ) {
        let now = chrono_now();
        self.data.plugins.insert(
            name.to_string(),
            PluginEntry {
                version: version.to_string(),
                installed_at: now.clone(),
                updated_at: now,
                tier: tier as u8,
                capabilities: CapabilitiesSnapshot::from(capabilities),
                trust_level,
                enabled: true,
                source_type: "binary".to_string(),
                signature_verified: false,
            },
        );
    }

    /// Unregister a plugin.
    pub fn unregister(&mut self, name: &str) -> bool {
        self.data.plugins.remove(name).is_some()
    }

    /// Get a plugin entry.
    pub fn get(&self, name: &str) -> Option<&PluginEntry> {
        self.data.plugins.get(name)
    }

    /// Check if a plugin is registered.
    pub fn has(&self, name: &str) -> bool {
        self.data.plugins.contains_key(name)
    }

    /// Get all plugin names.
    pub fn names(&self) -> Vec<String> {
        self.data.plugins.keys().cloned().collect()
    }

    /// Get all enabled plugin names.
    pub fn enabled_names(&self) -> Vec<String> {
        self.data
            .plugins
            .iter()
            .filter(|(_, e)| e.enabled)
            .map(|(n, _)| n.clone())
            .collect()
    }

    /// Enable/disable a plugin.
    pub fn set_enabled(&mut self, name: &str, enabled: bool) -> bool {
        if let Some(entry) = self.data.plugins.get_mut(name) {
            entry.enabled = enabled;
            true
        } else {
            false
        }
    }

    /// Update trust level for a plugin.
    pub fn set_trust_level(&mut self, name: &str, trust: TrustLevel) -> bool {
        if let Some(entry) = self.data.plugins.get_mut(name) {
            entry.trust_level = trust;
            true
        } else {
            false
        }
    }

    /// Count of registered plugins.
    pub fn count(&self) -> usize {
        self.data.plugins.len()
    }
}

/// Simple ISO-8601 timestamp (no chrono dependency).
fn chrono_now() -> String {
    // Use a simple epoch-based approach
    let epoch = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("epoch:{}", epoch)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::manifest::Capabilities;
    use crate::tier::Tier;
    use std::path::PathBuf;

    #[test]
    fn register_and_get() {
        let mut reg = PluginRegistry::new(PathBuf::from("/tmp/test-registry.json"));
        let caps = Capabilities::default();
        reg.register("test-plugin", "1.0.0", Tier::InProcess, &caps, TrustLevel::ShowDiff);

        assert!(reg.has("test-plugin"));
        let entry = reg.get("test-plugin").unwrap();
        assert_eq!(entry.version, "1.0.0");
        assert_eq!(entry.tier, 1);
        assert!(entry.enabled);
    }

    #[test]
    fn unregister() {
        let mut reg = PluginRegistry::new(PathBuf::from("/tmp/test.json"));
        let caps = Capabilities::default();
        reg.register("a", "1.0.0", Tier::InProcess, &caps, TrustLevel::AutoApply);
        assert!(reg.unregister("a"));
        assert!(!reg.has("a"));
        assert!(!reg.unregister("a")); // Already removed
    }

    #[test]
    fn enabled_names() {
        let mut reg = PluginRegistry::new(PathBuf::from("/tmp/test.json"));
        let caps = Capabilities::default();
        reg.register("a", "1.0.0", Tier::InProcess, &caps, TrustLevel::AutoApply);
        reg.register("b", "1.0.0", Tier::InProcess, &caps, TrustLevel::AutoApply);
        reg.set_enabled("b", false);

        let enabled = reg.enabled_names();
        assert_eq!(enabled.len(), 1);
        assert_eq!(enabled[0], "a");
    }

    #[test]
    fn set_trust_level() {
        let mut reg = PluginRegistry::new(PathBuf::from("/tmp/test.json"));
        let caps = Capabilities::default();
        reg.register("a", "1.0.0", Tier::InProcess, &caps, TrustLevel::ShowDiff);
        reg.set_trust_level("a", TrustLevel::AutoApply);

        let entry = reg.get("a").unwrap();
        assert_eq!(entry.trust_level, TrustLevel::AutoApply);
    }

    #[test]
    fn count() {
        let mut reg = PluginRegistry::new(PathBuf::from("/tmp/test.json"));
        assert_eq!(reg.count(), 0);
        let caps = Capabilities::default();
        reg.register("a", "1.0.0", Tier::InProcess, &caps, TrustLevel::AutoApply);
        reg.register("b", "1.0.0", Tier::InProcess, &caps, TrustLevel::AutoApply);
        assert_eq!(reg.count(), 2);
    }

    #[test]
    fn capabilities_snapshot() {
        let mut caps = Capabilities::default();
        caps.editor_read = true;
        caps.network = true;
        caps.process_spawn = Some(vec!["node".to_string()]);

        let snap = CapabilitiesSnapshot::from(&caps);
        assert!(snap.editor_read);
        assert!(snap.network);
        assert_eq!(snap.process_spawn, vec!["node".to_string()]);
        assert!(!snap.filesystem_write);
    }

    #[test]
    fn serialization_roundtrip() {
        let mut file = RegistryFile::default();
        let caps = Capabilities::default();
        file.plugins.insert(
            "test".to_string(),
            PluginEntry {
                version: "1.0.0".to_string(),
                installed_at: "2026-03-15".to_string(),
                updated_at: "2026-03-15".to_string(),
                tier: 1,
                capabilities: CapabilitiesSnapshot::from(&caps),
                trust_level: TrustLevel::ShowDiff,
                enabled: true,
                source_type: "binary".to_string(),
                signature_verified: false,
            },
        );

        let json = serde_json::to_string(&file).unwrap();
        let parsed: RegistryFile = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.plugins.len(), 1);
        assert_eq!(parsed.plugins["test"].version, "1.0.0");
    }
}
