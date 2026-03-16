import { describe, test, expect, beforeEach } from 'bun:test';
import { MockHost } from '../src/testing/mock-host';
import { createTestBuffer } from '../src/testing/test-buffer';
import type { PluginCapabilities } from '../src/types/manifest';

const fullCaps: PluginCapabilities = {
  'editor.read': true,
  'editor.write': true,
  'editor.decorations': true,
  'filesystem.read': ['**/*'],
  'filesystem.write': true,
  'process.spawn': ['eslint', 'prettier'],
  'network': true,
  'ui.statusbar': true,
  'ui.panel': true,
  'ui.gutter': true,
  'ui.commandPalette': true,
  'ui.contextMenu': true,
  'ui.notifications': true,
};

describe('MockHost — capability enforcement', () => {
  test('throws on undeclared editor.read', () => {
    const host = new MockHost({});
    expect(() => host.bufferGetText(1)).toThrow('Capability not declared: editor.read');
  });

  test('throws on undeclared editor.write', () => {
    const host = new MockHost({});
    expect(() => host.bufferSubmitEdits(1, [])).toThrow('Capability not declared: editor.write');
  });

  test('throws on undeclared editor.decorations', () => {
    const host = new MockHost({});
    expect(() => host.createDecorationType({})).toThrow('Capability not declared: editor.decorations');
  });

  test('throws on undeclared filesystem.read', () => {
    const host = new MockHost({});
    expect(() => host.fileReadText('/foo')).toThrow('Capability not declared: filesystem.read');
  });

  test('throws on undeclared filesystem.write', () => {
    const host = new MockHost({});
    expect(() => host.fileWriteText('/foo', 'bar')).toThrow('Capability not declared: filesystem.write');
  });

  test('throws on undeclared network', () => {
    const host = new MockHost({});
    expect(() => host.httpRequest({ url: 'http://example.com' })).toThrow('Capability not declared: network');
  });

  test('throws on undeclared process.spawn', () => {
    const host = new MockHost({});
    expect(() => host.spawn('node', [])).toThrow('Capability not declared: process.spawn');
  });

  test('throws on undeclared ui.statusbar', () => {
    const host = new MockHost({});
    expect(() => host.statusBarCreateItem({ text: 'hi' })).toThrow('Capability not declared: ui.statusbar');
  });

  test('throws on undeclared ui.panel', () => {
    const host = new MockHost({});
    expect(() => host.panelCreate({ title: 'test' })).toThrow('Capability not declared: ui.panel');
  });

  test('throws on undeclared ui.notifications', () => {
    const host = new MockHost({});
    expect(() => host.notify({ message: 'hi' })).toThrow('Capability not declared: ui.notifications');
  });

  test('throws on undeclared ui.commandPalette', () => {
    const host = new MockHost({});
    expect(() => host.commandRegister('id', 'title')).toThrow('Capability not declared: ui.commandPalette');
  });

  test('throws on undeclared ui.contextMenu', () => {
    const host = new MockHost({});
    expect(() => host.contextMenuRegister({ location: 'editor', label: 'hi', commandId: 'cmd' }))
      .toThrow('Capability not declared: ui.contextMenu');
  });

  test('allows declared capabilities', () => {
    const host = new MockHost(fullCaps);
    const buf = createTestBuffer({ text: 'hello world' });
    host.addBuffer(buf);
    expect(host.bufferGetText(buf.id)).toBe('hello world');
  });

  test('log is always available', () => {
    const host = new MockHost({});
    host.log('info', 'test message');
    expect(host.logs.length).toBe(1);
    expect(host.logs[0].message).toBe('test message');
  });

  test('getConfig is always available', () => {
    const host = new MockHost({});
    host.setConfig('key', 'value');
    expect(host.getConfig('key')).toBe('value');
    expect(host.getConfig('missing')).toBeNull();
  });

  test('getWorkspacePath is always available', () => {
    const host = new MockHost({});
    expect(host.getWorkspacePath()).toBe('/mock/workspace');
    host.setWorkspacePath('/custom/path');
    expect(host.getWorkspacePath()).toBe('/custom/path');
  });
});

describe('MockHost — spy tracking', () => {
  let host: MockHost;

  beforeEach(() => {
    host = new MockHost(fullCaps);
    const buf = createTestBuffer({ text: 'hello world' });
    host.addBuffer(buf);
  });

  test('records method calls', () => {
    host.bufferGetText(1);
    expect(host.wasCalled('bufferGetText')).toBe(true);
    expect(host.wasCalled('bufferGetLines')).toBe(false);
  });

  test('counts method calls', () => {
    host.bufferGetText(1);
    host.bufferGetText(1);
    host.bufferGetText(1);
    expect(host.callCount('bufferGetText')).toBe(3);
  });

  test('getCalls returns full log', () => {
    host.log('info', 'msg');
    host.getConfig('key');
    const calls = host.getCalls();
    expect(calls.length).toBe(2);
    expect(calls[0]).toBe('log');
    expect(calls[1]).toBe('getConfig');
  });

  test('reset clears call log', () => {
    host.log('info', 'msg');
    host.reset();
    expect(host.getCalls().length).toBe(0);
    expect(host.logs.length).toBe(0);
  });
});

