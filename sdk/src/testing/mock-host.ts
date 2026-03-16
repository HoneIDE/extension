/**
 * MockHost — in-memory implementation of HoneHost for plugin testing.
 *
 * Perry-safe: uses for-loops, no .map()/.filter()/.reduce(), no closures on `this`.
 * Enforces capability checks — throws if a plugin calls a method not in its manifest.
 */

import type { HoneHost } from '../host';
import type { BufferId, Selection, TextEdit, EditResult } from '../types/editor';
import type { FileStat, FileInfo, FileWatchEvent, WatchHandle } from '../types/filesystem';
import type { SpawnOptions, ChildProcess } from '../types/process';
import type { HttpRequest, HttpResponse } from '../types/network';
import type {
  StatusBarItemId, StatusBarItemOptions,
  PanelId, PanelOptions, PanelContent,
  DecorationTypeId, DecorationTypeOptions, DecorationRange,
  GutterProviderId, GutterProviderOptions, GutterItem,
  ContextMenuId, ContextMenuOptions,
  NotificationOptions,
} from '../types/ui';
import type { PluginCapabilities } from '../types/manifest';

export interface TestBuffer {
  id: BufferId;
  text: string;
  languageId: string;
  filePath: string | null;
  selection: Selection;
  selections: Selection[];
}

export interface MockSpawnResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface MockHttpResult {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export class MockHost implements HoneHost {
  /** All method calls recorded for spy tracking. */
  callLog: string[] = [];

  /** Buffers keyed by ID. */
  private buffers: Map<number, TestBuffer> = new Map();

  /** Plugin config values. */
  private config: Map<string, string | number | boolean> = new Map();

  /** Log messages captured. */
  logs: { level: string; message: string }[] = [];

  /** Files in mock filesystem. */
  private files: Map<string, string> = new Map();

  /** Directories in mock filesystem. */
  private dirs: Set<string> = new Set();

  /** Mock spawn results keyed by command. */
  private spawnResults: Map<string, MockSpawnResult> = new Map();

  /** Mock HTTP responses keyed by URL. */
  private httpResults: Map<string, MockHttpResult> = new Map();

  /** Notifications received. */
  notifications: NotificationOptions[] = [];

  /** Registered commands. */
  commands: Map<string, string> = new Map();

  /** Status bar items. */
  statusBarItems: Map<number, StatusBarItemOptions> = new Map();

  /** Panels. */
  panels: Map<number, { options: PanelOptions; content: PanelContent | null }> = new Map();

  /** Decorations. */
  decorations: Map<number, { options: DecorationTypeOptions; ranges: Map<number, DecorationRange[]> }> = new Map();

  /** Workspace path. */
  private workspacePath: string = '/mock/workspace';

  /** Capabilities for enforcement. */
  private capabilities: PluginCapabilities;

  /** Next ID counters. */
  private nextStatusBarId: number = 1;
  private nextPanelId: number = 1;
  private nextDecorationTypeId: number = 1;
  private nextGutterId: number = 1;
  private nextContextMenuId: number = 1;

  /** Active buffer ID. */
  private activeBufferId: BufferId | null = null;

  constructor(caps: PluginCapabilities) {
    this.capabilities = caps;
  }

  // --- Setup helpers (not part of HoneHost) ---

  addBuffer(buf: TestBuffer): void {
    this.buffers.set(buf.id, buf);
    if (this.activeBufferId === null) {
      this.activeBufferId = buf.id;
    }
  }

  setActiveBuffer(id: BufferId): void {
    this.activeBufferId = id;
  }

  setConfig(key: string, value: string | number | boolean): void {
    this.config.set(key, value);
  }

  setWorkspacePath(path: string): void {
    this.workspacePath = path;
  }

  addFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  addDirectory(path: string): void {
    this.dirs.add(path);
  }

  setSpawnResult(command: string, result: MockSpawnResult): void {
    this.spawnResults.set(command, result);
  }

