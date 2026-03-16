/**
 * Trailing Whitespace Trimmer — format-on-save plugin.
 *
 * Demonstrates: onDocumentFormat hook returning TextEdit[].
 * Perry-safe: for-loops, no .map(), explicit index variables.
 */

import { HonePlugin } from '../../../sdk/src/plugin';
import type { HoneHost } from '../../../sdk/src/host';
import type { TextEdit } from '../../../sdk/src/types/editor';
import type { FormatDocumentEvent } from '../../../sdk/src/types/events';

export class TrailingWhitespacePlugin extends HonePlugin {
  constructor(host: HoneHost) {
    super(host);
  }

  activate(): void {
    this.host.log('info', 'Trailing Whitespace Trimmer activated');
  }

  onDocumentFormat(event: FormatDocumentEvent): TextEdit[] | null {
    const enabled = this.host.getConfig('trimOnFormat');
    if (enabled === false) return null;

    const edits: TextEdit[] = [];
    const lines = event.text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let trimEnd = line.length;
      while (trimEnd > 0) {
        const ch = line.charCodeAt(trimEnd - 1);
        if (ch === 32 || ch === 9) {
          trimEnd--;
        } else {
          break;
        }
      }
      if (trimEnd < line.length) {
        edits.push({
          range: {
            start: { line: i, column: trimEnd },
            end: { line: i, column: line.length },
          },
          newText: '',
        });
      }
    }

    // Trim trailing blank lines
    const trimFinalNewlines = this.host.getConfig('trimFinalNewlines');
    if (trimFinalNewlines !== false && lines.length > 1) {
      let lastNonEmpty = lines.length - 1;
      while (lastNonEmpty > 0 && lines[lastNonEmpty].length === 0) {
        lastNonEmpty--;
      }
      if (lastNonEmpty < lines.length - 2) {
        // Remove extra blank lines at end, keep one trailing newline
        edits.push({
          range: {
            start: { line: lastNonEmpty + 1, column: 0 },
            end: { line: lines.length - 1, column: lines[lines.length - 1].length },
          },
          newText: '',
        });
      }
    }

    if (edits.length === 0) return null;
    return edits;
  }
}
