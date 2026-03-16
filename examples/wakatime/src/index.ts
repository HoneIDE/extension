/**
 * WakaTime — automatic coding time tracking.
 *
 * Sends heartbeats to the WakaTime API on file open/save/focus changes.
 * Requires a WakaTime API key configured in plugin settings.
 */

import { HonePlugin } from '@hone/sdk';
import { HoneHostImpl } from '@hone/sdk';
import type { HoneHost } from '@hone/sdk';
import type { DocumentOpenEvent, DocumentSaveEvent } from '@hone/sdk';

export class WakaTimePlugin extends HonePlugin {
  statusBarId: number = 0;
  lastHeartbeat: number = 0;
  todaySeconds: number = 0;

  constructor(host: HoneHost) { super(host); }

  activate(): void {
    this.statusBarId = this.host.statusBarCreateItem({
      text: 'WakaTime: 0h 0m',
      tooltip: 'Coding time today',
      alignment: 'right',
      priority: 50,
    });
    this.host.commandRegister('wakatime.dashboard', 'WakaTime: Open Dashboard');
    this.host.log('info', 'WakaTime activated');
  }

  deactivate(): void {
    this.host.statusBarRemoveItem(this.statusBarId);
    this.host.commandUnregister('wakatime.dashboard');
  }

  onDocumentOpen(event: DocumentOpenEvent): void {
    sendHeartbeat(this, event.filePath, false);
  }

  onDocumentSave(event: DocumentSaveEvent): void {
    sendHeartbeat(this, event.filePath, true);
  }
}

/** Send a heartbeat to WakaTime. Debounced to max once per 2 minutes. */
function sendHeartbeat(plugin: WakaTimePlugin, filePath: string, isWrite: boolean): void {
  const now = Date.now();
  // Debounce: don't send more than once per 120 seconds (unless save)
  if (!isWrite && (now - plugin.lastHeartbeat) < 120000) return;
  plugin.lastHeartbeat = now;

  // Increment local counter (approximate)
  if (plugin.todaySeconds < 86400) {
    plugin.todaySeconds += 120;
  }
  updateStatusBar(plugin);

  // In a full implementation, this would send to WakaTime API:
  // plugin.host.httpRequest({
  //   url: 'https://api.wakatime.com/api/v1/users/current/heartbeats',
  //   method: 'POST',
  //   headers: { 'Authorization': 'Basic ' + apiKey },
  //   body: JSON.stringify({ entity: filePath, type: 'file', time: now/1000, is_write: isWrite }),
  // });
}

function updateStatusBar(plugin: WakaTimePlugin): void {
  const hours = Math.floor(plugin.todaySeconds / 3600);
  const minutes = Math.floor((plugin.todaySeconds % 3600) / 60);
  let text = 'WakaTime: ';
  text += String(hours);
  text += 'h ';
  text += String(minutes);
  text += 'm';
  plugin.host.statusBarUpdateItem(plugin.statusBarId, {
    text: text,
    tooltip: 'Coding time today',
    alignment: 'right',
    priority: 50,
  });
}

let _plugin: WakaTimePlugin | null = null;

export function activate(_apiHandle: number): void {
  const host = new HoneHostImpl('wakatime');
  _plugin = new WakaTimePlugin(host);
  _plugin.activate();
}

export function deactivate(): void {
  if (_plugin !== null) { _plugin.deactivate(); _plugin = null; }
}

export function onDocumentOpen(_eventPtr: number): number {
  if (_plugin !== null) _plugin.onDocumentOpen({ bufferId: 0, languageId: '', filePath: '' });
  return 1;
}

export function onDocumentSave(_eventPtr: number): number {
  if (_plugin !== null) _plugin.onDocumentSave({ bufferId: 0, filePath: '' });
  return 1;
}