  setHttpResult(url: string, result: MockHttpResult): void {
    this.httpResults.set(url, result);
  }

  /** Get the call log (for spy assertions). */
  getCalls(): string[] {
    return this.callLog.slice();
  }

  /** Check if a method was called. */
  wasCalled(method: string): boolean {
    for (let i = 0; i < this.callLog.length; i++) {
      if (this.callLog[i] === method) return true;
    }
    return false;
  }

  /** Count how many times a method was called. */
  callCount(method: string): number {
    let count = 0;
    for (let i = 0; i < this.callLog.length; i++) {
      if (this.callLog[i] === method) count++;
    }
    return count;
  }

  /** Reset call log and state. */
  reset(): void {
    this.callLog = [];
    this.logs = [];
    this.notifications = [];
  }

  // --- Capability enforcement ---

  private checkCap(cap: string): void {
    const c = this.capabilities;
    let allowed = false;

    if (cap === 'editor.read') allowed = c['editor.read'] === true;
    else if (cap === 'editor.write') allowed = c['editor.write'] === true;
    else if (cap === 'editor.decorations') allowed = c['editor.decorations'] === true;
    else if (cap === 'filesystem.read') {
      const fr = c['filesystem.read'];
      allowed = fr !== undefined && fr.length > 0;
    }
    else if (cap === 'filesystem.write') allowed = c['filesystem.write'] === true;
    else if (cap === 'process.spawn') {
      const ps = c['process.spawn'];
      allowed = ps !== undefined && ps.length > 0;
    }
    else if (cap === 'network') allowed = c.network === true;
    else if (cap === 'ui.statusbar') allowed = c['ui.statusbar'] === true;
    else if (cap === 'ui.panel') allowed = c['ui.panel'] === true;
    else if (cap === 'ui.gutter') allowed = c['ui.gutter'] === true;
    else if (cap === 'ui.commandPalette') allowed = c['ui.commandPalette'] === true;
    else if (cap === 'ui.contextMenu') allowed = c['ui.contextMenu'] === true;
    else if (cap === 'ui.notifications') allowed = c['ui.notifications'] === true;
    else if (cap === 'ui.webview') allowed = c['ui.webview'] === true;
    else if (cap === 'terminal') allowed = c.terminal === true;

    if (!allowed) {
      throw new Error('Capability not declared: ' + cap);
    }
  }

  // --- HoneHost implementation ---

  log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    this.callLog.push('log');
    this.logs.push({ level: level, message: message });
  }

  getConfig(key: string): string | number | boolean | null {
    this.callLog.push('getConfig');
    const val = this.config.get(key);
    if (val === undefined) return null;
    return val;
  }

  getWorkspacePath(): string {
    this.callLog.push('getWorkspacePath');
    return this.workspacePath;
  }

  // --- editor.read ---

  bufferGetText(bufferId: BufferId): string {
    this.checkCap('editor.read');
    this.callLog.push('bufferGetText');
    const buf = this.buffers.get(bufferId);
    if (!buf) return '';
    return buf.text;
  }

  bufferGetLines(bufferId: BufferId, startLine: number, endLine: number): string[] {
    this.checkCap('editor.read');
    this.callLog.push('bufferGetLines');
    const buf = this.buffers.get(bufferId);
    if (!buf) return [];
    const allLines = buf.text.split('\n');
    const result: string[] = [];
    for (let i = startLine; i < endLine && i < allLines.length; i++) {
      result.push(allLines[i]);
    }
    return result;
  }

  bufferGetSelection(bufferId: BufferId): Selection {
    this.checkCap('editor.read');
    this.callLog.push('bufferGetSelection');
    const buf = this.buffers.get(bufferId);
    if (!buf) return { anchor: { line: 0, column: 0 }, head: { line: 0, column: 0 } };
    return buf.selection;
  }