describe('MockHost — editor operations', () => {
  let host: MockHost;

  beforeEach(() => {
    host = new MockHost(fullCaps);
  });

  test('bufferGetLines returns line range', () => {
    const buf = createTestBuffer({ text: 'line0\nline1\nline2\nline3' });
    host.addBuffer(buf);
    const lines = host.bufferGetLines(buf.id, 1, 3);
    expect(lines.length).toBe(2);
    expect(lines[0]).toBe('line1');
    expect(lines[1]).toBe('line2');
  });

  test('bufferGetLineCount returns count', () => {
    const buf = createTestBuffer({ text: 'a\nb\nc' });
    host.addBuffer(buf);
    expect(host.bufferGetLineCount(buf.id)).toBe(3);
  });

  test('bufferGetLanguageId returns language', () => {
    const buf = createTestBuffer({ text: '', languageId: 'typescript' });
    host.addBuffer(buf);
    expect(host.bufferGetLanguageId(buf.id)).toBe('typescript');
  });

  test('bufferGetFilePath returns path', () => {
    const buf = createTestBuffer({ text: '', filePath: '/tmp/test.ts' });
    host.addBuffer(buf);
    expect(host.bufferGetFilePath(buf.id)).toBe('/tmp/test.ts');
  });

  test('bufferGetFilePath returns null for untitled', () => {
    const buf = createTestBuffer({ text: '' });
    host.addBuffer(buf);
    expect(host.bufferGetFilePath(buf.id)).toBeNull();
  });

  test('getActiveBufferId returns first added buffer', () => {
    const buf1 = createTestBuffer({ text: 'a' });
    const buf2 = createTestBuffer({ text: 'b' });
    host.addBuffer(buf1);
    host.addBuffer(buf2);
    expect(host.getActiveBufferId()).toBe(buf1.id);
  });

  test('setActiveBuffer changes active', () => {
    const buf1 = createTestBuffer({ text: 'a' });
    const buf2 = createTestBuffer({ text: 'b' });
    host.addBuffer(buf1);
    host.addBuffer(buf2);
    host.setActiveBuffer(buf2.id);
    expect(host.getActiveBufferId()).toBe(buf2.id);
  });

  test('getOpenBufferIds returns all', () => {
    const buf1 = createTestBuffer({ text: 'a' });
    const buf2 = createTestBuffer({ text: 'b' });
    host.addBuffer(buf1);
    host.addBuffer(buf2);
    const ids = host.getOpenBufferIds();
    expect(ids.length).toBe(2);
  });

  test('bufferSubmitEdits applies insertions', () => {
    const buf = createTestBuffer({ text: 'hello' });
    host.addBuffer(buf);
    const result = host.bufferSubmitEdits(buf.id, [{
      range: { start: { line: 0, column: 5 }, end: { line: 0, column: 5 } },
      newText: ' world',
    }]);
    expect(result.applied).toBe(true);
    expect(host.bufferGetText(buf.id)).toBe('hello world');
  });

  test('bufferSubmitEdits applies replacements', () => {
    const buf = createTestBuffer({ text: 'hello world' });
    host.addBuffer(buf);
    host.bufferSubmitEdits(buf.id, [{
      range: { start: { line: 0, column: 0 }, end: { line: 0, column: 5 } },
      newText: 'goodbye',
    }]);
    expect(host.bufferGetText(buf.id)).toBe('goodbye world');
  });

  test('bufferSubmitEdits applies deletions', () => {
    const buf = createTestBuffer({ text: 'hello world' });
    host.addBuffer(buf);
    host.bufferSubmitEdits(buf.id, [{
      range: { start: { line: 0, column: 5 }, end: { line: 0, column: 11 } },
      newText: '',
    }]);
    expect(host.bufferGetText(buf.id)).toBe('hello');
  });

  test('bufferSetSelection updates selection', () => {
    const buf = createTestBuffer({ text: 'hello' });
    host.addBuffer(buf);
    const sel = { anchor: { line: 0, column: 0 }, head: { line: 0, column: 5 } };
    host.bufferSetSelection(buf.id, sel);
    const got = host.bufferGetSelection(buf.id);
    expect(got.head.column).toBe(5);
  });
});

