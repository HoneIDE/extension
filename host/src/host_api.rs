//! HoneHostAPI — C ABI struct with capability-gated function pointers.
//!
//! Each plugin receives a HoneHostAPI populated only with functions matching
//! its declared capabilities. Undeclared capabilities have null function pointers.
//!
//! Bridge functions here call into Perry-compiled TypeScript via registered callbacks.
//! Data is marshalled as JSON strings across the boundary (simple, debuggable).

use crate::manifest::Capabilities;
use std::sync::Mutex;

/// Log levels matching the TypeScript SDK.
#[repr(i32)]
#[derive(Debug, Clone, Copy)]
pub enum LogLevel {
    Debug = 0,
    Info = 1,
    Warn = 2,
    Error = 3,
}

/// Callback types for host API functions.
/// All use extern "C" for ABI compatibility with Perry-compiled plugins.
pub type LogFn = unsafe extern "C" fn(level: i32, msg_ptr: *const u8, msg_len: u32);
pub type GetConfigFn = unsafe extern "C" fn(key_ptr: *const u8, key_len: u32) -> f64;
pub type GetWorkspacePathFn = unsafe extern "C" fn() -> f64;

// editor.read
pub type BufferGetTextFn = unsafe extern "C" fn(buffer_id: i64) -> f64;
pub type BufferGetLineCountFn = unsafe extern "C" fn(buffer_id: i64) -> i32;
pub type GetActiveBufferIdFn = unsafe extern "C" fn() -> i64;

// editor.write
pub type BufferSubmitEditsFn = unsafe extern "C" fn(buffer_id: i64, edits_ptr: i64) -> i64;

// ui.statusbar
pub type StatusBarCreateItemFn = unsafe extern "C" fn(opts_ptr: i64) -> i32;
pub type StatusBarUpdateItemFn = unsafe extern "C" fn(id: i32, opts_ptr: i64);
pub type StatusBarRemoveItemFn = unsafe extern "C" fn(id: i32);

// ui.commandPalette
pub type CommandRegisterFn = unsafe extern "C" fn(id_ptr: *const u8, id_len: u32, title_ptr: *const u8, title_len: u32);
pub type CommandUnregisterFn = unsafe extern "C" fn(id_ptr: *const u8, id_len: u32);

// ui.notifications
pub type NotifyFn = unsafe extern "C" fn(opts_ptr: i64);

/// The Host API struct passed to plugins via the C ABI.
///
/// Function pointers for undeclared capabilities are null.
/// Plugins must check before calling (or the Perry linker enforces at compile time).
#[repr(C)]
pub struct HoneHostAPI {
    // --- Always available ---
    pub log: Option<LogFn>,
    pub get_config: Option<GetConfigFn>,
    pub get_workspace_path: Option<GetWorkspacePathFn>,

    // --- editor.read ---
    pub buffer_get_text: Option<BufferGetTextFn>,
    pub buffer_get_line_count: Option<BufferGetLineCountFn>,
    pub get_active_buffer_id: Option<GetActiveBufferIdFn>,

    // --- editor.write ---
    pub buffer_submit_edits: Option<BufferSubmitEditsFn>,

    // --- ui.statusbar ---
    pub statusbar_create_item: Option<StatusBarCreateItemFn>,
    pub statusbar_update_item: Option<StatusBarUpdateItemFn>,
    pub statusbar_remove_item: Option<StatusBarRemoveItemFn>,

    // --- ui.commandPalette ---
    pub command_register: Option<CommandRegisterFn>,
    pub command_unregister: Option<CommandUnregisterFn>,

    // --- ui.notifications ---
    pub notify: Option<NotifyFn>,
}

// ---------------------------------------------------------------------------
// Callback IDs — must match TypeScript CALLBACK_* constants in plugin-ffi.ts
// ---------------------------------------------------------------------------

pub const CALLBACK_NOTIFY: i64 = 1;
pub const CALLBACK_STATUSBAR_CREATE: i64 = 2;
pub const CALLBACK_STATUSBAR_UPDATE: i64 = 3;
pub const CALLBACK_STATUSBAR_REMOVE: i64 = 4;
pub const CALLBACK_COMMAND_REGISTER: i64 = 5;
pub const CALLBACK_COMMAND_UNREGISTER: i64 = 6;

// ---------------------------------------------------------------------------
// Registered TypeScript callbacks (set via hone_plugin_register_host_callback)
// ---------------------------------------------------------------------------

