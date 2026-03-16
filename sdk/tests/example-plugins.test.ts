import { describe, test, expect, beforeEach } from 'bun:test';
import { MockHost } from '../src/testing/mock-host';
import { createTestBuffer } from '../src/testing/test-buffer';
import { activatePlugin, deactivatePlugin, dispatchFormat, dispatchSave, dispatchOpen, dispatchCommand, dispatchSelectionChange } from '../src/testing/test-runner';
import type { PluginCapabilities } from '../src/types/manifest';

// --- Hello World ---
import { HelloWorldPlugin } from '../../examples/hello-world/src/index';

describe('HelloWorldPlugin via test runner', () => {
  const caps: PluginCapabilities = {
    'ui.commandPalette': true,
    'ui.notifications': true,
  };

  test('activate/deactivate lifecycle', () => {
    const host = new MockHost(caps);
    const ctx = activatePlugin(HelloWorldPlugin, host);
    expect(host.commands.has('hello-world.greet')).toBe(true);
    deactivatePlugin(ctx);
    expect(host.commands.has('hello-world.greet')).toBe(false);
  });

  test('command dispatch triggers notification', () => {
    const host = new MockHost(caps);
    const ctx = activatePlugin(HelloWorldPlugin, host);
    dispatchCommand(ctx, { commandId: 'hello-world.greet', args: [] });
    expect(host.notifications.length).toBe(1);
  });
});

// --- Word Count ---
import { WordCountPlugin, countWords } from '../../examples/word-count/src/index';

describe('WordCountPlugin', () => {
  const caps: PluginCapabilities = {
    'editor.read': true,
    'ui.statusbar': true,
    'ui.commandPalette': true,
  };

  test('countWords helper', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('hello')).toBe(1);
    expect(countWords('hello world')).toBe(2);
    expect(countWords('  hello   world  ')).toBe(2);
    expect(countWords('one\ntwo\nthree')).toBe(3);
    expect(countWords('   ')).toBe(0);
  });

  test('activate creates status bar item and command', () => {
    const host = new MockHost(caps);
    const buf = createTestBuffer({ text: 'hello world' });
    host.addBuffer(buf);
    const ctx = activatePlugin(WordCountPlugin, host);
    expect(host.statusBarItems.size).toBe(1);
    expect(host.commands.has('word-count.show')).toBe(true);
    deactivatePlugin(ctx);
    expect(host.statusBarItems.size).toBe(0);
  });

  test('updates on document open', () => {
    const host = new MockHost(caps);
    const buf = createTestBuffer({ text: 'one two three four five' });
    host.addBuffer(buf);
    const ctx = activatePlugin(WordCountPlugin, host);
    host.reset();
    dispatchOpen(ctx, { bufferId: buf.id, languageId: 'plaintext', filePath: '/test.txt' });
    expect(host.wasCalled('statusBarUpdateItem')).toBe(true);
  });

  test('updates on selection change', () => {
    const host = new MockHost(caps);
    const buf = createTestBuffer({ text: 'hello world' });
    host.addBuffer(buf);
    const ctx = activatePlugin(WordCountPlugin, host);
    host.reset();
    dispatchSelectionChange(ctx, { bufferId: buf.id, selections: [buf.selection] });
    expect(host.wasCalled('statusBarUpdateItem')).toBe(true);
  });
});

// --- Trailing Whitespace Formatter ---
import { TrailingWhitespacePlugin } from '../../examples/formatter/src/index';

