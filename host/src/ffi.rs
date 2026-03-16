//! FFI functions exposed to Perry-compiled TypeScript.
//!
//! These functions are called from hone-ide TypeScript code when __plugins__ is enabled.
//! All behind feature-gated compilation in the host application.

use crate::hooks::HookRegistry;
use crate::loader::LoadedPlugin;
use crate::manifest::parse_manifest_file;
use crate::registry::{PluginRegistry, TrustLevel};
use crate::tier::derive_tier;
use crate::host_api::{build_host_api, register_callback};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

/// Global plugin host state.
struct PluginHost {
    /// Loaded plugins keyed by name.
    plugins: HashMap<String, LoadedPlugin>,
    /// Hook registry for dispatching events.
    hook_registry: HookRegistry,
    /// Persistent registry (registry.json).
    registry: PluginRegistry,
    /// Next handle ID for loaded plugins.
    next_handle: i64,
    /// Handle-to-name mapping.
    handle_to_name: HashMap<i64, String>,
}

static HOST: Mutex<Option<PluginHost>> = Mutex::new(None);

/// Initialize the plugin host. Must be called once at startup.
fn ensure_host() {
    let mut host = HOST.lock().unwrap();
    if host.is_none() {
        let registry_path = get_registry_path();
        *host = Some(PluginHost {
            plugins: HashMap::new(),
            hook_registry: HookRegistry::new(),
            registry: PluginRegistry::load(&registry_path),
            next_handle: 1,
            handle_to_name: HashMap::new(),
        });
    }
}

fn get_registry_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    PathBuf::from(home).join(".hone").join("plugins").join("registry.json")
}

fn get_plugins_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    PathBuf::from(home).join(".hone").join("plugins")
}

// ---------------------------------------------------------------------------
// String helpers for Perry FFI (NaN-boxed string pointers)
// ---------------------------------------------------------------------------

/// Extract a Rust string from a Perry NaN-boxed string pointer.
///
/// # Safety
/// The pointer must be a valid Perry StringHeader.
unsafe fn str_from_ptr(ptr: *const u8) -> String {
    if ptr.is_null() {
        return String::new();
    }
    // Perry StringHeader layout: [length: u32][capacity: u32][data...]
    let len = *(ptr as *const u32) as usize;
    let data_ptr = ptr.add(8); // Skip 8 bytes (length + capacity)
    let slice = std::slice::from_raw_parts(data_ptr, len);
    String::from_utf8_lossy(slice).to_string()
}

// ---------------------------------------------------------------------------
// FFI exports
// ---------------------------------------------------------------------------

/// Initialize the plugin host system.
/// Called from TypeScript: `hone_plugin_init()`
#[no_mangle]
pub extern "C" fn hone_plugin_init() -> f64 {
    ensure_host();
    1.0 // success
}

/// Load a plugin from a directory path containing plugin.hone.json and a .dylib.
/// Returns a handle (>0) on success, 0 on failure.
///
/// # Safety
/// `path_ptr` must be a valid Perry NaN-boxed string pointer.
#[no_mangle]
pub unsafe extern "C" fn hone_plugin_load(path_ptr: *const u8) -> f64 {
    ensure_host();
    let path_str = str_from_ptr(path_ptr);
    let plugin_dir = PathBuf::from(&path_str);

    // Read manifest
    let manifest_path = plugin_dir.join("plugin.hone.json");
    let manifest = match parse_manifest_file(&manifest_path) {
        Ok(m) => m,
        Err(errors) => {
            for e in &errors {
                eprintln!("[hone-plugin-host] Manifest error: {}", e);
            }
            return 0.0;
        }
    };

    let plugin_name = manifest.name.clone();
    let tier = derive_tier(&manifest.capabilities);

    // Find the dylib
    let dylib_name = format!("{}.dylib", manifest.name);
    let dylib_path = plugin_dir.join(&dylib_name);
    if !dylib_path.exists() {
        eprintln!("[hone-plugin-host] Dylib not found: {}", dylib_path.display());
        return 0.0;
    }

    // Build host API
    let mut api = build_host_api(&manifest.capabilities);

    // Load the plugin
    match crate::loader::load_plugin(&dylib_path, manifest.clone(), &mut api) {
        Ok(loaded) => {
            let mut host = HOST.lock().unwrap();
            let host = host.as_mut().unwrap();

            let handle = host.next_handle;
            host.next_handle += 1;

            // Register hooks from manifest
            for hook in &manifest.hooks {
                // Try to dlsym the hook function from the plugin dylib
                let hook_fn_ptr = resolve_hook_symbol(&loaded, hook);
                host.hook_registry.register(hook, &plugin_name, 10, hook_fn_ptr);
            }

            // Register in persistent registry
            host.registry.register(
                &plugin_name,
                &manifest.version,
                tier,
                &manifest.capabilities,
                TrustLevel::ShowDiff,
            );
            let _ = host.registry.save();

            host.handle_to_name.insert(handle, plugin_name.clone());
            host.plugins.insert(plugin_name, loaded);

            handle as f64
        }
        Err(e) => {
            eprintln!("[hone-plugin-host] Load error: {}", e);
            0.0
        }
    }
}

