import { describe, test, expect } from 'bun:test';
import {
  insertEdit, replaceEdit, deleteEdit, pos, range,
} from '../src/types/editor';
import {
  deriveTier, validateManifest, parsePluginManifest,
} from '../src/types/manifest';
import type { PluginCapabilities } from '../src/types/manifest';

describe('Editor type helpers', () => {
  test('pos creates a Position', () => {
    const p = pos(5, 10);
    expect(p.line).toBe(5);
    expect(p.column).toBe(10);
  });

  test('range creates a Range', () => {
    const r = range(1, 0, 3, 5);
    expect(r.start.line).toBe(1);
    expect(r.start.column).toBe(0);
    expect(r.end.line).toBe(3);
    expect(r.end.column).toBe(5);
  });

  test('insertEdit creates an insertion', () => {
    const edit = insertEdit(pos(0, 0), 'hello');
    expect(edit.range.start.line).toBe(0);
    expect(edit.range.start.column).toBe(0);
    expect(edit.range.end.line).toBe(0);
    expect(edit.range.end.column).toBe(0);
    expect(edit.newText).toBe('hello');
  });

  test('replaceEdit creates a replacement', () => {
    const edit = replaceEdit(range(1, 0, 1, 5), 'world');
    expect(edit.range.start.line).toBe(1);
    expect(edit.range.end.column).toBe(5);
    expect(edit.newText).toBe('world');
  });

  test('deleteEdit creates a deletion', () => {
    const edit = deleteEdit(range(2, 0, 2, 10));
    expect(edit.newText).toBe('');
  });
});

describe('Tier derivation', () => {
  test('empty capabilities = Tier 1', () => {
    const caps: PluginCapabilities = {};
    expect(deriveTier(caps)).toBe(1);
  });

  test('editor.read only = Tier 2', () => {
    const caps: PluginCapabilities = { 'editor.read': true };
    expect(deriveTier(caps)).toBe(2);
  });

  test('ui.statusbar only = Tier 2', () => {
    const caps: PluginCapabilities = { 'ui.statusbar': true };
    expect(deriveTier(caps)).toBe(2);
  });

  test('ui.commandPalette + ui.notifications = Tier 2', () => {
    const caps: PluginCapabilities = {
      'ui.commandPalette': true,
      'ui.notifications': true,
    };
    expect(deriveTier(caps)).toBe(2);
  });

  test('filesystem.read = Tier 2', () => {
    const caps: PluginCapabilities = { 'filesystem.read': ['**/*.ts'] };
    expect(deriveTier(caps)).toBe(2);
  });

  test('empty filesystem.read = Tier 1', () => {
    const caps: PluginCapabilities = { 'filesystem.read': [] };
    expect(deriveTier(caps)).toBe(1);
  });

  test('network = Tier 3', () => {
    const caps: PluginCapabilities = { network: true };
    expect(deriveTier(caps)).toBe(3);
  });

  test('filesystem.write = Tier 3', () => {
    const caps: PluginCapabilities = { 'filesystem.write': true };
    expect(deriveTier(caps)).toBe(3);
  });

  test('process.spawn = Tier 3', () => {
    const caps: PluginCapabilities = { 'process.spawn': ['node'] };
    expect(deriveTier(caps)).toBe(3);
  });

  test('empty process.spawn = Tier 1', () => {
    const caps: PluginCapabilities = { 'process.spawn': [] };
    expect(deriveTier(caps)).toBe(1);
  });

  test('terminal = Tier 3', () => {
    const caps: PluginCapabilities = { terminal: true };
    expect(deriveTier(caps)).toBe(3);
  });

  test('ui.webview = Tier 3', () => {
    const caps: PluginCapabilities = { 'ui.webview': true };
    expect(deriveTier(caps)).toBe(3);
  });

  test('mixed Tier 2 + Tier 3 = Tier 3', () => {
    const caps: PluginCapabilities = {
      'editor.read': true,
      'ui.statusbar': true,
      network: true,
    };
    expect(deriveTier(caps)).toBe(3);
  });
});

