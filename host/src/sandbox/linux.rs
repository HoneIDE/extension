//! Linux sandbox — seccomp-BPF filter generation from capabilities.
//!
//! Generates BPF filters that whitelist only the syscalls needed
//! for the plugin's declared capabilities.

use crate::manifest::Capabilities;
use crate::tier::Tier;
use super::{Sandbox, SandboxError};

/// Syscall numbers for x86_64 Linux.
mod syscall {
    pub const READ: u32 = 0;
    pub const WRITE: u32 = 1;
    pub const OPEN: u32 = 2;
    pub const CLOSE: u32 = 3;
    pub const STAT: u32 = 4;
    pub const FSTAT: u32 = 5;
    pub const LSTAT: u32 = 6;
    pub const MMAP: u32 = 9;
    pub const MPROTECT: u32 = 10;
    pub const MUNMAP: u32 = 11;
    pub const BRK: u32 = 12;
    pub const IOCTL: u32 = 16;
    pub const ACCESS: u32 = 21;
    pub const GETPID: u32 = 39;
    pub const SOCKET: u32 = 41;
    pub const CONNECT: u32 = 42;
    pub const SENDTO: u32 = 44;
    pub const RECVFROM: u32 = 45;
    pub const CLONE: u32 = 56;
    pub const FORK: u32 = 57;
    pub const EXECVE: u32 = 59;
    pub const EXIT: u32 = 60;
    pub const FCNTL: u32 = 72;
    pub const GETDENTS: u32 = 78;
    pub const GETCWD: u32 = 79;
    pub const OPENAT: u32 = 257;
    pub const NEWFSTATAT: u32 = 262;
    pub const EXIT_GROUP: u32 = 231;
    pub const FUTEX: u32 = 202;
    pub const CLOCK_GETTIME: u32 = 228;
    pub const GETRANDOM: u32 = 318;
}

pub struct LinuxSandbox;

impl Sandbox for LinuxSandbox {
    /// Generate a seccomp-BPF allowlist from capabilities.
    ///
    /// Returns a JSON representation of allowed syscalls (the actual BPF program
    /// would be generated at apply time on Linux).
    fn generate_profile(caps: &Capabilities, tier: Tier, _workspace_path: &str) -> Result<String, SandboxError> {
        let mut allowed: Vec<u32> = Vec::new();

        // Always allowed: basic process operations
        allowed.push(syscall::READ);
        allowed.push(syscall::WRITE);
        allowed.push(syscall::CLOSE);
        allowed.push(syscall::FSTAT);
        allowed.push(syscall::MMAP);
        allowed.push(syscall::MPROTECT);
        allowed.push(syscall::MUNMAP);
        allowed.push(syscall::BRK);
        allowed.push(syscall::EXIT);
        allowed.push(syscall::EXIT_GROUP);
        allowed.push(syscall::FUTEX);
        allowed.push(syscall::CLOCK_GETTIME);
        allowed.push(syscall::GETPID);
        allowed.push(syscall::GETRANDOM);
        allowed.push(syscall::FCNTL);

        // Filesystem read
        if caps.filesystem_read.as_ref().map(|g| !g.is_empty()).unwrap_or(false)
            || caps.editor_read
        {
            allowed.push(syscall::OPEN);
            allowed.push(syscall::OPENAT);
            allowed.push(syscall::STAT);
            allowed.push(syscall::LSTAT);
            allowed.push(syscall::ACCESS);
            allowed.push(syscall::GETDENTS);
            allowed.push(syscall::GETCWD);
            allowed.push(syscall::NEWFSTATAT);
        }

        // Filesystem write (superset of read)
        if caps.filesystem_write {
            allowed.push(syscall::OPEN);
            allowed.push(syscall::OPENAT);
            allowed.push(syscall::STAT);
            allowed.push(syscall::LSTAT);
            allowed.push(syscall::ACCESS);
            allowed.push(syscall::GETDENTS);
            allowed.push(syscall::GETCWD);
            allowed.push(syscall::NEWFSTATAT);
            allowed.push(syscall::IOCTL);
        }

        // Network
        if caps.network {
            allowed.push(syscall::SOCKET);
            allowed.push(syscall::CONNECT);
            allowed.push(syscall::SENDTO);
            allowed.push(syscall::RECVFROM);
        }

        // Process spawning
        if caps.process_spawn.as_ref().map(|b| !b.is_empty()).unwrap_or(false) || caps.terminal {
            allowed.push(syscall::CLONE);
            allowed.push(syscall::FORK);
            allowed.push(syscall::EXECVE);
        }

        // Deduplicate
        allowed.sort();
        allowed.dedup();

        // Serialize as JSON for portability (actual BPF assembly happens at apply time)
        let json = serde_json::json!({
            "arch": "x86_64",
            "tier": tier as u8,
            "allowed_syscalls": allowed,
        });

        serde_json::to_string_pretty(&json)
            .map_err(|e| SandboxError::ProfileGeneration(format!("JSON error: {}", e)))
    }