/// Stored callback function pointers from Perry-compiled TypeScript.
/// These are set once at init and read by bridge functions below.
///
/// Perry-compiled TypeScript functions receive strings as NaN-boxed pointers (i64).
/// We build Perry StringHeaders on the Rust side and pass them.
pub struct HostCallbacks {
    /// pluginNotify(pluginName, message, severity) — 3 string args
    pub notify: Option<unsafe extern "C" fn(i64, i64, i64)>,
    /// pluginStatusBarCreate(pluginName, text, tooltip, alignment, priority, commandId) -> handle
    pub statusbar_create: Option<unsafe extern "C" fn(i64, i64, i64, i64, f64, i64) -> f64>,
    /// pluginStatusBarUpdate(handle, text, tooltip)
    pub statusbar_update: Option<unsafe extern "C" fn(f64, i64, i64)>,
    /// pluginStatusBarRemove(handle)
    pub statusbar_remove: Option<unsafe extern "C" fn(f64)>,
    /// pluginCommandRegister(pluginName, commandId, title)
    pub command_register: Option<unsafe extern "C" fn(i64, i64, i64)>,
    /// pluginCommandUnregister(commandId)
    pub command_unregister: Option<unsafe extern "C" fn(i64)>,
}

// Clone so we can copy callbacks out before dropping the lock.
impl Clone for HostCallbacks {
    fn clone(&self) -> Self {
        Self {
            notify: self.notify,
            statusbar_create: self.statusbar_create,
            statusbar_update: self.statusbar_update,
            statusbar_remove: self.statusbar_remove,
            command_register: self.command_register,
            command_unregister: self.command_unregister,
        }
    }
}

static CALLBACKS: Mutex<HostCallbacks> = Mutex::new(HostCallbacks {
    notify: None,
    statusbar_create: None,
    statusbar_update: None,
    statusbar_remove: None,
    command_register: None,
    command_unregister: None,
});

/// Register a TypeScript callback. Called from FFI during init.
pub fn register_callback(callback_id: i64, fn_ptr: i64) -> i64 {
    let mut cbs = CALLBACKS.lock().unwrap();
    match callback_id {
        CALLBACK_NOTIFY => {
            cbs.notify = Some(unsafe { std::mem::transmute(fn_ptr as usize) });
        }
        CALLBACK_STATUSBAR_CREATE => {
            cbs.statusbar_create = Some(unsafe { std::mem::transmute(fn_ptr as usize) });
        }
        CALLBACK_STATUSBAR_UPDATE => {
            cbs.statusbar_update = Some(unsafe { std::mem::transmute(fn_ptr as usize) });
        }
        CALLBACK_STATUSBAR_REMOVE => {
            cbs.statusbar_remove = Some(unsafe { std::mem::transmute(fn_ptr as usize) });
        }
        CALLBACK_COMMAND_REGISTER => {
            cbs.command_register = Some(unsafe { std::mem::transmute(fn_ptr as usize) });
        }
        CALLBACK_COMMAND_UNREGISTER => {
            cbs.command_unregister = Some(unsafe { std::mem::transmute(fn_ptr as usize) });
        }
        _ => return 0,
    }
    1
}

/// Snapshot the current callbacks (cloned) and release the lock.
/// This avoids deadlocking if a callback calls back into the host.
pub fn snapshot_callbacks() -> HostCallbacks {
    CALLBACKS.lock().unwrap().clone()
}

// ---------------------------------------------------------------------------
// Perry StringHeader helpers — build strings that Perry can read
// ---------------------------------------------------------------------------

/// Build a Perry StringHeader on the heap: [len:u32][cap:u32][data...].
/// Returns a raw pointer as i64 (NaN-boxed pointer Perry expects).
///
/// The caller is responsible for keeping the allocation alive for the
/// duration of the callback. We use Box::leak intentionally — these are
/// short-lived strings that Perry reads synchronously.
fn make_perry_string(s: &str) -> i64 {
    let bytes = s.as_bytes();
    let len = bytes.len() as u32;
    let total = 8 + bytes.len();
    let mut buf = Vec::with_capacity(total);
    buf.extend_from_slice(&len.to_ne_bytes()); // length
    buf.extend_from_slice(&len.to_ne_bytes()); // capacity = length
    buf.extend_from_slice(bytes);
    let leaked = Box::leak(buf.into_boxed_slice());
    leaked.as_ptr() as i64
}

