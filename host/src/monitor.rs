//! Runtime monitoring — CPU, memory, and crash tracking for plugins.
//!
//! Monitors plugin resource usage and enforces limits:
//! - CPU: warn >25% sustained 5s, kill >50% sustained 10s
//! - Memory: per-plugin budget (128MB Tier 2, 256MB Tier 3)
//! - Crashes: auto-restart on first, disable after 3 in 5 min

use crate::tier::Tier;
use std::collections::HashMap;
use std::time::{Duration, Instant};

/// Per-plugin health status.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HealthStatus {
    /// Plugin is running normally.
    Healthy,
    /// Plugin is using elevated resources (warn threshold).
    Warning,
    /// Plugin exceeded resource limits.
    Critical,
    /// Plugin has been killed due to resource abuse.
    Killed,
    /// Plugin has been disabled after repeated crashes.
    Disabled,
}

/// Resource limits for a plugin based on its tier.
#[derive(Debug, Clone)]
pub struct ResourceLimits {
    /// Maximum memory in bytes.
    pub memory_limit: u64,
    /// Memory warning threshold (fraction of limit, e.g. 0.75).
    pub memory_warn_ratio: f64,
    /// CPU warning threshold (fraction, e.g. 0.25 = 25%).
    pub cpu_warn_threshold: f64,
    /// CPU kill threshold (fraction, e.g. 0.50 = 50%).
    pub cpu_kill_threshold: f64,
    /// Sustained duration before CPU warning triggers (seconds).
    pub cpu_warn_duration: Duration,
    /// Sustained duration before CPU kill triggers (seconds).
    pub cpu_kill_duration: Duration,
    /// Max crashes before disabling.
    pub max_crashes: u32,
    /// Crash tracking window.
    pub crash_window: Duration,
}

impl ResourceLimits {
    /// Get resource limits for a given tier.
    pub fn for_tier(tier: Tier) -> Self {
        match tier {
            Tier::InProcess => Self {
                memory_limit: 64 * 1024 * 1024, // 64MB (themes are lightweight)
                memory_warn_ratio: 0.75,
                cpu_warn_threshold: 0.10,
                cpu_kill_threshold: 0.25,
                cpu_warn_duration: Duration::from_secs(5),
                cpu_kill_duration: Duration::from_secs(10),
                max_crashes: 3,
                crash_window: Duration::from_secs(300),
            },
            Tier::PluginHost => Self {
                memory_limit: 128 * 1024 * 1024, // 128MB
                memory_warn_ratio: 0.75,
                cpu_warn_threshold: 0.25,
                cpu_kill_threshold: 0.50,
                cpu_warn_duration: Duration::from_secs(5),
                cpu_kill_duration: Duration::from_secs(10),
                max_crashes: 3,
                crash_window: Duration::from_secs(300),
            },
            Tier::IsolatedProcess => Self {
                memory_limit: 256 * 1024 * 1024, // 256MB
                memory_warn_ratio: 0.75,
                cpu_warn_threshold: 0.25,
                cpu_kill_threshold: 0.50,
                cpu_warn_duration: Duration::from_secs(5),
                cpu_kill_duration: Duration::from_secs(10),
                max_crashes: 3,
                crash_window: Duration::from_secs(300),
            },
        }
    }
}

/// Per-plugin monitoring state.
#[derive(Debug)]
pub struct PluginMonitorState {
    pub name: String,
    pub limits: ResourceLimits,
    pub status: HealthStatus,
    /// Timestamps of recent crashes.
    pub crash_times: Vec<Instant>,
    /// When high CPU was first detected (for sustained threshold).
    pub cpu_warn_start: Option<Instant>,
    pub cpu_kill_start: Option<Instant>,
    /// Last sampled CPU usage (0.0-1.0).
    pub last_cpu: f64,
    /// Last sampled memory usage in bytes.
    pub last_memory: u64,
}

impl PluginMonitorState {
    pub fn new(name: &str, tier: Tier) -> Self {
        Self {
            name: name.to_string(),
            limits: ResourceLimits::for_tier(tier),
            status: HealthStatus::Healthy,
            crash_times: Vec::new(),
            cpu_warn_start: None,
            cpu_kill_start: None,
            last_cpu: 0.0,
            last_memory: 0,
        }
    }

    /// Record a crash and check if the plugin should be disabled.
    pub fn record_crash(&mut self) -> HealthStatus {
        let now = Instant::now();
        self.crash_times.push(now);

        // Remove crashes outside the window
        let cutoff = now - self.limits.crash_window;
        self.crash_times.retain(|t| *t >= cutoff);

        if self.crash_times.len() as u32 >= self.limits.max_crashes {
            self.status = HealthStatus::Disabled;
        }

        self.status.clone()
    }

    /// Update CPU sample and check thresholds.
    pub fn update_cpu(&mut self, cpu_usage: f64) -> HealthStatus {
        self.last_cpu = cpu_usage;
        let now = Instant::now();

        // Check kill threshold
        if cpu_usage > self.limits.cpu_kill_threshold {
            match self.cpu_kill_start {
                Some(start) if now.duration_since(start) >= self.limits.cpu_kill_duration => {
                    self.status = HealthStatus::Killed;
                    return self.status.clone();
                }
                None => {
                    self.cpu_kill_start = Some(now);
                }
                _ => {}
            }
        } else {
            self.cpu_kill_start = None;
        }

        // Check warn threshold
        if cpu_usage > self.limits.cpu_warn_threshold {
            match self.cpu_warn_start {
                Some(start) if now.duration_since(start) >= self.limits.cpu_warn_duration => {
                    self.status = HealthStatus::Warning;
                    return self.status.clone();
                }
                None => {
                    self.cpu_warn_start = Some(now);
                }
                _ => {}
            }
        } else {
            self.cpu_warn_start = None;
            if self.status == HealthStatus::Warning {
                self.status = HealthStatus::Healthy;
            }
        }

        self.status.clone()
    }