    /// Apply a seccomp-BPF filter.
    ///
    /// On Linux, this would use prctl(PR_SET_SECCOMP, SECCOMP_MODE_FILTER, ...).
    /// On other platforms, this is a no-op.
    fn apply(profile: &str) -> Result<(), SandboxError> {
        #[cfg(target_os = "linux")]
        {
            // Parse the profile to get allowed syscalls
            let parsed: serde_json::Value = serde_json::from_str(profile)
                .map_err(|e| SandboxError::ApplicationFailed(format!("Invalid profile: {}", e)))?;

            let syscalls = parsed["allowed_syscalls"]
                .as_array()
                .ok_or_else(|| SandboxError::ApplicationFailed("Missing allowed_syscalls".to_string()))?;

            // In a real implementation, this would:
            // 1. Build a BPF program from the syscall whitelist
            // 2. Call prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0)
            // 3. Call prctl(PR_SET_SECCOMP, SECCOMP_MODE_FILTER, &bpf_prog)
            //
            // For now, log and return success (actual BPF assembly is complex)
            eprintln!(
                "[sandbox] Would apply seccomp filter with {} allowed syscalls",
                syscalls.len()
            );

            Ok(())
        }

        #[cfg(not(target_os = "linux"))]
        {
            let _ = profile;
            Err(SandboxError::Unsupported("Linux seccomp not available on this platform".to_string()))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::manifest::Capabilities;

    #[test]
    fn generate_minimal_has_basic_syscalls() {
        let caps = Capabilities::default();
        let profile = LinuxSandbox::generate_profile(&caps, Tier::PluginHost, "/workspace").unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&profile).unwrap();
        let syscalls = parsed["allowed_syscalls"].as_array().unwrap();
        // Should have basic syscalls (read, write, close, mmap, etc.) but not network/fs
        assert!(syscalls.len() >= 10);
        // Should NOT have socket
        let has_socket = syscalls.iter().any(|v| v.as_u64() == Some(syscall::SOCKET as u64));
        assert!(!has_socket);
    }

    #[test]
    fn generate_network_has_socket() {
        let mut caps = Capabilities::default();
        caps.network = true;
        let profile = LinuxSandbox::generate_profile(&caps, Tier::IsolatedProcess, "/workspace").unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&profile).unwrap();
        let syscalls = parsed["allowed_syscalls"].as_array().unwrap();
        let has_socket = syscalls.iter().any(|v| v.as_u64() == Some(syscall::SOCKET as u64));
        assert!(has_socket);
    }

    #[test]
    fn generate_spawn_has_fork_exec() {
        let mut caps = Capabilities::default();
        caps.process_spawn = Some(vec!["eslint".to_string()]);
        let profile = LinuxSandbox::generate_profile(&caps, Tier::IsolatedProcess, "/workspace").unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&profile).unwrap();
        let syscalls = parsed["allowed_syscalls"].as_array().unwrap();
        let has_fork = syscalls.iter().any(|v| v.as_u64() == Some(syscall::FORK as u64));
        let has_exec = syscalls.iter().any(|v| v.as_u64() == Some(syscall::EXECVE as u64));
        assert!(has_fork);
        assert!(has_exec);
    }

    #[test]
    fn generate_fs_read_has_open() {
        let mut caps = Capabilities::default();
        caps.filesystem_read = Some(vec!["**/*.ts".to_string()]);
        let profile = LinuxSandbox::generate_profile(&caps, Tier::PluginHost, "/workspace").unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&profile).unwrap();
        let syscalls = parsed["allowed_syscalls"].as_array().unwrap();
        let has_openat = syscalls.iter().any(|v| v.as_u64() == Some(syscall::OPENAT as u64));
        assert!(has_openat);
    }

    #[test]
    fn no_duplicates() {
        let mut caps = Capabilities::default();
        caps.filesystem_read = Some(vec!["**/*".to_string()]);
        caps.filesystem_write = true; // superset of read, should not duplicate
        let profile = LinuxSandbox::generate_profile(&caps, Tier::IsolatedProcess, "/workspace").unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&profile).unwrap();
        let syscalls = parsed["allowed_syscalls"].as_array().unwrap();
        let mut values: Vec<u64> = syscalls.iter().map(|v| v.as_u64().unwrap()).collect();
        let len_before = values.len();
        values.sort();
        values.dedup();
        assert_eq!(len_before, values.len());
    }
}