/// Free a Perry string previously created with make_perry_string.
///
/// # Safety
/// Must only be called with pointers returned by make_perry_string.
unsafe fn free_perry_string(ptr: i64) {
    if ptr == 0 { return; }
    let p = ptr as *mut u8;
    // Read back the length to reconstruct the slice
    let len = *(p as *const u32) as usize;
    let total = 8 + len;
    let _ = Box::from_raw(std::slice::from_raw_parts_mut(p, total));
}

// ---------------------------------------------------------------------------
// Bridge functions — called by plugins via HoneHostAPI function pointers.
// These forward to the registered TypeScript callbacks.
//
// IMPORTANT: These snapshot the callbacks (releasing the CALLBACKS lock)
// before calling, so plugins can safely call back into the host.
// ---------------------------------------------------------------------------

/// Default host API log implementation — prints to stderr.
unsafe extern "C" fn default_log(level: i32, msg_ptr: *const u8, msg_len: u32) {
    let msg = std::str::from_utf8(std::slice::from_raw_parts(msg_ptr, msg_len as usize))
        .unwrap_or("<invalid utf8>");
    let prefix = match level {
        0 => "[DEBUG]",
        1 => "[INFO]",
        2 => "[WARN]",
        3 => "[ERROR]",
        _ => "[???]",
    };
    eprintln!("{} {}", prefix, msg);
}

/// Bridge: plugin calls host.notify(opts_ptr).
///
/// opts_ptr is a JSON string: {"pluginName":"...","message":"...","severity":"info"}
/// We parse it and call TS pluginNotify(pluginName, message, severity).
unsafe extern "C" fn bridge_notify(opts_ptr: i64) {
    let cbs = snapshot_callbacks();
    let cb = match cbs.notify {
        Some(f) => f,
        None => return,
    };

    // Parse JSON from the NaN-boxed string pointer
    let json_str = str_from_nanbox(opts_ptr);
    let parsed: serde_json::Value = match serde_json::from_str(&json_str) {
        Ok(v) => v,
        Err(_) => {
            // Fallback: treat entire string as the message
            let pn = make_perry_string("unknown");
            let msg = make_perry_string(&json_str);
            let sev = make_perry_string("info");
            cb(pn, msg, sev);
            free_perry_string(pn);
            free_perry_string(msg);
            free_perry_string(sev);
            return;
        }
    };

    let plugin_name = parsed.get("pluginName").and_then(|v| v.as_str()).unwrap_or("unknown");
    let message = parsed.get("message").and_then(|v| v.as_str()).unwrap_or("");
    let severity = parsed.get("severity").and_then(|v| v.as_str()).unwrap_or("info");

    let pn = make_perry_string(plugin_name);
    let msg = make_perry_string(message);
    let sev = make_perry_string(severity);
    cb(pn, msg, sev);
    free_perry_string(pn);
    free_perry_string(msg);
    free_perry_string(sev);
}

/// Bridge: plugin calls host.statusBar.createItem(opts_ptr).
///
/// opts_ptr is JSON: {"pluginName":"...","text":"...","tooltip":"...","alignment":"left","priority":10,"commandId":"..."}
unsafe extern "C" fn bridge_statusbar_create(opts_ptr: i64) -> i32 {
    let cbs = snapshot_callbacks();
    let cb = match cbs.statusbar_create {
        Some(f) => f,
        None => return -1,
    };

    let json_str = str_from_nanbox(opts_ptr);
    let parsed: serde_json::Value = match serde_json::from_str(&json_str) {
        Ok(v) => v,
        Err(_) => return -1,
    };

    let plugin_name = make_perry_string(parsed.get("pluginName").and_then(|v| v.as_str()).unwrap_or(""));
    let text = make_perry_string(parsed.get("text").and_then(|v| v.as_str()).unwrap_or(""));
    let tooltip = make_perry_string(parsed.get("tooltip").and_then(|v| v.as_str()).unwrap_or(""));
    let alignment = make_perry_string(parsed.get("alignment").and_then(|v| v.as_str()).unwrap_or("right"));
    let priority = parsed.get("priority").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let command_id = make_perry_string(parsed.get("commandId").and_then(|v| v.as_str()).unwrap_or(""));

    let result = cb(plugin_name, text, tooltip, alignment, priority, command_id) as i32;

    free_perry_string(plugin_name);
    free_perry_string(text);
    free_perry_string(tooltip);
    free_perry_string(alignment);
    free_perry_string(command_id);

    result
}

