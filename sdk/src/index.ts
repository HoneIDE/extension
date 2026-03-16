/**
 * @hone/sdk — Hone Plugin SDK
 *
 * Types, base classes, and testing utilities for building native Hone plugins.
 * All code is Perry-compilable from day 1.
 */

// Base class
export { HonePlugin } from './plugin';

// Host interface + implementation
export type { HoneHost } from './host';
export { HoneHostImpl } from './host-impl';

// Canvas
export type { CanvasContext } from './canvas';

// All types
export {
  // Editor
  type BufferId, type Position, type Range, type Selection, type TextEdit, type EditResult,
  insertEdit, replaceEdit, deleteEdit, pos, range,

  // Filesystem
  type FileStat, type FileInfo, type FileWatchEventKind, type FileWatchEvent, type WatchHandle,

  // UI
  type PanelElement, type PanelElementType,
  type TextElement, type TextStyle, type HeadingElement,
  type ListItem, type ListElement,
  type TreeNode, type TreeElement,
  type TableColumn, type TableRow, type TableElement,
  type InputElement, type ButtonElement, type SeparatorElement,
  type ProgressElement, type CodeBlockElement, type GroupElement,
  type PanelId, type PanelOptions, type PanelContent,
  type StatusBarItemId, type StatusBarItemOptions,
  type DecorationTypeId, type DecorationTypeOptions, type DecorationRange,
  type GutterProviderId, type GutterProviderOptions, type GutterItem,
  type ContextMenuId, type ContextMenuOptions,
  type NotificationSeverity, type NotificationOptions, type NotificationAction,

  // Process & Network
  type SpawnOptions, type ChildProcess,
  type HttpRequest, type HttpResponse,

  // Config
  type ConfigValueType, type ConfigSchemaEntry, type ConfigSchema,

  // Changes
  type ChangeSource, type TrustLevel,

  // Events
  type DocumentOpenEvent, type DocumentSaveEvent, type FormatDocumentEvent,
  type SelectionChangeEvent, type CommandEvent, type CodeActionEvent,
  type CodeAction, type DiagnosticInfo, type HoverEvent, type HoverInfo,

  // Manifest
  type PluginCapabilities, type HookName, type PluginManifest, type PluginTier, type ManifestError,
  deriveTier, validateManifest, parsePluginManifest,
} from './types/index';

// Testing utilities
export { MockHost } from './testing/mock-host';
export { createTestBuffer } from './testing/test-buffer';
