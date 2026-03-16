/**
 * Bookmarks — mark lines, jump between bookmarks.
 */

import { HonePlugin } from '@hone/sdk';
import { HoneHostImpl } from '@hone/sdk';
import type { HoneHost } from '@hone/sdk';
import type { CommandEvent } from '@hone/sdk';

/** A bookmark entry. */
interface Bookmark {
  file: string;
  line: number;
  label: string;
}

export class BookmarksPlugin extends HonePlugin {
  bookmarks: Bookmark[] = [];
  statusBarId: number = 0;
  currentIndex: number = 0;

  constructor(host: HoneHost) { super(host); }

  activate(): void {
    this.host.commandRegister('bookmarks.toggle', 'Bookmarks: Toggle Bookmark');
    this.host.commandRegister('bookmarks.next', 'Bookmarks: Next Bookmark');
    this.host.commandRegister('bookmarks.prev', 'Bookmarks: Previous Bookmark');
    this.host.commandRegister('bookmarks.clear', 'Bookmarks: Clear All');
    this.host.commandRegister('bookmarks.list', 'Bookmarks: List All');

    this.statusBarId = this.host.statusBarCreateItem({
      text: 'Bookmarks: 0',
      tooltip: 'Bookmark count',
      alignment: 'right',
      priority: 90,
    });

    this.host.log('info', 'Bookmarks activated');
  }

  deactivate(): void {
    this.host.commandUnregister('bookmarks.toggle');
    this.host.commandUnregister('bookmarks.next');
    this.host.commandUnregister('bookmarks.prev');
    this.host.commandUnregister('bookmarks.clear');
    this.host.commandUnregister('bookmarks.list');
    this.host.statusBarRemoveItem(this.statusBarId);
  }

  onCommand(event: CommandEvent): void {
    if (event.commandId === 'bookmarks.clear') {
      clearBookmarks(this);
    }
  }
}

function clearBookmarks(plugin: BookmarksPlugin): void {
  plugin.bookmarks = [];
  plugin.currentIndex = 0;
  updateStatusBar(plugin);
  plugin.host.notify({ message: 'All bookmarks cleared', severity: 'info' });
}

function updateStatusBar(plugin: BookmarksPlugin): void {
  let label = 'Bookmarks: ';
  label += String(plugin.bookmarks.length);
  plugin.host.statusBarUpdateItem(plugin.statusBarId, {
    text: label,
    tooltip: 'Bookmark count',
    alignment: 'right',
    priority: 90,
  });
}

let _plugin: BookmarksPlugin | null = null;

export function activate(_apiHandle: number): void {
  const host = new HoneHostImpl('bookmarks');
  _plugin = new BookmarksPlugin(host);
  _plugin.activate();
}

export function deactivate(): void {
  if (_plugin !== null) { _plugin.deactivate(); _plugin = null; }
}

export function onCommand(_eventPtr: number): number {
  if (_plugin !== null) _plugin.onCommand({ commandId: 'bookmarks.clear', args: [] });
  return 1;
}