/// Bridge: plugin calls host.statusBar.updateItem(id, opts_ptr).
unsafe extern "C" fn bridge_statusbar_update(id: i32, opts_ptr: i64) {
    let cbs = snapshot_callbacks();
    let cb = match cbs.statusbar_update {
        Some(f) => f,
        None => return,
    };

    let json_str = str_from_nanbox(opts_ptr);
    let parsed: serde_json::Value = match serde_json::from_str(&json_str) {
        Ok(v) => v,
        Err(_) => return,
    };

    let text = make_perry_string(parsed.get("text").and_then(|v| v.as_str()).unwrap_or(""));
    let tooltip = make_perry_string(parsed.get("tooltip").and_then(|v| v.as_str()).unwrap_or(""));

    cb(id as f64, text, tooltip);

    free_perry_string(text);
    free_perry_string(tooltip);
}

/// Bridge: plugin calls host.statusBar.removeItem(id).
unsafe extern "C" fn bridge_statusbar_remove(id: i32) {
    let cbs = snapshot_callbacks();
    if let Some(cb) = cbs.statusbar_remove {
        cb(id as f64);
    }
}

/// Bridge: plugin calls host.command.register(id, title).
/// id_ptr and title_ptr are Perry NaN-boxed string pointers.
unsafe extern "C" fn bridge_command_register(
    id_ptr: *const u8, _id_len: u32,
    title_ptr: *const u8, _title_len: u32,
) {
    let cbs = snapshot_callbacks();
    let cb = match cbs.command_register {
        Some(f) => f,
        None => return,
    };

    // id_ptr and title_ptr are already Perry strings — read them,
    // then create new Perry strings with the plugin name prepended.
    let id_str = str_from_raw_perry(id_ptr);
    let title_str = str_from_raw_perry(title_ptr);

    // Extract plugin name from command ID (e.g. "hello-world.greet" -> "hello-world")
    let plugin_name = id_str.split('.').next().unwrap_or(&id_str);

    let pn = make_perry_string(plugin_name);
    let id = make_perry_string(&id_str);
    let title = make_perry_string(&title_str);

    cb(pn, id, title);

    free_perry_string(pn);
    free_perry_string(id);
    free_perry_string(title);
}

/// Bridge: plugin calls host.command.unregister(id).
unsafe extern "C" fn bridge_command_unregister(id_ptr: *const u8, _id_len: u32) {
    let cbs = snapshot_callbacks();
    if let Some(cb) = cbs.command_unregister {
        let id_str = str_from_raw_perry(id_ptr);
        let id = make_perry_string(&id_str);
        cb(id);
        free_perry_string(id);
    }
}

// ---------------------------------------------------------------------------
// String extraction helpers
// ---------------------------------------------------------------------------

/// Extract a Rust string from a NaN-boxed pointer (i64).
/// Used for JSON strings passed from plugin code.
unsafe fn str_from_nanbox(ptr: i64) -> String {
    if ptr == 0 { return String::new(); }
    let p = ptr as *const u8;
    let len = *(p as *const u32) as usize;
    let data = p.add(8);
    let slice = std::slice::from_raw_parts(data, len);
    String::from_utf8_lossy(slice).to_string()
}

/// Extract a Rust string from a raw Perry StringHeader pointer.
/// Used for raw *const u8 pointers in the C ABI functions.
unsafe fn str_from_raw_perry(ptr: *const u8) -> String {
    if ptr.is_null() { return String::new(); }
    let len = *(ptr as *const u32) as usize;
    let data = ptr.add(8);
    let slice = std::slice::from_raw_parts(data, len);
    String::from_utf8_lossy(slice).to_string()
}

// ---------------------------------------------------------------------------
// Build host API
// ---------------------------------------------------------------------------