describe('TrailingWhitespacePlugin', () => {
  const caps: PluginCapabilities = {
    'editor.read': true,
    'editor.write': true,
    'ui.notifications': true,
  };

  test('trims trailing whitespace', () => {
    const host = new MockHost(caps);
    const ctx = activatePlugin(TrailingWhitespacePlugin, host);
    const edits = dispatchFormat(ctx, {
      bufferId: 1,
      languageId: 'plaintext',
      text: 'hello   \nworld  \n',
      tabSize: 2,
      insertSpaces: true,
    });
    expect(edits).not.toBeNull();
    expect(edits!.length).toBe(2);
    // First edit: trim "   " from line 0
    expect(edits![0].range.start.line).toBe(0);
    expect(edits![0].range.start.column).toBe(5);
    expect(edits![0].newText).toBe('');
    // Second edit: trim "  " from line 1
    expect(edits![1].range.start.line).toBe(1);
    expect(edits![1].range.start.column).toBe(5);
  });

  test('returns null when no trailing whitespace', () => {
    const host = new MockHost(caps);
    const ctx = activatePlugin(TrailingWhitespacePlugin, host);
    const edits = dispatchFormat(ctx, {
      bufferId: 1,
      languageId: 'plaintext',
      text: 'hello\nworld\n',
      tabSize: 2,
      insertSpaces: true,
    });
    expect(edits).toBeNull();
  });

  test('respects trimOnFormat config = false', () => {
    const host = new MockHost(caps);
    host.setConfig('trimOnFormat', false);
    const ctx = activatePlugin(TrailingWhitespacePlugin, host);
    const edits = dispatchFormat(ctx, {
      bufferId: 1,
      languageId: 'plaintext',
      text: 'hello   \n',
      tabSize: 2,
      insertSpaces: true,
    });
    expect(edits).toBeNull();
  });
});

// --- Simple Linter ---
import { SimpleLinterPlugin, parseEslintOutput } from '../../examples/linter/src/index';

describe('SimpleLinterPlugin', () => {
  const caps: PluginCapabilities = {
    'editor.read': true,
    'editor.decorations': true,
    'process.spawn': ['eslint'],
    'ui.notifications': true,
  };

  test('parseEslintOutput parses diagnostics', () => {
    const output = JSON.stringify([{
      filePath: '/test.ts',
      messages: [
        { line: 1, column: 5, endColumn: 10, message: 'no-unused-vars', severity: 2 },
        { line: 3, column: 1, endColumn: 8, message: 'prefer-const', severity: 1 },
      ],
    }]);
    const diags = parseEslintOutput(output);
    expect(diags.length).toBe(2);
    expect(diags[0].line).toBe(0); // 0-indexed
    expect(diags[0].severity).toBe(2);
    expect(diags[1].severity).toBe(1);
  });

  test('parseEslintOutput handles invalid JSON', () => {
    expect(parseEslintOutput('not json')).toEqual([]);
  });

  test('parseEslintOutput handles empty array', () => {
    expect(parseEslintOutput('[]')).toEqual([]);
  });

  test('activate creates decoration types', () => {
    const host = new MockHost(caps);
    const ctx = activatePlugin(SimpleLinterPlugin, host);
    expect(host.decorations.size).toBe(2);
    deactivatePlugin(ctx);
  });

  test('onDocumentSave runs linter', () => {
    const host = new MockHost(caps);
    host.setSpawnResult('eslint', {
      exitCode: 1,
      stdout: JSON.stringify([{
        filePath: '/test.ts',
        messages: [
          { line: 1, column: 1, endColumn: 5, message: 'error', severity: 2 },
        ],
      }]),
      stderr: '',
    });
    const buf = createTestBuffer({ text: 'let x = 1;', filePath: '/test.ts' });
    host.addBuffer(buf);
    const ctx = activatePlugin(SimpleLinterPlugin, host);
    host.reset();
    dispatchSave(ctx, { bufferId: buf.id, filePath: '/test.ts' });
    expect(host.wasCalled('spawn')).toBe(true);
    expect(host.wasCalled('setDecorations')).toBe(true);
  });

  test('onDocumentSave respects lintOnSave config', () => {
    const host = new MockHost(caps);
    host.setConfig('lintOnSave', false);
    const buf = createTestBuffer({ text: 'let x = 1;', filePath: '/test.ts' });
    host.addBuffer(buf);
    const ctx = activatePlugin(SimpleLinterPlugin, host);
    host.reset();
    dispatchSave(ctx, { bufferId: buf.id, filePath: '/test.ts' });
    expect(host.wasCalled('spawn')).toBe(false);
  });

  test('handles linter failure', () => {
    const host = new MockHost(caps);
    host.setSpawnResult('eslint', { exitCode: 2, stdout: '', stderr: 'error' });
    const buf = createTestBuffer({ text: 'x', filePath: '/test.ts' });
    host.addBuffer(buf);
    const ctx = activatePlugin(SimpleLinterPlugin, host);
    host.reset();
    dispatchSave(ctx, { bufferId: buf.id, filePath: '/test.ts' });
    expect(host.notifications.length).toBe(1);
    expect(host.notifications[0].severity).toBe('error');
  });
});
