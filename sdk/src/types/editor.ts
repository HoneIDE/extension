/**
 * Editor types for the Hone Plugin SDK.
 *
 * BufferId is a plain number (not a branded string) for Perry compatibility.
 * All types are plain data — no methods, no generics with constraints.
 */

/** Opaque buffer identifier. Plain number for Perry safety. */
export type BufferId = number;

/** Zero-indexed line/column position in a text buffer. */
export interface Position {
  line: number;
  column: number;
}

/** A range in a text buffer (start inclusive, end exclusive). */
export interface Range {
  start: Position;
  end: Position;
}

/** A selection with anchor and head (cursor) positions. */
export interface Selection {
  anchor: Position;
  head: Position;
}

/** A text edit to apply to a buffer. */
export interface TextEdit {
  range: Range;
  newText: string;
}

/** Result of applying edits to a buffer. */
export interface EditResult {
  applied: boolean;
  pendingReview: boolean;
}

/** Create an insertion edit at the given position. */
export function insertEdit(pos: Position, text: string): TextEdit {
  return {
    range: { start: pos, end: pos },
    newText: text,
  };
}

/** Create a replacement edit over the given range. */
export function replaceEdit(range: Range, text: string): TextEdit {
  return { range: range, newText: text };
}

/** Create a deletion edit over the given range. */
export function deleteEdit(range: Range): TextEdit {
  return { range: range, newText: '' };
}

/** Create a Position. */
export function pos(line: number, column: number): Position {
  return { line: line, column: column };
}

/** Create a Range from two positions. */
export function range(startLine: number, startCol: number, endLine: number, endCol: number): Range {
  return {
    start: { line: startLine, column: startCol },
    end: { line: endLine, column: endCol },
  };
}
