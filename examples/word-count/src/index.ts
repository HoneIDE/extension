/**
 * Word Count plugin — shows word count in the status bar.
 *
 * Demonstrates: editor.read, ui.statusbar, selection tracking.
 * Perry-safe: for-loops, no .map(), no string `+`.
 *
 * Plugin entry points:
 * - activate(apiHandle) — called by the host when plugin loads
 * - deactivate()        — called by the host when plugin unloads
 * - onDocumentOpen(eventPtr) — hook
 * - onSelectionChange(eventPtr) — hook
 * - onCommand(eventPtr) — hook
 */

import { HonePlugin } from '../../../sdk/src/plugin';
import { HoneHostImpl } from '../../../sdk/src/host-impl';
import type { HoneHost } from '../../../sdk/src/host';
import type { StatusBarItemId } from '../../../sdk/src/types/ui';
import type { DocumentOpenEvent, SelectionChangeEvent, CommandEvent } from '../../../sdk/src/types/events';

/** Count words in a string. Perry-safe (for-loop, no regex). */
function countWords(text: string): number {
  if (text.length === 0) return 0;
  let count = 0;
  let inWord = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    // space=32, tab=9, newline=10, cr=13
    const isSpace = ch === 32 || ch === 9 || ch === 10 || ch === 13;
    if (isSpace) {
      inWord = false;
    } else if (!inWord) {
      inWord = true;
      count++;
    }
  }
  return count;
}

export class WordCountPlugin extends HonePlugin {
  statusBarId: StatusBarItemId = 0;

  constructor(host: HoneHost) {
    super(host);
  }

  activate(): void {
    this.statusBarId = this.host.statusBarCreateItem({
      text: 'Words: 0',
      tooltip: 'Word count',
      alignment: 'right',
      priority: 100,
    });
    this.host.commandRegister('word-count.show', 'Word Count: Show');
    this.host.log('info', 'Word Count plugin activated');
    updateStatusBar(this);
  }

  deactivate(): void {
    this.host.statusBarRemoveItem(this.statusBarId);
    this.host.commandUnregister('word-count.show');
  }

  onDocumentOpen(_event: DocumentOpenEvent): void {
    updateStatusBar(this);
  }

  onSelectionChange(_event: SelectionChangeEvent): void {
    updateStatusBar(this);
  }

  onCommand(event: CommandEvent): void {
    if (event.commandId === 'word-count.show') {
      updateStatusBar(this);
    }
  }
}

/** Module-level function to update status bar. Perry-safe (no closure on `this`). */
function updateStatusBar(plugin: WordCountPlugin): void {
  const bufferId = plugin.host.getActiveBufferId();
  if (bufferId === null) return;
  const text = plugin.host.bufferGetText(bufferId);
  const count = countWords(text);
  let label = 'Words: ';
  label += String(count);
  plugin.host.statusBarUpdateItem(plugin.statusBarId, {
    text: label,
    tooltip: 'Word count',
    alignment: 'right',
    priority: 100,
  });
}

// ---------------------------------------------------------------------------
// Top-level entry points
// ---------------------------------------------------------------------------

let _plugin: WordCountPlugin | null = null;

export function activate(_apiHandle: number): void {
  const host = new HoneHostImpl('word-count');
  _plugin = new WordCountPlugin(host);
  _plugin.activate();
}

export function deactivate(): void {
  if (_plugin !== null) {
    _plugin.deactivate();
    _plugin = null;
  }
}

export function onDocumentOpen(_eventPtr: number): number {
  if (_plugin !== null) {
    _plugin.onDocumentOpen({ bufferId: 0, languageId: '', filePath: '' });
  }
  return 1;
}

export function onSelectionChange(_eventPtr: number): number {
  if (_plugin !== null) {
    _plugin.onSelectionChange({ bufferId: 0, selections: [] });
  }
  return 1;
}

export function onCommand(_eventPtr: number): number {
  if (_plugin !== null) {
    _plugin.onCommand({ commandId: 'word-count.show', args: [] });
  }
  return 1;
}

export { countWords };
