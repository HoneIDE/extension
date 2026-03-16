/**
 * Plugin manifest types (plugin.hone.json).
 */

import type { ConfigSchema } from './config';

export interface PluginCapabilities {
  'editor.read'?: boolean;
  'editor.write'?: boolean;
  'editor.decorations'?: boolean;
  'filesystem.read'?: string[];
  'filesystem.write'?: boolean;
  'network'?: boolean;
  'process.spawn'?: string[];
  'terminal'?: boolean;
  'ui.panel'?: boolean;
  'ui.statusbar'?: boolean;
  'ui.gutter'?: boolean;
  'ui.commandPalette'?: boolean;
  'ui.contextMenu'?: boolean;
  'ui.notifications'?: boolean;
  'ui.webview'?: boolean;
}

export type HookName =
  | 'onDocumentFormat'
  | 'onDocumentSave'
  | 'onDocumentOpen'
  | 'onSelectionChange'
  | 'onCodeAction'
  | 'onHover'
  | string; // onCommand:* patterns

export interface PluginManifest {
  name: string;
  displayName: string;
  version: string;
  author: string;
  license: string;
  description: string;
  entry: string;
  capabilities: PluginCapabilities;
  hooks: HookName[];
  configSchema?: ConfigSchema;
  hone: string;
  repository?: string;
  icon?: string;
  perryVersion?: string;
}

/** Plugin execution tier derived from capabilities. */
export type PluginTier = 1 | 2 | 3;

/**
 * Derive the plugin tier from its declared capabilities.
 *
 * Tier 1 (InProcess): UI-only, declarative data (themes, keymaps).
 * Tier 2 (PluginHost): editor/fs-read/ui, shared process.
 * Tier 3 (IsolatedProcess): network/fs-write/process.spawn/terminal/webview.
 */
export function deriveTier(caps: PluginCapabilities): PluginTier {
  // Tier 3: any "dangerous" capability
  if (caps.network === true) return 3;
  if (caps['filesystem.write'] === true) return 3;
  if (caps.terminal === true) return 3;
  if (caps['ui.webview'] === true) return 3;
  const spawn = caps['process.spawn'];
  if (spawn !== undefined && spawn.length > 0) return 3;

  // Tier 2: any editor/fs-read/ui capability
  if (caps['editor.read'] === true) return 2;
  if (caps['editor.write'] === true) return 2;
  if (caps['editor.decorations'] === true) return 2;
  const fsRead = caps['filesystem.read'];
  if (fsRead !== undefined && fsRead.length > 0) return 2;
  if (caps['ui.panel'] === true) return 2;
  if (caps['ui.statusbar'] === true) return 2;
  if (caps['ui.gutter'] === true) return 2;
  if (caps['ui.commandPalette'] === true) return 2;
  if (caps['ui.contextMenu'] === true) return 2;
  if (caps['ui.notifications'] === true) return 2;

  // Tier 1: UI-only (themes, keymaps, declarative data)
  return 1;
}

/** Validation error for a plugin manifest. */
export interface ManifestError {
  field: string;
  message: string;
}

/**
 * Validate a plugin manifest object.
 * Returns an array of errors (empty if valid).
 */
export function validateManifest(data: Record<string, unknown>): ManifestError[] {
  const errors: ManifestError[] = [];

  if (typeof data.name !== 'string' || data.name.length === 0) {
    errors.push({ field: 'name', message: 'name is required and must be a non-empty string' });
  }
  if (typeof data.displayName !== 'string' || data.displayName.length === 0) {
    errors.push({ field: 'displayName', message: 'displayName is required and must be a non-empty string' });
  }
  if (typeof data.version !== 'string' || data.version.length === 0) {
    errors.push({ field: 'version', message: 'version is required and must be a non-empty string' });
  }
  if (typeof data.author !== 'string' || data.author.length === 0) {
    errors.push({ field: 'author', message: 'author is required and must be a non-empty string' });
  }
  if (typeof data.license !== 'string' || data.license.length === 0) {
    errors.push({ field: 'license', message: 'license is required and must be a non-empty string' });
  }
  if (typeof data.description !== 'string') {
    errors.push({ field: 'description', message: 'description is required and must be a string' });
  }
  if (typeof data.entry !== 'string' || data.entry.length === 0) {
    errors.push({ field: 'entry', message: 'entry is required and must be a non-empty string' });
  }

  // Capabilities validation
  if (data.capabilities === undefined || data.capabilities === null || typeof data.capabilities !== 'object') {
    errors.push({ field: 'capabilities', message: 'capabilities is required and must be an object' });
  } else {
    const caps = data.capabilities as Record<string, unknown>;
    const fsRead = caps['filesystem.read'];
    if (fsRead !== undefined && !Array.isArray(fsRead)) {
      errors.push({ field: 'capabilities.filesystem.read', message: 'filesystem.read must be an array of glob strings' });
    }
    const spawn = caps['process.spawn'];
    if (spawn !== undefined && !Array.isArray(spawn)) {
      errors.push({ field: 'capabilities.process.spawn', message: 'process.spawn must be an array of binary names' });
    }
  }

  // Hooks validation
  if (!Array.isArray(data.hooks)) {
    errors.push({ field: 'hooks', message: 'hooks is required and must be an array' });
  }

  // Engine version
  if (typeof data.hone !== 'string' || data.hone.length === 0) {
    errors.push({ field: 'hone', message: 'hone engine version is required' });
  }

  return errors;
}

/**
 * Parse a plugin manifest from a JSON string.
 */
export function parsePluginManifest(json: string): { manifest: PluginManifest | null; errors: ManifestError[] } {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(json);
  } catch {
    return { manifest: null, errors: [{ field: 'root', message: 'Invalid JSON' }] };
  }

  const errors = validateManifest(data);
  if (errors.length > 0) {
    return { manifest: null, errors: errors };
  }

  const caps = data.capabilities as Record<string, unknown>;
  const manifest: PluginManifest = {
    name: data.name as string,
    displayName: data.displayName as string,
    version: data.version as string,
    author: data.author as string,
    license: data.license as string,
    description: data.description as string,
    entry: data.entry as string,
    capabilities: {
      'editor.read': caps['editor.read'] === true,
      'editor.write': caps['editor.write'] === true,
      'editor.decorations': caps['editor.decorations'] === true,
      'filesystem.read': Array.isArray(caps['filesystem.read']) ? caps['filesystem.read'] as string[] : undefined,
      'filesystem.write': caps['filesystem.write'] === true,
      'network': caps['network'] === true,
      'process.spawn': Array.isArray(caps['process.spawn']) ? caps['process.spawn'] as string[] : undefined,
      'terminal': caps['terminal'] === true,
      'ui.panel': caps['ui.panel'] === true,
      'ui.statusbar': caps['ui.statusbar'] === true,
      'ui.gutter': caps['ui.gutter'] === true,
      'ui.commandPalette': caps['ui.commandPalette'] === true,
      'ui.contextMenu': caps['ui.contextMenu'] === true,
      'ui.notifications': caps['ui.notifications'] === true,
      'ui.webview': caps['ui.webview'] === true,
    },
    hooks: data.hooks as string[],
    configSchema: data.configSchema as ConfigSchema | undefined,
    hone: data.hone as string,
    repository: data.repository as string | undefined,
    icon: data.icon as string | undefined,
    perryVersion: data.perryVersion as string | undefined,
  };

  return { manifest: manifest, errors: [] };
}
