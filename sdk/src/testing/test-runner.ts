/**
 * Plugin test harness — utilities for testing plugin lifecycle and hooks.
 *
 * Perry-safe: no closures on `this`, for-loops only.
 */

import type { HonePlugin } from '../plugin';
import type { MockHost } from './mock-host';
import type { TextEdit } from '../types/editor';
import type {
  FormatDocumentEvent,
  DocumentSaveEvent,
  DocumentOpenEvent,
  SelectionChangeEvent,
  CommandEvent,
} from '../types/events';

export interface PluginTestContext {
  plugin: HonePlugin;
  host: MockHost;
}

/**
 * Create a plugin instance and activate it.
 * Returns context for further testing.
 */
export function activatePlugin(
  PluginClass: new (host: MockHost) => HonePlugin,
  host: MockHost,
): PluginTestContext {
  const plugin = new PluginClass(host);
  plugin.activate();
  return { plugin: plugin, host: host };
}

/**
 * Deactivate a plugin from a test context.
 */
export function deactivatePlugin(ctx: PluginTestContext): void {
  ctx.plugin.deactivate();
}

/**
 * Dispatch a format event and return the edits.
 */
export function dispatchFormat(ctx: PluginTestContext, event: FormatDocumentEvent): TextEdit[] | null {
  return ctx.plugin.onDocumentFormat(event);
}

/**
 * Dispatch a save event.
 */
export function dispatchSave(ctx: PluginTestContext, event: DocumentSaveEvent): void {
  ctx.plugin.onDocumentSave(event);
}

/**
 * Dispatch a document open event.
 */
export function dispatchOpen(ctx: PluginTestContext, event: DocumentOpenEvent): void {
  ctx.plugin.onDocumentOpen(event);
}

/**
 * Dispatch a selection change event.
 */
export function dispatchSelectionChange(ctx: PluginTestContext, event: SelectionChangeEvent): void {
  ctx.plugin.onSelectionChange(event);
}

/**
 * Dispatch a command event.
 */
export function dispatchCommand(ctx: PluginTestContext, event: CommandEvent): void {
  ctx.plugin.onCommand(event);
}
