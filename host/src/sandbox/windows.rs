//! Windows sandbox — Job Objects + AppContainer.
//!
//! Stub implementation. Real implementation would use:
//! - CreateJobObject + SetInformationJobObject for resource limits
//! - CreateAppContainerProfile for capability-based isolation

use crate::manifest::Capabilities;
use crate::tier::Tier;
use super::{Sandbox, SandboxError};

pub struct WindowsSandbox;

impl Sandbox for WindowsSandbox {
    /// Generate a Windows sandbox profile.
    ///
    /// Returns a JSON description of Job Object settings and AppContainer capabilities.
    fn generate_profile(caps: &Capabilities, tier: Tier, workspace_path: &str) -> Result<String, SandboxError> {
        let json = serde_json::json!({
            "tier": tier as u8,
            "job_object": {
                "limit_process_memory": match tier {
                    Tier::InProcess => 0,
                    Tier::PluginHost => 128 * 1024 * 1024,   // 128MB
                    Tier::IsolatedProcess => 256 * 1024 * 1024, // 256MB
                },
                "limit_active_processes": if caps.process_spawn.as_ref().map(|b| !b.is_empty()).unwrap_or(false) { 10 } else { 1 },
            },
            "app_container": {
                "network": caps.network,
                "filesystem_read": workspace_path,
                "filesystem_write": caps.filesystem_write,
                "process_spawn": caps.process_spawn.as_ref().map(|b| !b.is_empty()).unwrap_or(false),
            },
        });

        serde_json::to_string_pretty(&json)
            .map_err(|e| SandboxError::ProfileGeneration(format!("JSON error: {}", e)))
    }

    /// Apply Windows sandbox.
    fn apply(profile: &str) -> Result<(), SandboxError> {
        #[cfg(target_os = "windows")]
        {
            // In a real implementation:
            // 1. CreateJobObject()
            // 2. SetInformationJobObject(JOB_OBJECT_LIMIT_PROCESS_MEMORY, ...)
            // 3. AssignProcessToJobObject(job, GetCurrentProcess())
            // 4. CreateAppContainerProfile(name, ...)
            eprintln!("[sandbox] Would apply Windows Job Object + AppContainer");
            Ok(())
        }

        #[cfg(not(target_os = "windows"))]
        {
            let _ = profile;
            Err(SandboxError::Unsupported("Windows sandbox not available on this platform".to_string()))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::manifest::Capabilities;

    #[test]
    fn generate_profile_has_memory_limit() {
        let caps = Capabilities::default();
        let profile = WindowsSandbox::generate_profile(&caps, Tier::PluginHost, "C:\\workspace").unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&profile).unwrap();
        let mem = parsed["job_object"]["limit_process_memory"].as_u64().unwrap();
        assert_eq!(mem, 128 * 1024 * 1024);
    }

    #[test]
    fn tier3_gets_more_memory() {
        let caps = Capabilities::default();
        let profile = WindowsSandbox::generate_profile(&caps, Tier::IsolatedProcess, "C:\\workspace").unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&profile).unwrap();
        let mem = parsed["job_object"]["limit_process_memory"].as_u64().unwrap();
        assert_eq!(mem, 256 * 1024 * 1024);
    }

    #[test]
    fn network_cap_reflected() {
        let mut caps = Capabilities::default();
        caps.network = true;
        let profile = WindowsSandbox::generate_profile(&caps, Tier::IsolatedProcess, "C:\\workspace").unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&profile).unwrap();
        assert_eq!(parsed["app_container"]["network"], true);
    }
}