  bufferGetSelections(bufferId: BufferId): Selection[] {
    this.checkCap('editor.read');
    this.callLog.push('bufferGetSelections');
    const buf = this.buffers.get(bufferId);
    if (!buf) return [];
    return buf.selections;
  }

  bufferGetLanguageId(bufferId: BufferId): string {
    this.checkCap('editor.read');
    this.callLog.push('bufferGetLanguageId');
    const buf = this.buffers.get(bufferId);
    if (!buf) return '';
    return buf.languageId;
  }

  bufferGetFilePath(bufferId: BufferId): string | null {
    this.checkCap('editor.read');
    this.callLog.push('bufferGetFilePath');
    const buf = this.buffers.get(bufferId);
    if (!buf) return null;
    return buf.filePath;
  }

  bufferGetLineCount(bufferId: BufferId): number {
    this.checkCap('editor.read');
    this.callLog.push('bufferGetLineCount');
    const buf = this.buffers.get(bufferId);
    if (!buf) return 0;
    return buf.text.split('\n').length;
  }

  getActiveBufferId(): BufferId | null {
    this.checkCap('editor.read');
    this.callLog.push('getActiveBufferId');
    return this.activeBufferId;
  }

  getOpenBufferIds(): BufferId[] {
    this.checkCap('editor.read');
    this.callLog.push('getOpenBufferIds');
    const ids: BufferId[] = [];
    const keys = Array.from(this.buffers.keys());
    for (let i = 0; i < keys.length; i++) {
      ids.push(keys[i]);
    }
    return ids;
  }

  // --- editor.write ---

