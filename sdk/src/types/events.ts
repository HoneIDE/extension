/**
 * Event types for the Hone Plugin SDK.
 *
 * These are dispatched to plugin hook methods by the host.
 */

import type { BufferId, Position, Range, Selection, TextEdit } from './editor';

export interface DocumentOpenEvent {
  bufferId: BufferId;
  languageId: string;
  filePath: string;
}

export interface DocumentSaveEvent {
  bufferId: BufferId;
  filePath: string;
}

export interface FormatDocumentEvent {
  bufferId: BufferId;
  languageId: string;
  /** The full text of the document. */
  text: string;
  /** Formatting options. */
  tabSize: number;
  insertSpaces: boolean;
}

export interface SelectionChangeEvent {
  bufferId: BufferId;
  selections: Selection[];
}

export interface CommandEvent {
  commandId: string;
  args: unknown[];
}

export interface CodeActionEvent {
  bufferId: BufferId;
  range: Range;
  diagnostics: DiagnosticInfo[];
}

export interface DiagnosticInfo {
  range: Range;
  message: string;
  severity: 'error' | 'warning' | 'info' | 'hint';
  source?: string;
}

export interface CodeAction {
  title: string;
  kind?: string;
  edits?: TextEdit[];
  commandId?: string;
}

export interface HoverEvent {
  bufferId: BufferId;
  position: Position;
}

export interface HoverInfo {
  contents: string;
  range?: Range;
}
