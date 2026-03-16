//! hone-plugin-host — loads, manages, and dispatches hooks to native Hone plugins.
//!
//! This crate provides:
//! - Plugin manifest parsing and validation (plugin.hone.json)
//! - Tier derivation from declared capabilities
//! - HoneHostAPI C ABI struct construction
//! - Plugin loading via dlopen/dlsym
//! - Hook registry and dispatch
//! - Persistent plugin registry (~/.hone/plugins/registry.json)
//! - OS sandboxing (macOS sandbox-exec, Linux seccomp-BPF, Windows Job Objects)
//! - Runtime monitoring (CPU, memory, crash tracking)
//! - Signature verification (SHA-256 tamper detection, Ed25519 ready)
//! - FFI functions for Perry-compiled TypeScript

pub mod manifest;
pub mod tier;
pub mod host_api;
pub mod loader;
pub mod hooks;
pub mod registry;
pub mod sandbox;
pub mod monitor;
pub mod signature;
pub mod ffi;
pub mod host_ffi;

// Re-exports for convenience
pub use manifest::{parse_manifest, parse_manifest_file, PluginManifest, Capabilities};
pub use tier::{derive_tier, Tier};
pub use host_api::{build_host_api, HoneHostAPI};
pub use hooks::HookRegistry;
pub use registry::{PluginRegistry, TrustLevel};
pub use sandbox::apply_sandbox;
pub use monitor::{PluginMonitor, HealthStatus, ResourceLimits};
pub use signature::{PluginSignature, sha256_hex, verify_signature, detect_tampering};
