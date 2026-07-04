//! Host API FFI functions callable by plugins.
//!
//! These are `#[no_mangle] extern "C"` functions that Perry-compiled plugin dylibs
//! call to interact with the IDE (show notifications, register commands, etc.).
//!
//! When a plugin dylib is dlopen'd into the hone-ide process, these symbols are
//! resolved from the main executable (since hone-plugin-host is statically linked in).
//!
//! The functions forward calls to the registered TypeScript callbacks via
//! `snapshot_callbacks()` — the same bridge used by the HoneHostAPI struct.
//! String parameters are Perry StringHeader pointers (passed through directly).

use crate::host_api::snapshot_callbacks;

// ---------------------------------------------------------------------------
// Host API FFI — called by plugins
// ---------------------------------------------------------------------------

/// Log a message. level: 0=debug, 1=info, 2=warn, 3=error.
/// `msg_ptr` is a Perry StringHeader pointer.
#[no_mangle]
pub unsafe extern "C" fn hone_host_api_log(level: f64, msg_ptr: i64) {
    let l = level as i32;
    let prefix = match l {
        0 => "[plugin:DEBUG]",
        1 => "[plugin:INFO]",
        2 => "[plugin:WARN]",
        3 => "[plugin:ERROR]",
        _ => "[plugin]",
    };
    // Read the string for stderr output. Use perry-ffi so the current
    // StringHeader layout is honored — the old hand-rolled 8-byte reader here
    // (byte_len@0, data@8) silently broke when Perry v0.5.213 grew StringHeader
    // to 5 fields (20 bytes, byte_len@4, data@20), corrupting every plugin log.
    if msg_ptr != 0 {
        let handle = perry_ffi::JsString::from_raw(msg_ptr as *mut perry_ffi::StringHeader);
        let msg = perry_ffi::read_string(handle).unwrap_or("<invalid utf8>");
        eprintln!("{} {}", prefix, msg);
    }
}

/// Show a notification.
/// All params are Perry StringHeader pointers (passed through to TS callback).
#[no_mangle]
pub unsafe extern "C" fn hone_host_api_notify(
    plugin_name: i64,
    message: i64,
    severity: i64,
) {
    let cbs = snapshot_callbacks();
    if let Some(cb) = cbs.notify {
        cb(plugin_name, message, severity);
    }
}

/// Register a command in the command palette.
#[no_mangle]
pub unsafe extern "C" fn hone_host_api_command_register(
    plugin_name: i64,
    id: i64,
    title: i64,
) {
    let cbs = snapshot_callbacks();
    if let Some(cb) = cbs.command_register {
        cb(plugin_name, id, title);
    }
}

/// Unregister a command from the command palette.
#[no_mangle]
pub unsafe extern "C" fn hone_host_api_command_unregister(id: i64) {
    let cbs = snapshot_callbacks();
    if let Some(cb) = cbs.command_unregister {
        cb(id);
    }
}

/// Create a status bar item. Returns a handle (f64).
#[no_mangle]
pub unsafe extern "C" fn hone_host_api_statusbar_create(
    plugin_name: i64,
    text: i64,
    tooltip: i64,
    alignment: i64,
    priority: f64,
    command_id: i64,
) -> f64 {
    let cbs = snapshot_callbacks();
    if let Some(cb) = cbs.statusbar_create {
        cb(plugin_name, text, tooltip, alignment, priority, command_id)
    } else {
        -1.0
    }
}

/// Update a status bar item.
#[no_mangle]
pub unsafe extern "C" fn hone_host_api_statusbar_update(
    handle: f64,
    text: i64,
    tooltip: i64,
) {
    let cbs = snapshot_callbacks();
    if let Some(cb) = cbs.statusbar_update {
        cb(handle, text, tooltip);
    }
}

/// Remove a status bar item.
#[no_mangle]
pub unsafe extern "C" fn hone_host_api_statusbar_remove(handle: f64) {
    let cbs = snapshot_callbacks();
    if let Some(cb) = cbs.statusbar_remove {
        cb(handle);
    }
}
