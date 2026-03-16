//! OS sandboxing — restrict plugin capabilities at the OS level.
//!
//! Each platform implements the `Sandbox` trait to generate and apply
//! security profiles based on the plugin's declared capabilities.

pub mod macos;
pub mod linux;
pub mod windows;

use crate::manifest::Capabilities;
use crate::tier::Tier;

/// Sandbox application error.
#[derive(Debug)]
pub enum SandboxError {
    /// The platform doesn't support sandboxing.
    Unsupported(String),
    /// Failed to generate the sandbox profile.
    ProfileGeneration(String),
    /// Failed to apply the sandbox.
    ApplicationFailed(String),
}

impl std::fmt::Display for SandboxError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SandboxError::Unsupported(msg) => write!(f, "Sandbox unsupported: {}", msg),
            SandboxError::ProfileGeneration(msg) => write!(f, "Profile generation failed: {}", msg),
            SandboxError::ApplicationFailed(msg) => write!(f, "Sandbox application failed: {}", msg),
        }
    }
}

/// Trait for platform-specific sandbox implementations.
pub trait Sandbox {
    /// Generate a sandbox profile string from the plugin's capabilities and tier.
    fn generate_profile(caps: &Capabilities, tier: Tier, workspace_path: &str) -> Result<String, SandboxError>;

    /// Apply the sandbox profile to the current process/thread.
    /// Must be called BEFORE dlopen of the plugin.
    fn apply(profile: &str) -> Result<(), SandboxError>;
}

/// Apply the appropriate sandbox for the current platform.
pub fn apply_sandbox(caps: &Capabilities, tier: Tier, workspace_path: &str) -> Result<(), SandboxError> {
    // Tier 1 (InProcess) doesn't need sandboxing — it's declarative data only
    if tier == Tier::InProcess {
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        let profile = macos::MacOSSandbox::generate_profile(caps, tier, workspace_path)?;
        return macos::MacOSSandbox::apply(&profile);
    }

    #[cfg(target_os = "linux")]
    {
        let profile = linux::LinuxSandbox::generate_profile(caps, tier, workspace_path)?;
        return linux::LinuxSandbox::apply(&profile);
    }

    #[cfg(target_os = "windows")]
    {
        let profile = windows::WindowsSandbox::generate_profile(caps, tier, workspace_path)?;
        return windows::WindowsSandbox::apply(&profile);
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        Err(SandboxError::Unsupported("Unknown platform".to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::manifest::Capabilities;

    #[test]
    fn tier1_skips_sandbox() {
        let caps = Capabilities::default();
        let result = apply_sandbox(&caps, Tier::InProcess, "/workspace");
        assert!(result.is_ok());
    }
}
