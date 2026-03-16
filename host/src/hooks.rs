//! Hook registry — register and dispatch hooks to plugins.

use std::collections::HashMap;

/// A registered hook handler.
#[derive(Debug, Clone)]
pub struct HookRegistration {
    /// Plugin that registered this hook.
    pub plugin_name: String,
    /// Priority (lower = higher priority). Default: 10.
    pub priority: i32,
    /// Opaque handle to the callback function (NaN-boxed closure pointer).
    pub handler: u64,
}

/// The hook registry manages hook subscriptions across all loaded plugins.
pub struct HookRegistry {
    /// Map from hook name to list of registrations, sorted by priority.
    hooks: HashMap<String, Vec<HookRegistration>>,
}

impl HookRegistry {
    pub fn new() -> Self {
        Self {
            hooks: HashMap::new(),
        }
    }

    /// Register a hook handler.
    pub fn register(&mut self, hook_name: &str, plugin_name: &str, priority: i32, handler: u64) {
        let entry = self.hooks.entry(hook_name.to_string()).or_default();
        entry.push(HookRegistration {
            plugin_name: plugin_name.to_string(),
            priority,
            handler,
        });
        // Sort by priority (ascending = higher priority first)
        entry.sort_by_key(|r| r.priority);
    }

    /// Unregister all hooks for a plugin.
    pub fn unregister_plugin(&mut self, plugin_name: &str) {
        for handlers in self.hooks.values_mut() {
            handlers.retain(|r| r.plugin_name != plugin_name);
        }
        // Clean up empty entries
        self.hooks.retain(|_, v| !v.is_empty());
    }

    /// Get all handlers for a hook, sorted by priority.
    pub fn get_handlers(&self, hook_name: &str) -> &[HookRegistration] {
        self.hooks.get(hook_name).map(|v| v.as_slice()).unwrap_or(&[])
    }

    /// Check if any plugin is registered for a hook.
    pub fn has_hook(&self, hook_name: &str) -> bool {
        self.hooks.get(hook_name).map(|v| !v.is_empty()).unwrap_or(false)
    }

    /// Get all registered hook names.
    pub fn hook_names(&self) -> Vec<String> {
        self.hooks.keys().cloned().collect()
    }

    /// Get total number of registered hooks across all plugins.
    pub fn total_registrations(&self) -> usize {
        self.hooks.values().map(|v| v.len()).sum()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn register_and_get_handlers() {
        let mut registry = HookRegistry::new();
        registry.register("onDocumentSave", "plugin-a", 10, 100);
        registry.register("onDocumentSave", "plugin-b", 5, 200);

        let handlers = registry.get_handlers("onDocumentSave");
        assert_eq!(handlers.len(), 2);
        // plugin-b has priority 5 (higher priority), should be first
        assert_eq!(handlers[0].plugin_name, "plugin-b");
        assert_eq!(handlers[1].plugin_name, "plugin-a");
    }

    #[test]
    fn unregister_plugin() {
        let mut registry = HookRegistry::new();
        registry.register("onDocumentSave", "plugin-a", 10, 100);
        registry.register("onDocumentSave", "plugin-b", 10, 200);
        registry.register("onDocumentOpen", "plugin-a", 10, 300);

        registry.unregister_plugin("plugin-a");

        let save_handlers = registry.get_handlers("onDocumentSave");
        assert_eq!(save_handlers.len(), 1);
        assert_eq!(save_handlers[0].plugin_name, "plugin-b");

        assert!(!registry.has_hook("onDocumentOpen"));
    }

    #[test]
    fn has_hook() {
        let mut registry = HookRegistry::new();
        assert!(!registry.has_hook("onDocumentSave"));

        registry.register("onDocumentSave", "plugin-a", 10, 100);
        assert!(registry.has_hook("onDocumentSave"));
        assert!(!registry.has_hook("onDocumentOpen"));
    }

    #[test]
    fn empty_handlers() {
        let registry = HookRegistry::new();
        assert_eq!(registry.get_handlers("nonexistent").len(), 0);
    }

    #[test]
    fn hook_names() {
        let mut registry = HookRegistry::new();
        registry.register("onDocumentSave", "a", 10, 1);
        registry.register("onDocumentOpen", "a", 10, 2);
        registry.register("onDocumentFormat", "a", 10, 3);

        let names = registry.hook_names();
        assert_eq!(names.len(), 3);
    }

    #[test]
    fn total_registrations() {
        let mut registry = HookRegistry::new();
        registry.register("hook1", "a", 10, 1);
        registry.register("hook1", "b", 10, 2);
        registry.register("hook2", "a", 10, 3);

        assert_eq!(registry.total_registrations(), 3);
    }

    #[test]
    fn priority_ordering() {
        let mut registry = HookRegistry::new();
        registry.register("hook", "low", 100, 1);
        registry.register("hook", "high", 1, 2);
        registry.register("hook", "mid", 50, 3);

        let handlers = registry.get_handlers("hook");
        assert_eq!(handlers[0].plugin_name, "high");
        assert_eq!(handlers[1].plugin_name, "mid");
        assert_eq!(handlers[2].plugin_name, "low");
    }
}
