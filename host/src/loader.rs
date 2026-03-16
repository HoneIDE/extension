//! Plugin loader — dlopen/dlsym for loading Perry-compiled plugin dylibs.

use crate::host_api::HoneHostAPI;
use crate::manifest::PluginManifest;
use std::ffi::CString;
use std::path::Path;

/// A loaded plugin instance.
pub struct LoadedPlugin {
    /// The plugin's manifest.
    pub manifest: PluginManifest,
    /// The dylib handle from dlopen (kept alive to prevent unloading).
    handle: *mut libc::c_void,
    /// Whether activate() has been called.
    pub activated: bool,
}

impl LoadedPlugin {
    /// Get the raw dlopen handle for dlsym lookups.
    pub fn handle_ptr(&self) -> *mut libc::c_void {
        self.handle
    }
}

impl std::fmt::Debug for LoadedPlugin {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("LoadedPlugin")
            .field("manifest_name", &self.manifest.name)
            .field("activated", &self.activated)
            .finish()
    }
}

// Safety: LoadedPlugin is only accessed under a Mutex in ffi.rs.
// The raw pointer is from dlopen and is valid for the lifetime of the plugin.
unsafe impl Send for LoadedPlugin {}

/// Error during plugin loading.
#[derive(Debug)]
pub enum LoadError {
    /// The dylib file was not found.
    FileNotFound(String),
    /// dlopen failed.
    DlopenFailed(String),
    /// Required symbol not found in dylib.
    SymbolNotFound(String),
    /// ABI version mismatch.
    AbiMismatch { expected: u64, found: u64 },
    /// plugin_activate returned failure.
    ActivationFailed,
}

impl std::fmt::Display for LoadError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LoadError::FileNotFound(path) => write!(f, "Plugin file not found: {}", path),
            LoadError::DlopenFailed(msg) => write!(f, "dlopen failed: {}", msg),
            LoadError::SymbolNotFound(sym) => write!(f, "Symbol not found: {}", sym),
            LoadError::AbiMismatch { expected, found } => {
                write!(f, "ABI version mismatch: expected {}, found {}", expected, found)
            }
            LoadError::ActivationFailed => write!(f, "Plugin activation failed"),
        }
    }
}

/// Expected ABI version. Plugins must export perry_plugin_abi_version() returning this.
const EXPECTED_ABI_VERSION: u64 = 2;

/// Load a plugin from a dylib path.
///
/// Steps:
/// 1. dlopen the dylib
/// 2. dlsym for perry_plugin_abi_version, verify it matches
/// 3. dlsym for plugin_activate
/// 4. Call plugin_activate with the host API handle
///
/// # Safety
/// This function calls dlopen/dlsym and executes foreign code.
pub unsafe fn load_plugin(
    dylib_path: &Path,
    manifest: PluginManifest,
    api: &mut HoneHostAPI,
) -> Result<LoadedPlugin, LoadError> {
    let path_str = dylib_path.to_string_lossy();
    if !dylib_path.exists() {
        return Err(LoadError::FileNotFound(path_str.to_string()));
    }

    let c_path = CString::new(path_str.as_bytes())
        .map_err(|_| LoadError::FileNotFound(path_str.to_string()))?;

    // dlopen
    let handle = libc::dlopen(c_path.as_ptr(), libc::RTLD_NOW | libc::RTLD_LOCAL);
    if handle.is_null() {
        let err = libc::dlerror();
        let msg = if err.is_null() {
            "unknown error".to_string()
        } else {
            std::ffi::CStr::from_ptr(err).to_string_lossy().to_string()
        };
        return Err(LoadError::DlopenFailed(msg));
    }

    // Check ABI version
    let abi_sym = CString::new("perry_plugin_abi_version").unwrap();
    let abi_fn_ptr = libc::dlsym(handle, abi_sym.as_ptr());
    if abi_fn_ptr.is_null() {
        libc::dlclose(handle);
        return Err(LoadError::SymbolNotFound("perry_plugin_abi_version".to_string()));
    }
    let abi_fn: unsafe extern "C" fn() -> u64 = std::mem::transmute(abi_fn_ptr);
    let abi_version = abi_fn();
    if abi_version != EXPECTED_ABI_VERSION {
        libc::dlclose(handle);
        return Err(LoadError::AbiMismatch {
            expected: EXPECTED_ABI_VERSION,
            found: abi_version,
        });
    }

    // Find plugin_activate
    let activate_sym = CString::new("plugin_activate").unwrap();
    let activate_fn_ptr = libc::dlsym(handle, activate_sym.as_ptr());
    if activate_fn_ptr.is_null() {
        libc::dlclose(handle);
        return Err(LoadError::SymbolNotFound("plugin_activate".to_string()));
    }

    // Call plugin_activate with a handle to the host API
    let api_ptr = api as *mut HoneHostAPI as i64;
    let activate_fn: unsafe extern "C" fn(i64) -> i64 = std::mem::transmute(activate_fn_ptr);
    let result = activate_fn(api_ptr);
    if result == 0 {
        libc::dlclose(handle);
        return Err(LoadError::ActivationFailed);
    }

    Ok(LoadedPlugin {
        manifest,
        handle,
        activated: true,
    })
}

/// Deactivate and unload a plugin.
///
/// # Safety
/// Calls dlsym for plugin_deactivate and dlclose.
pub unsafe fn unload_plugin(plugin: &mut LoadedPlugin) {
    if plugin.activated {
        // Try to call plugin_deactivate if it exists
        let deactivate_sym = CString::new("plugin_deactivate").unwrap();
        let deactivate_fn_ptr = libc::dlsym(plugin.handle, deactivate_sym.as_ptr());
        if !deactivate_fn_ptr.is_null() {
            let deactivate_fn: unsafe extern "C" fn() = std::mem::transmute(deactivate_fn_ptr);
            deactivate_fn();
        }
        plugin.activated = false;
    }

    if !plugin.handle.is_null() {
        libc::dlclose(plugin.handle);
        plugin.handle = std::ptr::null_mut();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn load_nonexistent_file() {
        let manifest = crate::manifest::parse_manifest(r#"{
            "name": "test", "displayName": "Test", "version": "1.0.0",
            "author": "A", "license": "MIT", "description": "", "entry": "Test",
            "capabilities": {}, "hooks": [], "hone": ">=0.1.0"
        }"#).unwrap();

        let mut api = crate::host_api::build_host_api(&manifest.capabilities);
        let result = unsafe { load_plugin(&PathBuf::from("/nonexistent.dylib"), manifest, &mut api) };
        assert!(result.is_err());
        match result.unwrap_err() {
            LoadError::FileNotFound(_) => {}
            other => panic!("Expected FileNotFound, got: {:?}", other),
        }
    }
}