  bufferSubmitEdits(bufferId: BufferId, edits: TextEdit[]): EditResult {
    this.checkCap('editor.write');
    this.callLog.push('bufferSubmitEdits');
    const buf = this.buffers.get(bufferId);
    if (!buf) return { applied: false, pendingReview: false };

    // Apply edits in reverse order (to preserve positions)
    const sorted: TextEdit[] = [];
    for (let i = 0; i < edits.length; i++) {
      sorted.push(edits[i]);
    }
    // Sort by start position descending
    for (let i = 0; i < sorted.length - 1; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i];
        const b = sorted[j];
        if (b.range.start.line > a.range.start.line ||
            (b.range.start.line === a.range.start.line && b.range.start.column > a.range.start.column)) {
          sorted[i] = b;
          sorted[j] = a;
        }
      }
    }

    let text = buf.text;
    for (let i = 0; i < sorted.length; i++) {
      const edit = sorted[i];
      const lines = text.split('\n');
      const startOffset = lineColToOffset(lines, edit.range.start.line, edit.range.start.column);
      const endOffset = lineColToOffset(lines, edit.range.end.line, edit.range.end.column);
      text = text.slice(0, startOffset) + edit.newText + text.slice(endOffset);
    }
    buf.text = text;

    return { applied: true, pendingReview: false };
  }

  bufferSetSelection(bufferId: BufferId, selection: Selection): void {
    this.checkCap('editor.write');
    this.callLog.push('bufferSetSelection');
    const buf = this.buffers.get(bufferId);
    if (buf) {
      buf.selection = selection;
      buf.selections = [selection];
    }
  }

  bufferSetSelections(bufferId: BufferId, selections: Selection[]): void {
    this.checkCap('editor.write');
    this.callLog.push('bufferSetSelections');
    const buf = this.buffers.get(bufferId);
    if (buf) {
      buf.selections = selections;
      if (selections.length > 0) {
        buf.selection = selections[0];
      }
    }
  }

  // --- editor.decorations ---

  createDecorationType(options: DecorationTypeOptions): DecorationTypeId {
    this.checkCap('editor.decorations');
    this.callLog.push('createDecorationType');
    const id = this.nextDecorationTypeId;
    this.nextDecorationTypeId++;
    this.decorations.set(id, { options: options, ranges: new Map() });
    return id;
  }

  setDecorations(bufferId: BufferId, typeId: DecorationTypeId, ranges: DecorationRange[]): void {
    this.checkCap('editor.decorations');
    this.callLog.push('setDecorations');
    const dec = this.decorations.get(typeId);
    if (dec) {
      dec.ranges.set(bufferId, ranges);
    }
  }

  clearDecorations(typeId: DecorationTypeId): void {
    this.checkCap('editor.decorations');
    this.callLog.push('clearDecorations');
    const dec = this.decorations.get(typeId);
    if (dec) {
      dec.ranges.clear();
    }
  }

  // --- filesystem.read ---

  fileReadText(path: string): string {
    this.checkCap('filesystem.read');
    this.callLog.push('fileReadText');
    const content = this.files.get(path);
    if (content === undefined) throw new Error('File not found: ' + path);
    return content;
  }

  fileExists(path: string): boolean {
    this.checkCap('filesystem.read');
    this.callLog.push('fileExists');
    return this.files.has(path) || this.dirs.has(path);
  }

  fileStat(path: string): FileStat {
    this.checkCap('filesystem.read');
    this.callLog.push('fileStat');
    if (this.dirs.has(path)) {
      return { size: 0, isFile: false, isDirectory: true, createdAt: 0, modifiedAt: 0 };
    }
    const content = this.files.get(path);
    if (content === undefined) throw new Error('Path not found: ' + path);
    return { size: content.length, isFile: true, isDirectory: false, createdAt: 0, modifiedAt: 0 };
  }

  directoryList(path: string, _pattern?: string): FileInfo[] {
    this.checkCap('filesystem.read');
    this.callLog.push('directoryList');
    const result: FileInfo[] = [];
    const prefix = path.endsWith('/') ? path : path + '/';

    // Check files
    const fileKeys = Array.from(this.files.keys());
    for (let i = 0; i < fileKeys.length; i++) {
      const fp = fileKeys[i];
      if (fp.indexOf(prefix) === 0) {
        const rest = fp.slice(prefix.length);
        if (rest.indexOf('/') === -1) {
          result.push({ name: rest, path: fp, isDirectory: false });
        }
      }
    }

    // Check dirs
    const dirKeys = Array.from(this.dirs);
    for (let i = 0; i < dirKeys.length; i++) {
      const dp = dirKeys[i];
      if (dp.indexOf(prefix) === 0) {
        const rest = dp.slice(prefix.length);
        if (rest.indexOf('/') === -1 && rest.length > 0) {
          result.push({ name: rest, path: dp, isDirectory: true });
        }
      }
    }

    return result;
  }

  fileWatch(_pattern: string, _callback: (event: FileWatchEvent) => void): WatchHandle {
    this.checkCap('filesystem.read');
    this.callLog.push('fileWatch');
    return { dispose(): void {} };
  }

  // --- filesystem.write ---

  fileWriteText(path: string, content: string): void {
    this.checkCap('filesystem.write');
    this.callLog.push('fileWriteText');
    this.files.set(path, content);
  }

  fileDelete(path: string): void {
    this.checkCap('filesystem.write');
    this.callLog.push('fileDelete');
    this.files.delete(path);
    this.dirs.delete(path);
  }

  directoryCreate(path: string, _recursive?: boolean): void {
    this.checkCap('filesystem.write');
    this.callLog.push('directoryCreate');
    this.dirs.add(path);
  }

  // --- process.spawn ---

  spawn(command: string, args: string[], _options?: SpawnOptions): ChildProcess {
    this.checkCap('process.spawn');
    this.callLog.push('spawn');

    // Check allowlist
    const allowedBins = this.capabilities['process.spawn'];
    if (allowedBins) {
      let found = false;
      for (let i = 0; i < allowedBins.length; i++) {
        if (allowedBins[i] === command) {
          found = true;
          break;
        }
      }
      if (!found) {
        throw new Error('Binary not in allowlist: ' + command);
      }
    }

    const result = this.spawnResults.get(command);
    if (result) {
      return { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr };
    }
    return { exitCode: 0, stdout: '', stderr: '' };
  }

  // --- network ---

  httpRequest(request: HttpRequest): HttpResponse {
    this.checkCap('network');
    this.callLog.push('httpRequest');
    const result = this.httpResults.get(request.url);
    if (result) {
      return { status: result.status, headers: result.headers, body: result.body };
    }
    return { status: 404, headers: {}, body: '' };
  }

  // --- ui.statusbar ---

  statusBarCreateItem(options: StatusBarItemOptions): StatusBarItemId {
    this.checkCap('ui.statusbar');
    this.callLog.push('statusBarCreateItem');
    const id = this.nextStatusBarId;
    this.nextStatusBarId++;
    this.statusBarItems.set(id, options);
    return id;
  }

  statusBarUpdateItem(id: StatusBarItemId, options: StatusBarItemOptions): void {
    this.checkCap('ui.statusbar');
    this.callLog.push('statusBarUpdateItem');
    this.statusBarItems.set(id, options);
  }

  statusBarRemoveItem(id: StatusBarItemId): void {
    this.checkCap('ui.statusbar');
    this.callLog.push('statusBarRemoveItem');
    this.statusBarItems.delete(id);
  }

  // --- ui.panel ---

  panelCreate(options: PanelOptions): PanelId {
    this.checkCap('ui.panel');
    this.callLog.push('panelCreate');
    const id = this.nextPanelId;
    this.nextPanelId++;
    this.panels.set(id, { options: options, content: null });
    return id;
  }

  panelUpdate(id: PanelId, content: PanelContent): void {
    this.checkCap('ui.panel');
    this.callLog.push('panelUpdate');
    const panel = this.panels.get(id);
    if (panel) {
      panel.content = content;
    }
  }

  panelDispose(id: PanelId): void {
    this.checkCap('ui.panel');
    this.callLog.push('panelDispose');
    this.panels.delete(id);
  }

  // --- ui.gutter ---

  gutterCreateProvider(options: GutterProviderOptions): GutterProviderId {
    this.checkCap('ui.gutter');
    this.callLog.push('gutterCreateProvider');
    const id = this.nextGutterId;
    this.nextGutterId++;
    return id;
  }

  gutterUpdate(_id: GutterProviderId, _items: GutterItem[]): void {
    this.checkCap('ui.gutter');
    this.callLog.push('gutterUpdate');
  }

  // --- ui.commandPalette ---

  commandRegister(id: string, title: string): void {
    this.checkCap('ui.commandPalette');
    this.callLog.push('commandRegister');
    this.commands.set(id, title);
  }

  commandUnregister(id: string): void {
    this.checkCap('ui.commandPalette');
    this.callLog.push('commandUnregister');
    this.commands.delete(id);
  }

  // --- ui.contextMenu ---

  contextMenuRegister(options: ContextMenuOptions): ContextMenuId {
    this.checkCap('ui.contextMenu');
    this.callLog.push('contextMenuRegister');
    const id = this.nextContextMenuId;
    this.nextContextMenuId++;
    return id;
  }

  contextMenuUnregister(_id: ContextMenuId): void {
    this.checkCap('ui.contextMenu');
    this.callLog.push('contextMenuUnregister');
  }

  // --- ui.notifications ---

  notify(options: NotificationOptions): void {
    this.checkCap('ui.notifications');
    this.callLog.push('notify');
    this.notifications.push(options);
  }
}

/** Convert line/column to a character offset in text. */
function lineColToOffset(lines: string[], line: number, col: number): number {
  let offset = 0;
  for (let i = 0; i < line && i < lines.length; i++) {
    offset += lines[i].length + 1; // +1 for \n
  }
  return offset + col;
}
