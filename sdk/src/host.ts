/**
 * HoneHost — interface for the host API provided to plugins.
 *
 * Methods are grouped by capability. The host only provides methods
 * matching the plugin's declared capabilities. Calling an unlinked
 * method throws at runtime (or is null in the C ABI struct).
 *
 * Perry-safe: no overloads, no complex generics.
 */

import type { BufferId, Selection, TextEdit, EditResult } from './types/editor';
import type { FileStat, FileInfo, FileWatchEvent, WatchHandle } from './types/filesystem';
import type { SpawnOptions, ChildProcess } from './types/process';
import type { HttpRequest, HttpResponse } from './types/network';
import type {
  StatusBarItemId, StatusBarItemOptions,
  PanelId, PanelOptions, PanelContent,
  DecorationTypeId, DecorationTypeOptions, DecorationRange,
  GutterProviderId, GutterProviderOptions, GutterItem,
  ContextMenuId, ContextMenuOptions,
  NotificationOptions,
} from './types/ui';

export interface HoneHost {
  // --- Always available ---

  /** Log a message (visible in plugin dev console). */
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void;

  /** Read a plugin config value by key. */
  getConfig(key: string): string | number | boolean | null;

  /** Get the current workspace root path. */
  getWorkspacePath(): string;

  // --- editor.read ---

  /** Get the full text of a buffer. */
  bufferGetText(bufferId: BufferId): string;

  /** Get lines from a buffer (startLine inclusive, endLine exclusive). */
  bufferGetLines(bufferId: BufferId, startLine: number, endLine: number): string[];

  /** Get the primary selection of a buffer. */
  bufferGetSelection(bufferId: BufferId): Selection;

  /** Get all selections of a buffer. */
  bufferGetSelections(bufferId: BufferId): Selection[];

  /** Get the language ID of a buffer. */
  bufferGetLanguageId(bufferId: BufferId): string;

  /** Get the file path of a buffer (null if untitled). */
  bufferGetFilePath(bufferId: BufferId): string | null;

  /** Get the total number of lines in a buffer. */
  bufferGetLineCount(bufferId: BufferId): number;

  /** Get the active buffer ID (null if none). */
  getActiveBufferId(): BufferId | null;

  /** Get all open buffer IDs. */
  getOpenBufferIds(): BufferId[];

  // --- editor.write ---

  /** Submit edits to a buffer. Goes through the Changes Queue. */
  bufferSubmitEdits(bufferId: BufferId, edits: TextEdit[]): EditResult;

  /** Set the primary selection of a buffer. */
  bufferSetSelection(bufferId: BufferId, selection: Selection): void;

  /** Set all selections of a buffer. */
  bufferSetSelections(bufferId: BufferId, selections: Selection[]): void;

  // --- editor.decorations ---

  /** Create a decoration type (underline, highlight, gutter icon). */
  createDecorationType(options: DecorationTypeOptions): DecorationTypeId;

  /** Set decorations on a buffer for a given type. */
  setDecorations(bufferId: BufferId, typeId: DecorationTypeId, ranges: DecorationRange[]): void;

  /** Clear all decorations for a type. */
  clearDecorations(typeId: DecorationTypeId): void;

  // --- filesystem.read ---

  /** Read a file as a UTF-8 string. */
  fileReadText(path: string): string;

  /** Check if a file or directory exists. */
  fileExists(path: string): boolean;

  /** Get file/directory stats. */
  fileStat(path: string): FileStat;

  /** List directory entries, optionally filtered by glob pattern. */
  directoryList(path: string, pattern?: string): FileInfo[];

  /** Watch files matching a pattern. */
  fileWatch(pattern: string, callback: (event: FileWatchEvent) => void): WatchHandle;

  // --- filesystem.write ---

  /** Write a UTF-8 string to a file. */
  fileWriteText(path: string, content: string): void;

  /** Delete a file. */
  fileDelete(path: string): void;

  /** Create a directory (optionally recursive). */
  directoryCreate(path: string, recursive?: boolean): void;

  // --- process.spawn ---

  /** Spawn an external process. Only allowlisted binaries. */
  spawn(command: string, args: string[], options?: SpawnOptions): ChildProcess;

  // --- network ---

  /** Make an HTTP request. */
  httpRequest(request: HttpRequest): HttpResponse;

  // --- ui.statusbar ---

  /** Create a status bar item. Returns its ID. */
  statusBarCreateItem(options: StatusBarItemOptions): StatusBarItemId;

  /** Update a status bar item. */
  statusBarUpdateItem(id: StatusBarItemId, options: StatusBarItemOptions): void;

  /** Remove a status bar item. */
  statusBarRemoveItem(id: StatusBarItemId): void;

  // --- ui.panel ---

  /** Create a side panel. */
  panelCreate(options: PanelOptions): PanelId;

  /** Update panel content. */
  panelUpdate(id: PanelId, content: PanelContent): void;

  /** Dispose a panel. */
  panelDispose(id: PanelId): void;

  // --- ui.gutter ---

  /** Register a gutter icon provider. */
  gutterCreateProvider(options: GutterProviderOptions): GutterProviderId;

  /** Update gutter items. */
  gutterUpdate(id: GutterProviderId, items: GutterItem[]): void;

  // --- ui.commandPalette ---

  /** Register a command (callable from Cmd+Shift+P). */
  commandRegister(id: string, title: string): void;

  /** Unregister a command. */
  commandUnregister(id: string): void;

  // --- ui.contextMenu ---

  /** Register a context menu item. */
  contextMenuRegister(options: ContextMenuOptions): ContextMenuId;

  /** Unregister a context menu item. */
  contextMenuUnregister(id: ContextMenuId): void;

  // --- ui.notifications ---

  /** Show a notification. */
  notify(options: NotificationOptions): void;
}