describe('MockHost — filesystem', () => {
  let host: MockHost;

  beforeEach(() => {
    host = new MockHost(fullCaps);
  });

  test('fileReadText reads added files', () => {
    host.addFile('/workspace/test.ts', 'const x = 1;');
    expect(host.fileReadText('/workspace/test.ts')).toBe('const x = 1;');
  });

  test('fileReadText throws on missing file', () => {
    expect(() => host.fileReadText('/missing')).toThrow('File not found');
  });

  test('fileExists checks files and dirs', () => {
    host.addFile('/workspace/file.ts', '');
    host.addDirectory('/workspace/src');
    expect(host.fileExists('/workspace/file.ts')).toBe(true);
    expect(host.fileExists('/workspace/src')).toBe(true);
    expect(host.fileExists('/workspace/missing')).toBe(false);
  });

  test('fileStat returns file info', () => {
    host.addFile('/workspace/file.ts', 'hello');
    const stat = host.fileStat('/workspace/file.ts');
    expect(stat.isFile).toBe(true);
    expect(stat.isDirectory).toBe(false);
    expect(stat.size).toBe(5);
  });

  test('fileStat returns dir info', () => {
    host.addDirectory('/workspace/src');
    const stat = host.fileStat('/workspace/src');
    expect(stat.isFile).toBe(false);
    expect(stat.isDirectory).toBe(true);
  });

  test('directoryList lists entries', () => {
    host.addFile('/workspace/a.ts', '');
    host.addFile('/workspace/b.ts', '');
    host.addDirectory('/workspace/src');
    const entries = host.directoryList('/workspace');
    expect(entries.length).toBe(3);
  });

  test('fileWriteText creates files', () => {
    host.fileWriteText('/workspace/new.ts', 'content');
    expect(host.fileReadText('/workspace/new.ts')).toBe('content');
  });

  test('fileDelete removes files', () => {
    host.addFile('/workspace/del.ts', '');
    host.fileDelete('/workspace/del.ts');
    expect(host.fileExists('/workspace/del.ts')).toBe(false);
  });

  test('directoryCreate creates directories', () => {
    host.directoryCreate('/workspace/newdir');
    expect(host.fileExists('/workspace/newdir')).toBe(true);
  });
});

describe('MockHost — process.spawn', () => {
  test('returns mock result', () => {
    const host = new MockHost(fullCaps);
    host.setSpawnResult('eslint', { exitCode: 0, stdout: '[]', stderr: '' });
    const result = host.spawn('eslint', ['file.ts']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('[]');
  });

  test('throws on non-allowlisted binary', () => {
    const host = new MockHost(fullCaps);
    expect(() => host.spawn('rm', ['-rf', '/'])).toThrow('Binary not in allowlist');
  });

  test('returns default result for unmocked command', () => {
    const host = new MockHost(fullCaps);
    const result = host.spawn('eslint', ['file.ts']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
  });
});

describe('MockHost — network', () => {
  test('returns mock HTTP response', () => {
    const host = new MockHost(fullCaps);
    host.setHttpResult('http://api.example.com', {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: '{"ok":true}',
    });
    const resp = host.httpRequest({ url: 'http://api.example.com' });
    expect(resp.status).toBe(200);
    expect(resp.body).toBe('{"ok":true}');
  });

  test('returns 404 for unknown URL', () => {
    const host = new MockHost(fullCaps);
    const resp = host.httpRequest({ url: 'http://unknown.com' });
    expect(resp.status).toBe(404);
  });
});

describe('MockHost — UI', () => {
  let host: MockHost;

  beforeEach(() => {
    host = new MockHost(fullCaps);
  });

  test('statusbar create/update/remove', () => {
    const id = host.statusBarCreateItem({ text: 'Words: 0' });
    expect(host.statusBarItems.has(id)).toBe(true);
    host.statusBarUpdateItem(id, { text: 'Words: 42' });
    expect(host.statusBarItems.get(id)!.text).toBe('Words: 42');
    host.statusBarRemoveItem(id);
    expect(host.statusBarItems.has(id)).toBe(false);
  });

  test('panel create/update/dispose', () => {
    const id = host.panelCreate({ title: 'Test Panel' });
    expect(host.panels.has(id)).toBe(true);
    host.panelUpdate(id, { elements: [{ type: 'text', value: 'hello' }] });
    expect(host.panels.get(id)!.content!.elements.length).toBe(1);
    host.panelDispose(id);
    expect(host.panels.has(id)).toBe(false);
  });

  test('decorations create/set/clear', () => {
    const typeId = host.createDecorationType({ underlineColor: '#ff0000', underlineStyle: 'wavy' });
    expect(host.decorations.has(typeId)).toBe(true);
    const buf = createTestBuffer({ text: 'hello' });
    host.addBuffer(buf);
    host.setDecorations(buf.id, typeId, [
      { startLine: 0, startColumn: 0, endLine: 0, endColumn: 5, hoverMessage: 'error' },
    ]);
    expect(host.decorations.get(typeId)!.ranges.get(buf.id)!.length).toBe(1);
    host.clearDecorations(typeId);
    expect(host.decorations.get(typeId)!.ranges.size).toBe(0);
  });

  test('command register/unregister', () => {
    host.commandRegister('test.cmd', 'Test Command');
    expect(host.commands.has('test.cmd')).toBe(true);
    host.commandUnregister('test.cmd');
    expect(host.commands.has('test.cmd')).toBe(false);
  });

  test('notifications', () => {
    host.notify({ message: 'Test notification', severity: 'warning' });
    expect(host.notifications.length).toBe(1);
    expect(host.notifications[0].severity).toBe('warning');
  });
});
