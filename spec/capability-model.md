# Capability Model

## Tier Derivation

Plugins are assigned an execution tier based on their declared capabilities:

| Tier | Name | Description | Execution |
|------|------|-------------|-----------|
| 1 | InProcess | UI-only (themes, keymaps, color schemes) | Loaded in main process |
| 2 | PluginHost | editor/fs-read/ui capabilities | Shared plugin host process |
| 3 | IsolatedProcess | network/fs-write/process.spawn/terminal/webview | Own sandboxed process |

### Tier 3 Triggers
Any of these capabilities forces Tier 3:
- `network: true`
- `filesystem.write: true`
- `process.spawn: [...]` (non-empty)
- `terminal: true`
- `ui.webview: true`

### Tier 2 Triggers
Any of these capabilities (without Tier 3 triggers) forces Tier 2:
- `editor.read`, `editor.write`, `editor.decorations`
- `filesystem.read: [...]` (non-empty)
- Any `ui.*` capability

### Tier 1
No code capabilities — purely declarative data (theme JSON, keymap JSON).

## Enforcement Layers

1. **Compile-time (Perry):** Only API functions matching declared capabilities are linked into the plugin binary. Undeclared imports cause compile errors.

2. **Runtime (OS Sandbox):** OS-level restrictions applied before plugin loads:
   - macOS: `sandbox-exec` profiles
   - Linux: `seccomp-bpf` filters
   - Windows: Job Objects + AppContainer

3. **Host API (Null pointers):** In the C ABI `HoneHostAPI` struct, function pointers for undeclared capabilities are null.

## Capability Descriptions

| Capability | Type | Description |
|-----------|------|-------------|
| `editor.read` | boolean | Read buffer text, selections, language, line count |
| `editor.write` | boolean | Submit edits (goes through Changes Queue) |
| `editor.decorations` | boolean | Underlines, highlights, gutter icons |
| `filesystem.read` | string[] | Read files matching glob patterns |
| `filesystem.write` | boolean | Write/delete files and directories |
| `network` | boolean | HTTP requests |
| `process.spawn` | string[] | Spawn allowlisted external binaries |
| `terminal` | boolean | Interactive terminal access |
| `ui.panel` | boolean | Side panel creation |
| `ui.statusbar` | boolean | Status bar items |
| `ui.gutter` | boolean | Gutter icons |
| `ui.commandPalette` | boolean | Command palette registration |
| `ui.contextMenu` | boolean | Context menu items |
| `ui.notifications` | boolean | Toast notifications |
| `ui.webview` | boolean | Embedded webviews (Tier 3 only) |