    /// Update memory sample and check threshold.
    pub fn update_memory(&mut self, memory_bytes: u64) -> HealthStatus {
        self.last_memory = memory_bytes;

        if memory_bytes >= self.limits.memory_limit {
            self.status = HealthStatus::Killed;
        } else if memory_bytes as f64 >= self.limits.memory_limit as f64 * self.limits.memory_warn_ratio {
            if self.status == HealthStatus::Healthy {
                self.status = HealthStatus::Warning;
            }
        } else if self.status == HealthStatus::Warning {
            self.status = HealthStatus::Healthy;
        }

        self.status.clone()
    }
}

/// Global plugin monitor tracking all plugins.
pub struct PluginMonitor {
    plugins: HashMap<String, PluginMonitorState>,
}

impl PluginMonitor {
    pub fn new() -> Self {
        Self {
            plugins: HashMap::new(),
        }
    }

    /// Start monitoring a plugin.
    pub fn register(&mut self, name: &str, tier: Tier) {
        self.plugins.insert(name.to_string(), PluginMonitorState::new(name, tier));
    }

    /// Stop monitoring a plugin.
    pub fn unregister(&mut self, name: &str) {
        self.plugins.remove(name);
    }

    /// Record a crash for a plugin.
    pub fn record_crash(&mut self, name: &str) -> Option<HealthStatus> {
        self.plugins.get_mut(name).map(|s| s.record_crash())
    }

    /// Update CPU usage for a plugin.
    pub fn update_cpu(&mut self, name: &str, cpu_usage: f64) -> Option<HealthStatus> {
        self.plugins.get_mut(name).map(|s| s.update_cpu(cpu_usage))
    }

    /// Update memory usage for a plugin.
    pub fn update_memory(&mut self, name: &str, memory_bytes: u64) -> Option<HealthStatus> {
        self.plugins.get_mut(name).map(|s| s.update_memory(memory_bytes))
    }

    /// Get the health status of a plugin.
    pub fn status(&self, name: &str) -> Option<&HealthStatus> {
        self.plugins.get(name).map(|s| &s.status)
    }

    /// Get all plugins that need attention (non-Healthy).
    pub fn unhealthy(&self) -> Vec<(&str, &HealthStatus)> {
        let mut result = Vec::new();
        for (name, state) in &self.plugins {
            if state.status != HealthStatus::Healthy {
                result.push((name.as_str(), &state.status));
            }
        }
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tier2_memory_limit() {
        let limits = ResourceLimits::for_tier(Tier::PluginHost);
        assert_eq!(limits.memory_limit, 128 * 1024 * 1024);
    }

    #[test]
    fn tier3_memory_limit() {
        let limits = ResourceLimits::for_tier(Tier::IsolatedProcess);
        assert_eq!(limits.memory_limit, 256 * 1024 * 1024);
    }

    #[test]
    fn crash_tracking() {
        let mut state = PluginMonitorState::new("test", Tier::PluginHost);
        assert_eq!(state.record_crash(), HealthStatus::Healthy);
        assert_eq!(state.record_crash(), HealthStatus::Healthy);
        assert_eq!(state.record_crash(), HealthStatus::Disabled); // 3rd crash
    }

    #[test]
    fn memory_warning() {
        let mut state = PluginMonitorState::new("test", Tier::PluginHost);
        // 75% of 128MB = 96MB
        let status = state.update_memory(100 * 1024 * 1024); // 100MB > 96MB
        assert_eq!(status, HealthStatus::Warning);
    }

    #[test]
    fn memory_kill() {
        let mut state = PluginMonitorState::new("test", Tier::PluginHost);
        let status = state.update_memory(128 * 1024 * 1024); // Exactly at limit
        assert_eq!(status, HealthStatus::Killed);
    }

    #[test]
    fn memory_healthy() {
        let mut state = PluginMonitorState::new("test", Tier::PluginHost);
        let status = state.update_memory(50 * 1024 * 1024); // 50MB, well under
        assert_eq!(status, HealthStatus::Healthy);
    }

    #[test]
    fn cpu_below_threshold_stays_healthy() {
        let mut state = PluginMonitorState::new("test", Tier::PluginHost);
        let status = state.update_cpu(0.10); // 10%, below 25% warn
        assert_eq!(status, HealthStatus::Healthy);
    }

    #[test]
    fn monitor_register_unregister() {
        let mut monitor = PluginMonitor::new();
        monitor.register("plugin-a", Tier::PluginHost);
        assert!(monitor.status("plugin-a").is_some());
        monitor.unregister("plugin-a");
        assert!(monitor.status("plugin-a").is_none());
    }

    #[test]
    fn monitor_unhealthy() {
        let mut monitor = PluginMonitor::new();
        monitor.register("good", Tier::PluginHost);
        monitor.register("bad", Tier::PluginHost);
        monitor.update_memory("bad", 200 * 1024 * 1024); // Over limit
        let unhealthy = monitor.unhealthy();
        assert_eq!(unhealthy.len(), 1);
        assert_eq!(unhealthy[0].0, "bad");
    }
}