/// Build a HoneHostAPI struct populated according to the plugin's declared capabilities.
///
/// Always-available functions (log, getConfig, getWorkspacePath) are always set.
/// Capability-gated functions are only set if the manifest declares the capability.
/// Bridge functions forward to registered TypeScript callbacks.
pub fn build_host_api(caps: &Capabilities) -> HoneHostAPI {
    HoneHostAPI {
        // Always available
        log: Some(default_log),
        get_config: None,         // TODO: wire to real impl
        get_workspace_path: None, // TODO: wire to real impl

        // editor.read — not yet wired to TS
        buffer_get_text: if caps.editor_read { None } else { None },
        buffer_get_line_count: if caps.editor_read { None } else { None },
        get_active_buffer_id: if caps.editor_read { None } else { None },

        // editor.write — not yet wired to TS
        buffer_submit_edits: if caps.editor_write { None } else { None },

        // ui.statusbar — wired to TypeScript bridge
        statusbar_create_item: if caps.ui_statusbar { Some(bridge_statusbar_create) } else { None },
        statusbar_update_item: if caps.ui_statusbar { Some(bridge_statusbar_update) } else { None },
        statusbar_remove_item: if caps.ui_statusbar { Some(bridge_statusbar_remove) } else { None },

        // ui.commandPalette — wired to TypeScript bridge
        command_register: if caps.ui_command_palette { Some(bridge_command_register) } else { None },
        command_unregister: if caps.ui_command_palette { Some(bridge_command_unregister) } else { None },

        // ui.notifications — wired to TypeScript bridge
        notify: if caps.ui_notifications { Some(bridge_notify) } else { None },
    }
}

/// Check if a specific host API function is populated (non-null).
pub fn has_capability(api: &HoneHostAPI, cap: &str) -> bool {
    match cap {
        "log" => api.log.is_some(),
        "getConfig" => api.get_config.is_some(),
        "getWorkspacePath" => api.get_workspace_path.is_some(),
        "editor.read" => api.buffer_get_text.is_some(),
        "editor.write" => api.buffer_submit_edits.is_some(),
        "ui.statusbar" => api.statusbar_create_item.is_some(),
        "ui.commandPalette" => api.command_register.is_some(),
        "ui.notifications" => api.notify.is_some(),
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::manifest::Capabilities;

    #[test]
    fn build_api_always_has_log() {
        let api = build_host_api(&Capabilities::default());
        assert!(api.log.is_some());
    }

    #[test]
    fn build_api_default_has_no_editor() {
        let api = build_host_api(&Capabilities::default());
        assert!(api.buffer_get_text.is_none());
        assert!(api.buffer_submit_edits.is_none());
    }

    #[test]
    fn build_api_with_statusbar_has_bridge() {
        let mut caps = Capabilities::default();
        caps.ui_statusbar = true;
        let api = build_host_api(&caps);
        assert!(api.statusbar_create_item.is_some());
        assert!(api.statusbar_update_item.is_some());
        assert!(api.statusbar_remove_item.is_some());
    }

    #[test]
    fn build_api_with_notifications_has_bridge() {
        let mut caps = Capabilities::default();
        caps.ui_notifications = true;
        let api = build_host_api(&caps);
        assert!(api.notify.is_some());
    }

    #[test]
    fn build_api_with_commands_has_bridge() {
        let mut caps = Capabilities::default();
        caps.ui_command_palette = true;
        let api = build_host_api(&caps);
        assert!(api.command_register.is_some());
        assert!(api.command_unregister.is_some());
    }

    #[test]
    fn register_callback_valid_id() {
        let result = register_callback(CALLBACK_NOTIFY, 0x12345678);
        assert_eq!(result, 1);
    }

    #[test]
    fn register_callback_invalid_id() {
        let result = register_callback(999, 0x12345678);
        assert_eq!(result, 0);
    }

    #[test]
    fn make_and_free_perry_string() {
        let ptr = make_perry_string("hello world");
        assert_ne!(ptr, 0);
        unsafe {
            let readback = str_from_nanbox(ptr);
            assert_eq!(readback, "hello world");
            free_perry_string(ptr);
        }
    }

    #[test]
    fn perry_string_empty() {
        let ptr = make_perry_string("");
        assert_ne!(ptr, 0);
        unsafe {
            let readback = str_from_nanbox(ptr);
            assert_eq!(readback, "");
            free_perry_string(ptr);
        }
    }

    #[test]
    fn snapshot_callbacks_clones_safely() {
        // Test that snapshot_callbacks() returns a clone without panicking.
        // Note: other tests may have registered callbacks in the shared static,
        // so we can't assert None — just verify it doesn't deadlock.
        let cbs = snapshot_callbacks();
        let _ = cbs.notify; // access field without panic
    }
}
