/**
 * Color Highlight — show inline color swatches for hex/rgb/hsl values.
 */

import { HonePlugin } from '@honeide/sdk';
import { HoneHostImpl } from '@honeide/sdk';
import type { HoneHost } from '@honeide/sdk';
import type { DocumentOpenEvent, DocumentSaveEvent } from '@honeide/sdk';

export class ColorHighlightPlugin extends HonePlugin {
  colorDecoTypeId: number = 0;

  constructor(host: HoneHost) { super(host); }

  activate(): void {
    this.colorDecoTypeId = this.host.createDecorationType({
      isWholeLine: false,
    });
    this.host.log('info', 'Color Highlight activated');
  }

  deactivate(): void {
    this.host.clearDecorations(this.colorDecoTypeId);
  }

  onDocumentOpen(_event: DocumentOpenEvent): void { scanColors(this); }
  onDocumentSave(_event: DocumentSaveEvent): void { scanColors(this); }
}

/** Scan document for color values and add decorations. */
function scanColors(plugin: ColorHighlightPlugin): void {
  const bufferId = plugin.host.getActiveBufferId();
  if (bufferId === null) return;
  const text = plugin.host.bufferGetText(bufferId);
  if (text.length < 4) return;

  const ranges: Array<{ startLine: number; startColumn: number; endLine: number; endColumn: number }> = [];
  let lineStart = 0;
  let lineNum = 0;

  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text.charCodeAt(i) === 10) {
      const line = text.slice(lineStart, i);
      // Find #RRGGBB or #RGB patterns
      for (let j = 0; j < line.length; j++) {
        if (line.charCodeAt(j) === 35) { // #
          // Check for #RRGGBB (7 chars) or #RRGGBBAA (9 chars)
          let hexLen = 0;
          for (let k = j + 1; k < line.length && k < j + 9; k++) {
            const ch = line.charCodeAt(k);
            if ((ch >= 48 && ch <= 57) || (ch >= 65 && ch <= 70) || (ch >= 97 && ch <= 102)) {
              hexLen++;
            } else {
              break;
            }
          }
          if (hexLen === 6 || hexLen === 3 || hexLen === 8) {
            ranges.push({
              startLine: lineNum, startColumn: j,
              endLine: lineNum, endColumn: j + 1 + hexLen,
            });
          }
        }
      }
      lineStart = i + 1;
      lineNum++;
    }
  }

  if (ranges.length > 0) {
    plugin.host.setDecorations(bufferId, plugin.colorDecoTypeId, ranges);
  }
}

let _plugin: ColorHighlightPlugin | null = null;

export function activate(_apiHandle: number): void {
  const host = new HoneHostImpl('color-highlight');
  _plugin = new ColorHighlightPlugin(host);
  _plugin.activate();
}

export function deactivate(): void {
  if (_plugin !== null) { _plugin.deactivate(); _plugin = null; }
}

export function onDocumentOpen(_eventPtr: number): number {
  if (_plugin !== null) _plugin.onDocumentOpen({ bufferId: 0, languageId: '', filePath: '' });
  return 1;
}

export function onDocumentSave(_eventPtr: number): number {
  if (_plugin !== null) _plugin.onDocumentSave({ bufferId: 0, filePath: '' });
  return 1;
}
