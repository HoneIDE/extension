/**
 * HoneHostImpl — concrete implementation of HoneHost for Perry-compiled plugins.
 *
 * Wraps the host API FFI functions so plugins can call back into the IDE.
 * Each method forwards to a `hone_host_api_*` C function that's resolved
 * at dlopen time from the main hone-ide binary.
 *
 * Perry-safe: plain field access, no closures on `this`, no string `+`.
 */

import { PLUGINS_LIVE } from '@honeide/plugins/perry/live';
import type { HoneHost } from './host';
import type { NotificationOptions, StatusBarItemOptions, StatusBarItemId } from './types/ui';

// Trigger FFI discovery
const _live = PLUGINS_LIVE;

// FFI declarations — resolved by Perry from @honeide/plugins package.json manifest.
// These symbols live in the main hone-ide binary (hone-plugin-host static lib).
declare function hone_host_api_log(level: number, msg: number): void;
declare function hone_host_api_notify(pluginName: number, message: number, severity: number): void;
declare function hone_host_api_command_register(pluginName: number, id: number, title: number): void;
declare function hone_host_api_command_unregister(id: number): void;
declare function hone_host_api_statusbar_create(pluginName: number, text: number, tooltip: number, alignment: number, priority: number, commandId: number): number;
declare function hone_host_api_statusbar_update(handle: number, text: number, tooltip: number): void;
declare function hone_host_api_statusbar_remove(handle: number): void;

/**
 * Concrete HoneHost implementation that calls into the IDE via FFI.
 *
 * Usage in plugin entry:
 * ```
 * const host = new HoneHostImpl('my-plugin');
 * const plugin = new MyPlugin(host);
 * plugin.activate();
 * ```
 */
export class HoneHostImpl {
  pluginName: string;

  constructor(pluginName: string) {
    this.pluginName = pluginName;
  }

  // --- Always available ---

  log(level: string, message: string): void {
    // Map level string to number: 'd'=0, 'i'=1, 'w'=2, 'e'=3
    let levelNum = 1;
    if (level.length > 0) {
      const ch = level.charCodeAt(0);
      if (ch === 100) levelNum = 0; // 'd'ebug
      if (ch === 119) levelNum = 2; // 'w'arn
      if (ch === 101) levelNum = 3; // 'e'rror
    }
    hone_host_api_log(levelNum, message as any);
  }

  getConfig(_key: string): null {
    return null;
  }

  getWorkspacePath(): string {
    return '';
  }

  // --- ui.commandPalette ---

  commandRegister(id: string, title: string): void {
    hone_host_api_command_register(this.pluginName as any, id as any, title as any);
  }

  commandUnregister(id: string): void {
    hone_host_api_command_unregister(id as any);
  }

  // --- ui.notifications ---

  notify(options: NotificationOptions): void {
    const sev = options.severity || 'info';
    hone_host_api_notify(this.pluginName as any, options.message as any, sev as any);
  }

  // --- ui.statusbar ---

  statusBarCreateItem(options: StatusBarItemOptions): StatusBarItemId {
    const tooltip = options.tooltip || '';
    const alignment = options.alignment || 'right';
    const priority = options.priority || 0;
    const commandId = options.commandId || '';
    return hone_host_api_statusbar_create(
      this.pluginName as any,
      options.text as any,
      tooltip as any,
      alignment as any,
      priority,
      commandId as any,
    );
  }

  statusBarUpdateItem(id: StatusBarItemId, options: StatusBarItemOptions): void {
    const tooltip = options.tooltip || '';
    hone_host_api_statusbar_update(id, options.text as any, tooltip as any);
  }

  statusBarRemoveItem(id: StatusBarItemId): void {
    hone_host_api_statusbar_remove(id);
  }

  // --- Stubs for capabilities not yet wired ---
  // These return safe defaults. Plugins with these capabilities will get
  // real implementations when editor.read/write FFI is wired.

  bufferGetText(_bufferId: number): string { return ''; }
  bufferGetLines(_bufferId: number, _start: number, _end: number): string[] { return []; }
  bufferGetSelection(_bufferId: number): any { return { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } }; }
  bufferGetSelections(_bufferId: number): any[] { return []; }
  bufferGetLanguageId(_bufferId: number): string { return ''; }
  bufferGetFilePath(_bufferId: number): null { return null; }
  bufferGetLineCount(_bufferId: number): number { return 0; }
  getActiveBufferId(): null { return null; }
  getOpenBufferIds(): number[] { return []; }
  bufferSubmitEdits(_bufferId: number, _edits: any[]): any { return { applied: false, editCount: 0 }; }
  bufferSetSelection(_bufferId: number, _sel: any): void {}
  bufferSetSelections(_bufferId: number, _sels: any[]): void {}
  createDecorationType(_opts: any): number { return 0; }
  setDecorations(_bufferId: number, _typeId: number, _ranges: any[]): void {}
  clearDecorations(_typeId: number): void {}
  fileReadText(_path: string): string { return ''; }
  fileExists(_path: string): boolean { return false; }
  fileStat(_path: string): any { return {}; }
  directoryList(_path: string, _pattern?: string): any[] { return []; }
  fileWatch(_pattern: string, _cb: any): any { return { dispose(): void {} }; }
  fileWriteText(_path: string, _content: string): void {}
  fileDelete(_path: string): void {}
  directoryCreate(_path: string, _recursive?: boolean): void {}
  spawn(_cmd: string, _args: string[], _opts?: any): any { return {}; }
  httpRequest(_req: any): any { return { status: 0, body: '' }; }
  panelCreate(_opts: any): number { return 0; }
  panelUpdate(_id: number, _content: any): void {}
  panelDispose(_id: number): void {}
  gutterCreateProvider(_opts: any): number { return 0; }
  gutterUpdate(_id: number, _items: any[]): void {}
  contextMenuRegister(_opts: any): number { return 0; }
  contextMenuUnregister(_id: number): void {}
}