/// Unload a plugin by handle.
#[no_mangle]
pub extern "C" fn hone_plugin_unload(handle: f64) -> f64 {
    let handle_i64 = handle as i64;
    let mut host = HOST.lock().unwrap();
    let host = match host.as_mut() {
        Some(h) => h,
        None => return 0.0,
    };

    let name = match host.handle_to_name.remove(&handle_i64) {
        Some(n) => n,
        None => return 0.0,
    };

    // Unregister hooks
    host.hook_registry.unregister_plugin(&name);

    // Unload the plugin
    if let Some(mut plugin) = host.plugins.remove(&name) {
        unsafe { crate::loader::unload_plugin(&mut plugin) };
    }

    // Update registry
    host.registry.set_enabled(&name, false);
    let _ = host.registry.save();

    1.0 // success
}

/// Get the number of loaded plugins.
#[no_mangle]
pub extern "C" fn hone_plugin_count() -> f64 {
    let host = HOST.lock().unwrap();
    match host.as_ref() {
        Some(h) => h.plugins.len() as f64,
        None => 0.0,
    }
}

/// Check if a hook has any registered handlers.
///
/// # Safety
/// `hook_name_ptr` must be a valid Perry NaN-boxed string pointer.
#[no_mangle]
pub unsafe extern "C" fn hone_plugin_has_hook(hook_name_ptr: *const u8) -> f64 {
    let hook_name = str_from_ptr(hook_name_ptr);
    let host = HOST.lock().unwrap();
    match host.as_ref() {
        Some(h) => {
            if h.hook_registry.has_hook(&hook_name) { 1.0 } else { 0.0 }
        }
        None => 0.0,
    }
}

/// Get the number of registered hooks.
#[no_mangle]
pub extern "C" fn hone_plugin_hook_count() -> f64 {
    let host = HOST.lock().unwrap();
    match host.as_ref() {
        Some(h) => h.hook_registry.total_registrations() as f64,
        None => 0.0,
    }
}

/// Register a TypeScript callback function with the host API bridge.
///
/// `callback_id` identifies which capability function to wire (see CALLBACK_* constants).
/// `fn_ptr` is a function pointer from Perry-compiled TypeScript.
///
/// # Safety
/// `fn_ptr` must be a valid function pointer.
#[no_mangle]
pub extern "C" fn hone_plugin_register_host_callback(callback_id: i64, fn_ptr: i64) -> f64 {
    register_callback(callback_id, fn_ptr) as f64
}

/// Dispatch a hook event to all registered plugin handlers.
///
/// For each handler registered for `hook_name`, calls the handler function
/// with the event data. Handlers are called in priority order.
///
/// IMPORTANT: Clones handler list and releases the HOST lock before calling
/// into plugin code, so plugins can safely call back into the host API
/// (e.g., show a notification) without deadlocking.
///
/// # Safety
/// `hook_name_ptr` and `event_data_ptr` must be valid Perry NaN-boxed string pointers.
#[no_mangle]
pub unsafe extern "C" fn hone_plugin_dispatch_hook(
    hook_name_ptr: *const u8,
    event_data_ptr: *const u8,
) -> f64 {
    let hook_name = str_from_ptr(hook_name_ptr);

    // Clone handlers and release the lock BEFORE calling into plugin code.
    // This prevents deadlock if the plugin calls back into the host.
    let handlers = {
        let host = HOST.lock().unwrap();
        let host = match host.as_ref() {
            Some(h) => h,
            None => return 0.0,
        };
        let h = host.hook_registry.get_handlers(&hook_name);
        if h.is_empty() {
            return 0.0;
        }
        h.to_vec()
    }; // HOST lock released here

    let mut dispatched: f64 = 0.0;
    for handler in &handlers {
        if handler.handler != 0 {
            let hook_fn: unsafe extern "C" fn(*const u8) -> i64 =
                std::mem::transmute(handler.handler as usize);
            hook_fn(event_data_ptr);
            dispatched += 1.0;
        }
    }

    dispatched
}

