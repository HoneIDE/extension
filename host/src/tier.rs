//! Tier derivation from plugin capabilities.

use crate::manifest::Capabilities;

/// Plugin execution tier.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum Tier {
    /// Tier 1: UI-only (themes, keymaps, color schemes). Loaded in main process.
    InProcess = 1,
    /// Tier 2: Editor/fs-read/ui capabilities. Shared plugin host process.
    PluginHost = 2,
    /// Tier 3: Network/fs-write/process.spawn/terminal/webview. Own sandboxed process.
    IsolatedProcess = 3,
}

/// Derive the plugin execution tier from declared capabilities.
///
/// Tier 3 triggers: network, filesystem.write, process.spawn (non-empty), terminal, ui.webview
/// Tier 2 triggers: editor.*, filesystem.read (non-empty), any ui.*
/// Tier 1: everything else (declarative data only)
pub fn derive_tier(caps: &Capabilities) -> Tier {
    // Tier 3: any "dangerous" capability
    if caps.network {
        return Tier::IsolatedProcess;
    }
    if caps.filesystem_write {
        return Tier::IsolatedProcess;
    }
    if caps.terminal {
        return Tier::IsolatedProcess;
    }
    if caps.ui_webview {
        return Tier::IsolatedProcess;
    }
    if let Some(ref spawn) = caps.process_spawn {
        if !spawn.is_empty() {
            return Tier::IsolatedProcess;
        }
    }

    // Tier 2: any editor/fs-read/ui capability
    if caps.editor_read || caps.editor_write || caps.editor_decorations {
        return Tier::PluginHost;
    }
    if let Some(ref globs) = caps.filesystem_read {
        if !globs.is_empty() {
            return Tier::PluginHost;
        }
    }
    if caps.ui_panel
        || caps.ui_statusbar
        || caps.ui_gutter
        || caps.ui_command_palette
        || caps.ui_context_menu
        || caps.ui_notifications
    {
        return Tier::PluginHost;
    }

    // Tier 1: UI-only
    Tier::InProcess
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::manifest::Capabilities;

    fn empty_caps() -> Capabilities {
        Capabilities::default()
    }

    #[test]
    fn empty_is_tier1() {
        assert_eq!(derive_tier(&empty_caps()), Tier::InProcess);
    }

    #[test]
    fn editor_read_is_tier2() {
        let mut caps = empty_caps();
        caps.editor_read = true;
        assert_eq!(derive_tier(&caps), Tier::PluginHost);
    }

    #[test]
    fn ui_statusbar_is_tier2() {
        let mut caps = empty_caps();
        caps.ui_statusbar = true;
        assert_eq!(derive_tier(&caps), Tier::PluginHost);
    }

    #[test]
    fn filesystem_read_nonempty_is_tier2() {
        let mut caps = empty_caps();
        caps.filesystem_read = Some(vec!["**/*.ts".to_string()]);
        assert_eq!(derive_tier(&caps), Tier::PluginHost);
    }

    #[test]
    fn filesystem_read_empty_is_tier1() {
        let mut caps = empty_caps();
        caps.filesystem_read = Some(vec![]);
        assert_eq!(derive_tier(&caps), Tier::InProcess);
    }

    #[test]
    fn network_is_tier3() {
        let mut caps = empty_caps();
        caps.network = true;
        assert_eq!(derive_tier(&caps), Tier::IsolatedProcess);
    }

    #[test]
    fn filesystem_write_is_tier3() {
        let mut caps = empty_caps();
        caps.filesystem_write = true;
        assert_eq!(derive_tier(&caps), Tier::IsolatedProcess);
    }

    #[test]
    fn process_spawn_nonempty_is_tier3() {
        let mut caps = empty_caps();
        caps.process_spawn = Some(vec!["node".to_string()]);
        assert_eq!(derive_tier(&caps), Tier::IsolatedProcess);
    }

    #[test]
    fn process_spawn_empty_is_tier1() {
        let mut caps = empty_caps();
        caps.process_spawn = Some(vec![]);
        assert_eq!(derive_tier(&caps), Tier::InProcess);
    }

    #[test]
    fn terminal_is_tier3() {
        let mut caps = empty_caps();
        caps.terminal = true;
        assert_eq!(derive_tier(&caps), Tier::IsolatedProcess);
    }

    #[test]
    fn webview_is_tier3() {
        let mut caps = empty_caps();
        caps.ui_webview = true;
        assert_eq!(derive_tier(&caps), Tier::IsolatedProcess);
    }

    #[test]
    fn mixed_tier2_tier3_is_tier3() {
        let mut caps = empty_caps();
        caps.editor_read = true;
        caps.ui_statusbar = true;
        caps.network = true;
        assert_eq!(derive_tier(&caps), Tier::IsolatedProcess);
    }
}
