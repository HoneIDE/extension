/**
 * HonePlugin — base class for all Hone plugins.
 *
 * Perry-safe: public field (not protected), sync methods, no closures on `this`.
 */

import type { HoneHost } from './host';
import type { TextEdit } from './types/editor';
import type {
  FormatDocumentEvent,
  DocumentSaveEvent,
  DocumentOpenEvent,
  SelectionChangeEvent,
  CommandEvent,
  CodeActionEvent,
  CodeAction,
  HoverEvent,
  HoverInfo,
} from './types/events';

export abstract class HonePlugin {
  host: HoneHost;

  constructor(host: HoneHost) {
    this.host = host;
  }

  /** Called when the plugin is activated. Override to initialize. */
  activate(): void {}

  /** Called when the plugin is deactivated. Override to clean up. */
  deactivate(): void {}

  /** Hook: format a document. Return TextEdit[] to apply. */
  onDocumentFormat(_event: FormatDocumentEvent): TextEdit[] | null {
    return null;
  }

  /** Hook: document was saved. */
  onDocumentSave(_event: DocumentSaveEvent): void {}

  /** Hook: document was opened. */
  onDocumentOpen(_event: DocumentOpenEvent): void {}

  /** Hook: selection changed. */
  onSelectionChange(_event: SelectionChangeEvent): void {}

  /** Hook: command was invoked. */
  onCommand(_event: CommandEvent): void {}

  /** Hook: code action requested. */
  onCodeAction(_event: CodeActionEvent): CodeAction[] | null {
    return null;
  }

  /** Hook: hover requested. */
  onHover(_event: HoverEvent): HoverInfo | null {
    return null;
  }
}
