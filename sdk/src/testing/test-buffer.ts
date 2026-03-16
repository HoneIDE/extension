/**
 * Test buffer creation helper for plugin tests.
 */

import type { BufferId, Selection } from '../types/editor';
import type { TestBuffer } from './mock-host';

let nextBufferId = 1;

/**
 * Create a test buffer with sensible defaults.
 * Perry-safe: no closures, no .map().
 */
export function createTestBuffer(options?: {
  text?: string;
  languageId?: string;
  filePath?: string | null;
}): TestBuffer {
  const id = nextBufferId as BufferId;
  nextBufferId++;

  const text = (options && options.text !== undefined) ? options.text : '';
  const languageId = (options && options.languageId !== undefined) ? options.languageId : 'plaintext';
  const filePath = (options && options.filePath !== undefined) ? options.filePath : null;

  const defaultSel: Selection = {
    anchor: { line: 0, column: 0 },
    head: { line: 0, column: 0 },
  };

  return {
    id: id,
    text: text,
    languageId: languageId,
    filePath: filePath,
    selection: defaultSel,
    selections: [defaultSel],
  };
}
