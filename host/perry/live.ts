/**
 * Plugin host FFI declarations for Perry.
 * Import this module to trigger Perry's package.json FFI discovery.
 *
 * Two groups of functions:
 * 1. Plugin management (called by hone-ide to load/manage plugins)
 * 2. Host API (called by plugins to interact with the IDE)
 */

// --- Plugin management (called by hone-ide) ---
declare function hone_plugin_init(): number;
declare function hone_plugin_load(pathPtr: number): number;
declare function hone_plugin_unload(handle: number): number;
declare function hone_plugin_count(): number;
declare function hone_plugin_has_hook(hookNamePtr: number): number;
declare function hone_plugin_hook_count(): number;
declare function hone_plugin_dispatch_hook(hookNamePtr: number, eventDataPtr: number): number;
declare function hone_plugin_register_host_callback(callbackId: number, fnPtr: number): number;
declare function hone_plugin_scan_and_load(dirPtr: number): number;

// --- Host API (called by plugins back into the IDE) ---
declare function hone_host_api_log(level: number, msg: number): void;
declare function hone_host_api_notify(pluginName: number, message: number, severity: number): void;
declare function hone_host_api_command_register(pluginName: number, id: number, title: number): void;
declare function hone_host_api_command_unregister(id: number): void;
declare function hone_host_api_statusbar_create(pluginName: number, text: number, tooltip: number, alignment: number, priority: number, commandId: number): number;
declare function hone_host_api_statusbar_update(handle: number, text: number, tooltip: number): void;
declare function hone_host_api_statusbar_remove(handle: number): void;

// Re-export so Perry includes this module
export const PLUGINS_LIVE = 1;
