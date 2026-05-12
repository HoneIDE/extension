/**
 * TODO Highlighter — highlight TODO/FIXME/HACK/NOTE annotations.
 *
 * Scans open documents for annotation keywords, highlights them with
 * colored decorations, and lists all found annotations in a panel.
 */

import { HonePlugin } from '@honeide/sdk';
import { HoneHostImpl } from '@honeide/sdk';
import type { HoneHost } from '@honeide/sdk';
import type { DocumentOpenEvent, DocumentSaveEvent } from '@honeide/sdk';

/** Annotation keyword patterns and their colors. */
const KEYWORDS = ['TODO', 'FIXME', 'HACK', 'NOTE', 'BUG', 'XXX'];
const COLORS = ['#FFCC00', '#FF4444', '#FF8C00', '#4FC1FF', '#FF4444', '#FF8C00'];

export class TodoHighlighterPlugin extends HonePlugin {
  decorationTypeIds: number[] = [];

  constructor(host: HoneHost) {
    super(host);
  }

  activate(): void {
    // Create decoration types for each keyword
    for (let i = 0; i < KEYWORDS.length; i++) {
      const id = this.host.createDecorationType({
        backgroundColor: COLORS[i] + '30', // 30 = ~19% opacity
        isWholeLine: false,
      });
      this.decorationTypeIds.push(id);
    }

    this.host.commandRegister('todo-highlighter.list', 'TODO: List All Annotations');
    this.host.log('info', 'TODO Highlighter activated');
  }

  deactivate(): void {
    for (let i = 0; i < this.decorationTypeIds.length; i++) {
      this.host.clearDecorations(this.decorationTypeIds[i]);
    }
    this.host.commandUnregister('todo-highlighter.list');
  }

  onDocumentOpen(_event: DocumentOpenEvent): void {
    scanDocument(this);
  }

  onDocumentSave(_event: DocumentSaveEvent): void {
    scanDocument(this);
  }
}

/** Scan the active document for annotation keywords. Perry-safe module-level fn. */
function scanDocument(plugin: TodoHighlighterPlugin): void {
  const bufferId = plugin.host.getActiveBufferId();
  if (bufferId === null) return;

  const text = plugin.host.bufferGetText(bufferId);
  if (text.length < 1) return;

  // Scan each line for keywords
  for (let ki = 0; ki < KEYWORDS.length; ki++) {
    const keyword = KEYWORDS[ki];
    const ranges: Array<{ startLine: number; startColumn: number; endLine: number; endColumn: number }> = [];

    let lineStart = 0;
    let lineNum = 0;
    for (let i = 0; i <= text.length; i++) {
      if (i === text.length || text.charCodeAt(i) === 10) {
        const line = text.slice(lineStart, i);
        let searchFrom = 0;
        while (searchFrom < line.length) {
          const idx = line.indexOf(keyword, searchFrom);
          if (idx < 0) break;
          ranges.push({
            startLine: lineNum,
            startColumn: idx,
            endLine: lineNum,
            endColumn: idx + keyword.length,
          });
          searchFrom = idx + keyword.length;
        }
        lineStart = i + 1;
        lineNum++;
      }
    }

    if (ranges.length > 0 && ki < plugin.decorationTypeIds.length) {
      plugin.host.setDecorations(bufferId, plugin.decorationTypeIds[ki], ranges);
    }
  }
}

// ---------------------------------------------------------------------------
// Top-level entry points
// ---------------------------------------------------------------------------

let _plugin: TodoHighlighterPlugin | null = null;

export function activate(_apiHandle: number): void {
  const host = new HoneHostImpl('todo-highlighter');
  _plugin = new TodoHighlighterPlugin(host);
  _plugin.activate();
}

export function deactivate(): void {
  if (_plugin !== null) {
    _plugin.deactivate();
    _plugin = null;
  }
}

export function onDocumentOpen(_eventPtr: number): number {
  if (_plugin !== null) _plugin.onDocumentOpen({ bufferId: 0, languageId: '', filePath: '' });
  return 1;
}

export function onDocumentSave(_eventPtr: number): number {
  if (_plugin !== null) _plugin.onDocumentSave({ bufferId: 0, filePath: '' });
  return 1;
}
