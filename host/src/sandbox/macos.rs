//! macOS sandbox — generates sandbox-exec .sb profiles from capabilities.
//!
//! Uses Apple's Sandbox framework (sandbox_init/sandbox-exec) to restrict
//! what a plugin process can do at the OS level.

use crate::manifest::Capabilities;
use crate::tier::Tier;
use super::{Sandbox, SandboxError};

pub struct MacOSSandbox;

impl Sandbox for MacOSSandbox {
    /// Generate a macOS sandbox profile (.sb format) from capabilities.
    ///
    /// The profile uses Apple's Scheme-based sandbox language:
    /// - `(deny default)` — deny everything by default
    /// - `(allow ...)` — selectively allow based on capabilities
    fn generate_profile(caps: &Capabilities, tier: Tier, workspace_path: &str) -> Result<String, SandboxError> {
        let mut rules = Vec::new();

        // Version header
        rules.push("(version 1)".to_string());

        // Deny everything by default
        rules.push("(deny default)".to_string());

        // Always allow basic process operations
        rules.push("(allow process-exec-interpreter)".to_string());
        rules.push("(allow sysctl-read)".to_string());
        rules.push("(allow mach-lookup)".to_string());

        // Always allow reading system libraries and frameworks
        rules.push("(allow file-read* (subpath \"/usr/lib\"))".to_string());
        rules.push("(allow file-read* (subpath \"/System/Library\"))".to_string());
        rules.push("(allow file-read* (subpath \"/Library/Frameworks\"))".to_string());
        rules.push("(allow file-read* (subpath \"/usr/share\"))".to_string());

        // Allow reading the plugin's own directory
        // (The plugin dylib is already loaded, but it may need config files)

        // Filesystem read
        if caps.filesystem_read.as_ref().map(|g| !g.is_empty()).unwrap_or(false) || caps.editor_read {
            // Allow reading workspace files
            let rule = format!("(allow file-read* (subpath \"{}\"))", workspace_path);
            rules.push(rule);
        }

        // Filesystem write
        if caps.filesystem_write {
            let rule = format!("(allow file-write* (subpath \"{}\"))", workspace_path);
            rules.push(rule);
        }

        // Network
        if caps.network {
            rules.push("(allow network*)".to_string());
        }

        // Process spawning
        if let Some(ref binaries) = caps.process_spawn {
            if !binaries.is_empty() {
                rules.push("(allow process-fork)".to_string());
                rules.push("(allow process-exec)".to_string());
            }
        }

        // Terminal
        if caps.terminal {
            rules.push("(allow process-fork)".to_string());
            rules.push("(allow process-exec)".to_string());
            // Terminal needs PTY access
            rules.push("(allow file-read* file-write* (regex #\"/dev/pty.*\"))".to_string());
            rules.push("(allow file-read* file-write* (regex #\"/dev/tty.*\"))".to_string());
        }

        // Tier 3 gets temporary file access
        if tier == Tier::IsolatedProcess {
            rules.push("(allow file-read* file-write* (subpath \"/tmp\"))".to_string());
            rules.push("(allow file-read* file-write* (subpath \"/private/tmp\"))".to_string());
        }

        Ok(rules.join("\n"))
    }

    /// Apply a sandbox profile using sandbox_init.
    ///
    /// # Safety
    /// This calls the macOS sandbox_init C API which restricts the current process.
    /// Must be called before loading untrusted code.
    fn apply(profile: &str) -> Result<(), SandboxError> {
        // On macOS, sandbox_init is available but deprecated in favor of App Sandbox entitlements.
        // For process-level sandboxing of plugin host processes, we use sandbox_init.
        #[cfg(target_os = "macos")]
        {
            use std::ffi::CString;

            extern "C" {
                fn sandbox_init(profile: *const libc::c_char, flags: u64, errorbuf: *mut *mut libc::c_char) -> libc::c_int;
            }

            const SANDBOX_NAMED: u64 = 0x0001;
            const SANDBOX_NAMED_BUILTIN: u64 = 0x0002;

            let c_profile = CString::new(profile)
                .map_err(|_| SandboxError::ProfileGeneration("Invalid profile string".to_string()))?;

            let mut errorbuf: *mut libc::c_char = std::ptr::null_mut();

            // Use flag 0 for custom profile string (not a named builtin profile)
            let result = unsafe { sandbox_init(c_profile.as_ptr(), 0, &mut errorbuf) };

            if result != 0 {
                let msg = if !errorbuf.is_null() {
                    let err = unsafe { std::ffi::CStr::from_ptr(errorbuf) };
                    let s = err.to_string_lossy().to_string();
                    unsafe { libc::free(errorbuf as *mut libc::c_void) };
                    s
                } else {
                    "Unknown sandbox error".to_string()
                };
                return Err(SandboxError::ApplicationFailed(msg));
            }

            Ok(())
        }

        #[cfg(not(target_os = "macos"))]
        {
            let _ = profile;
            Err(SandboxError::Unsupported("macOS sandbox not available on this platform".to_string()))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::manifest::Capabilities;

    #[test]
    fn generate_minimal_profile() {
        let caps = Capabilities::default();
        let profile = MacOSSandbox::generate_profile(&caps, Tier::PluginHost, "/workspace").unwrap();
        assert!(profile.contains("(version 1)"));
        assert!(profile.contains("(deny default)"));
        // No network, no fs-write, no process-fork
        assert!(!profile.contains("network*"));
        assert!(!profile.contains("file-write* (subpath \"/workspace\")"));
        assert!(!profile.contains("process-fork"));
    }

    #[test]
    fn generate_network_profile() {
        let mut caps = Capabilities::default();
        caps.network = true;
        let profile = MacOSSandbox::generate_profile(&caps, Tier::IsolatedProcess, "/workspace").unwrap();
        assert!(profile.contains("(allow network*)"));
    }

    #[test]
    fn generate_fs_write_profile() {
        let mut caps = Capabilities::default();
        caps.filesystem_write = true;
        let profile = MacOSSandbox::generate_profile(&caps, Tier::IsolatedProcess, "/workspace").unwrap();
        assert!(profile.contains("file-write* (subpath \"/workspace\")"));
    }

    #[test]
    fn generate_fs_read_profile() {
        let mut caps = Capabilities::default();
        caps.filesystem_read = Some(vec!["**/*.ts".to_string()]);
        let profile = MacOSSandbox::generate_profile(&caps, Tier::PluginHost, "/home/user/project").unwrap();
        assert!(profile.contains("file-read* (subpath \"/home/user/project\")"));
    }

    #[test]
    fn generate_process_spawn_profile() {
        let mut caps = Capabilities::default();
        caps.process_spawn = Some(vec!["eslint".to_string()]);
        let profile = MacOSSandbox::generate_profile(&caps, Tier::IsolatedProcess, "/workspace").unwrap();
        assert!(profile.contains("process-fork"));
        assert!(profile.contains("process-exec"));
    }

    #[test]
    fn tier3_gets_tmp_access() {
        let caps = Capabilities::default();
        let profile = MacOSSandbox::generate_profile(&caps, Tier::IsolatedProcess, "/workspace").unwrap();
        assert!(profile.contains("/tmp"));
    }

    #[test]
    fn tier2_no_tmp_access() {
        let mut caps = Capabilities::default();
        caps.editor_read = true;
        let profile = MacOSSandbox::generate_profile(&caps, Tier::PluginHost, "/workspace").unwrap();
        assert!(!profile.contains("(subpath \"/tmp\")"));
    }
}