/// Scan a directory for plugin subdirectories and load each one.
/// Each subdirectory must contain a plugin.hone.json and a matching .dylib.
///
/// Returns the number of plugins successfully loaded.
///
/// # Safety
/// `dir_ptr` must be a valid Perry NaN-boxed string pointer.
#[no_mangle]
pub unsafe extern "C" fn hone_plugin_scan_and_load(dir_ptr: *const u8) -> f64 {
    ensure_host();
    let dir_str = str_from_ptr(dir_ptr);

    // Expand ~ to $HOME
    let expanded = if dir_str.starts_with("~/") {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
        format!("{}{}", home, &dir_str[1..])
    } else {
        dir_str
    };

    let dir_path = PathBuf::from(&expanded);
    if !dir_path.is_dir() {
        // No plugins dir yet — not an error
        return 0.0;
    }

    let mut loaded = 0.0f64;
    if let Ok(entries) = std::fs::read_dir(&dir_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            // Check if this directory has a plugin.hone.json
            let manifest_path = path.join("plugin.hone.json");
            if !manifest_path.exists() {
                continue;
            }
            // Try to load the plugin
            // Create a Perry-style string header for the path
            let path_str = path.to_string_lossy().to_string();
            let path_bytes = path_str.as_bytes();
            let len = path_bytes.len() as u32;
            let cap = len;
            // Build a temporary StringHeader: [len:u32][cap:u32][data...]
            let mut header = Vec::with_capacity(8 + path_bytes.len());
            header.extend_from_slice(&len.to_ne_bytes());
            header.extend_from_slice(&cap.to_ne_bytes());
            header.extend_from_slice(path_bytes);

            let result = hone_plugin_load(header.as_ptr());
            if result > 0.0 {
                loaded += 1.0;
            }
        }
    }

    loaded
}

// ---------------------------------------------------------------------------
// Hook symbol resolution
// ---------------------------------------------------------------------------

/// Try to find the hook function symbol in a loaded plugin's dylib.
///
/// Tries multiple naming conventions in order:
/// 1. Top-level export: `onCommand` (Perry exports top-level functions directly)
/// 2. Snake_case: `on_command`
/// 3. Plugin prefix: `plugin_on_command`
/// 4. Entry class method: `HelloWorldPlugin_onCommand` (from manifest entry field)
fn resolve_hook_symbol(plugin: &LoadedPlugin, hook_name: &str) -> u64 {
    // Strip "onCommand:hello-world.greet" → "onCommand" (colon-separated filter)
    let base_hook = if let Some(idx) = hook_name.find(':') {
        &hook_name[..idx]
    } else {
        hook_name
    };

    let snake = camel_to_snake(base_hook);
    let entry_class = &plugin.manifest.entry;

    // Symbol candidates to try
    let candidates = [
        base_hook.to_string(),                           // onCommand
        snake.clone(),                                    // on_command
        format!("plugin_{}", snake),                     // plugin_on_command
        format!("{}_{}", entry_class, base_hook),        // HelloWorldPlugin_onCommand
    ];

    unsafe {
        for sym_name in &candidates {
            if let Ok(c_sym) = std::ffi::CString::new(sym_name.as_bytes()) {
                let ptr = libc::dlsym(plugin.handle_ptr(), c_sym.as_ptr());
                if !ptr.is_null() {
                    return ptr as u64;
                }
            }
        }
    }

    0 // Hook function not found in dylib — will be skipped during dispatch
}

/// Convert camelCase to snake_case.
/// e.g. "onDocumentSave" -> "on_document_save"
fn camel_to_snake(s: &str) -> String {
    let mut result = String::with_capacity(s.len() + 4);
    for (i, ch) in s.chars().enumerate() {
        if ch.is_uppercase() && i > 0 {
            result.push('_');
        }
        result.push(ch.to_ascii_lowercase());
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn init_and_count() {
        hone_plugin_init();
        assert_eq!(hone_plugin_count(), 0.0);
    }

    #[test]
    fn load_nonexistent() {
        hone_plugin_init();
        unsafe {
            let result = hone_plugin_load(std::ptr::null());
            assert_eq!(result, 0.0);
        }
    }

    #[test]
    fn camel_to_snake_basic() {
        assert_eq!(camel_to_snake("onDocumentSave"), "on_document_save");
        assert_eq!(camel_to_snake("onDocumentFormat"), "on_document_format");
        assert_eq!(camel_to_snake("onCommand"), "on_command");
        assert_eq!(camel_to_snake("onSelectionChange"), "on_selection_change");
    }

    #[test]
    fn register_host_callback() {
        let result = hone_plugin_register_host_callback(1, 0x12345678);
        assert_eq!(result, 1.0);
    }

    #[test]
    fn register_invalid_callback() {
        let result = hone_plugin_register_host_callback(999, 0x12345678);
        assert_eq!(result, 0.0);
    }

    #[test]
    fn scan_empty_dir() {
        hone_plugin_init();
        unsafe {
            let result = hone_plugin_scan_and_load(std::ptr::null());
            assert_eq!(result, 0.0);
        }
    }

    #[test]
    fn dispatch_hook_no_handlers() {
        hone_plugin_init();
        unsafe {
            let result = hone_plugin_dispatch_hook(std::ptr::null(), std::ptr::null());
            assert_eq!(result, 0.0);
        }
    }
}
