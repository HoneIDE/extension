/**
 * Simple Linter plugin — spawns an external linter and applies decorations.
 *
 * Demonstrates: process.spawn, editor.decorations, Tier 3 capabilities.
 * Perry-safe: for-loops, module-level functions, no closures on `this`.
 */

import { HonePlugin } from '../../../sdk/src/plugin';
import type { HoneHost } from '../../../sdk/src/host';
import type { BufferId } from '../../../sdk/src/types/editor';
import type { DecorationTypeId, DecorationRange } from '../../../sdk/src/types/ui';
import type { DocumentSaveEvent, DocumentOpenEvent } from '../../../sdk/src/types/events';

export interface LintDiagnostic {
  line: number;
  column: number;
  endColumn: number;
  message: string;
  severity: number;
}

/** Parse ESLint JSON output. Perry-safe (for-loop). */
function parseEslintOutput(stdout: string): LintDiagnostic[] {
  const results: LintDiagnostic[] = [];
  let parsed: unknown[];
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return results;
  }
  if (!Array.isArray(parsed)) return results;

  for (let i = 0; i < parsed.length; i++) {
    const file = parsed[i] as Record<string, unknown>;
    const messages = file.messages as unknown[];
    if (!Array.isArray(messages)) continue;
    for (let j = 0; j < messages.length; j++) {
      const msg = messages[j] as Record<string, unknown>;
      results.push({
        line: (msg.line as number) - 1, // 0-indexed
        column: (msg.column as number) - 1,
        endColumn: (msg.endColumn as number | undefined) !== undefined
          ? (msg.endColumn as number) - 1
          : (msg.column as number),
        message: msg.message as string,
        severity: msg.severity as number,
      });
    }
  }
  return results;
}

export class SimpleLinterPlugin extends HonePlugin {
  errorDecType: DecorationTypeId = 0;
  warningDecType: DecorationTypeId = 0;

  constructor(host: HoneHost) {
    super(host);
  }

  activate(): void {
    this.errorDecType = this.host.createDecorationType({
      underlineColor: '#ff0000',
      underlineStyle: 'wavy',
    });
    this.warningDecType = this.host.createDecorationType({
      underlineColor: '#ffaa00',
      underlineStyle: 'wavy',
    });
    this.host.log('info', 'Simple Linter activated');
  }

  deactivate(): void {
    this.host.clearDecorations(this.errorDecType);
    this.host.clearDecorations(this.warningDecType);
  }

  onDocumentSave(event: DocumentSaveEvent): void {
    const enabled = this.host.getConfig('lintOnSave');
    if (enabled === false) return;
    runLint(this, event.bufferId, event.filePath);
  }

  onDocumentOpen(event: DocumentOpenEvent): void {
    runLint(this, event.bufferId, event.filePath);
  }
}

/** Module-level function to run the linter. Perry-safe. */
function runLint(plugin: SimpleLinterPlugin, bufferId: BufferId, filePath: string): void {
  const result = plugin.host.spawn('eslint', ['--format', 'json', filePath]);
  if (result.exitCode !== 0 && result.exitCode !== 1) {
    plugin.host.notify({
      message: 'Linter failed to run',
      severity: 'error',
    });
    return;
  }

  const diagnostics = parseEslintOutput(result.stdout);
  const errorRanges: DecorationRange[] = [];
  const warningRanges: DecorationRange[] = [];

  for (let i = 0; i < diagnostics.length; i++) {
    const d = diagnostics[i];
    const range: DecorationRange = {
      startLine: d.line,
      startColumn: d.column,
      endLine: d.line,
      endColumn: d.endColumn,
      hoverMessage: d.message,
    };
    if (d.severity === 2) {
      errorRanges.push(range);
    } else {
      warningRanges.push(range);
    }
  }

  plugin.host.setDecorations(bufferId, plugin.errorDecType, errorRanges);
  plugin.host.setDecorations(bufferId, plugin.warningDecType, warningRanges);
}

export { parseEslintOutput };