describe('Manifest validation', () => {
  const validData: Record<string, unknown> = {
    name: 'test-plugin',
    displayName: 'Test Plugin',
    version: '1.0.0',
    author: 'Test Author',
    license: 'MIT',
    description: 'A test plugin',
    entry: 'TestPlugin',
    capabilities: {},
    hooks: [],
    hone: '>=0.1.0',
  };

  test('valid manifest passes', () => {
    const errors = validateManifest(validData);
    expect(errors.length).toBe(0);
  });

  test('missing name fails', () => {
    const data = { ...validData };
    delete data.name;
    const errors = validateManifest(data);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].field).toBe('name');
  });

  test('empty name fails', () => {
    const data = { ...validData, name: '' };
    const errors = validateManifest(data);
    expect(errors.length).toBeGreaterThan(0);
  });

  test('missing version fails', () => {
    const data = { ...validData };
    delete data.version;
    const errors = validateManifest(data);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].field).toBe('version');
  });

  test('missing entry fails', () => {
    const data = { ...validData };
    delete data.entry;
    const errors = validateManifest(data);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].field).toBe('entry');
  });

  test('missing capabilities fails', () => {
    const data = { ...validData };
    delete data.capabilities;
    const errors = validateManifest(data);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].field).toBe('capabilities');
  });

  test('missing hooks fails', () => {
    const data = { ...validData };
    delete data.hooks;
    const errors = validateManifest(data);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].field).toBe('hooks');
  });

  test('missing hone engine version fails', () => {
    const data = { ...validData };
    delete data.hone;
    const errors = validateManifest(data);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].field).toBe('hone');
  });

  test('non-array filesystem.read fails', () => {
    const data = { ...validData, capabilities: { 'filesystem.read': true } };
    const errors = validateManifest(data);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].field).toBe('capabilities.filesystem.read');
  });

  test('non-array process.spawn fails', () => {
    const data = { ...validData, capabilities: { 'process.spawn': true } };
    const errors = validateManifest(data);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].field).toBe('capabilities.process.spawn');
  });

  test('multiple missing fields reports all errors', () => {
    const errors = validateManifest({});
    expect(errors.length).toBeGreaterThan(3);
  });
});

describe('Manifest parsing', () => {
  test('valid JSON parses successfully', () => {
    const json = JSON.stringify({
      name: 'my-plugin',
      displayName: 'My Plugin',
      version: '1.0.0',
      author: 'Author',
      license: 'MIT',
      description: 'Desc',
      entry: 'MyPlugin',
      capabilities: {
        'editor.read': true,
        'ui.statusbar': true,
        'filesystem.read': ['**/*.ts'],
      },
      hooks: ['onDocumentOpen'],
      hone: '>=0.1.0',
    });
    const result = parsePluginManifest(json);
    expect(result.errors.length).toBe(0);
    expect(result.manifest).not.toBeNull();
    expect(result.manifest!.name).toBe('my-plugin');
    expect(result.manifest!.capabilities['editor.read']).toBe(true);
    expect(result.manifest!.capabilities['filesystem.read']).toEqual(['**/*.ts']);
    expect(result.manifest!.hooks.length).toBe(1);
  });

  test('invalid JSON returns error', () => {
    const result = parsePluginManifest('not json');
    expect(result.manifest).toBeNull();
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].field).toBe('root');
  });

  test('missing required fields returns errors', () => {
    const result = parsePluginManifest('{}');
    expect(result.manifest).toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('parsed manifest has correct tier', () => {
    const json = JSON.stringify({
      name: 'net-plugin',
      displayName: 'Net Plugin',
      version: '1.0.0',
      author: 'Author',
      license: 'MIT',
      description: 'Desc',
      entry: 'NetPlugin',
      capabilities: { network: true },
      hooks: [],
      hone: '>=0.1.0',
    });
    const result = parsePluginManifest(json);
    expect(result.manifest).not.toBeNull();
    expect(deriveTier(result.manifest!.capabilities)).toBe(3);
  });

  test('configSchema is preserved', () => {
    const json = JSON.stringify({
      name: 'cfg-plugin',
      displayName: 'Cfg Plugin',
      version: '1.0.0',
      author: 'Author',
      license: 'MIT',
      description: 'Desc',
      entry: 'CfgPlugin',
      capabilities: {},
      hooks: [],
      hone: '>=0.1.0',
      configSchema: {
        setting1: { type: 'boolean', default: true, description: 'A setting' },
      },
    });
    const result = parsePluginManifest(json);
    expect(result.manifest).not.toBeNull();
    expect(result.manifest!.configSchema).toBeDefined();
    expect(result.manifest!.configSchema!.setting1.type).toBe('boolean');
  });
});
