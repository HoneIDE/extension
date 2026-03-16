/**
 * REST Client — send HTTP requests from .http files, view responses.
 *
 * Parses .http file format:
 *   GET https://api.example.com/users
 *   Authorization: Bearer token123
 *
 *   ###
 *
 *   POST https://api.example.com/users
 *   Content-Type: application/json
 *
 *   {"name": "Alice"}
 */

import { HonePlugin } from '@hone/sdk';
import { HoneHostImpl } from '@hone/sdk';
import type { HoneHost } from '@hone/sdk';
import type { CommandEvent } from '@hone/sdk';

export class RestClientPlugin extends HonePlugin {
  responsePanelId: number = 0;

  constructor(host: HoneHost) { super(host); }

  activate(): void {
    this.host.commandRegister('rest-client.send', 'REST Client: Send Request');
    this.host.commandRegister('rest-client.sendAll', 'REST Client: Send All Requests');
    this.host.log('info', 'REST Client activated');
  }

  deactivate(): void {
    this.host.commandUnregister('rest-client.send');
    this.host.commandUnregister('rest-client.sendAll');
    if (this.responsePanelId > 0) {
      this.host.panelDispose(this.responsePanelId);
    }
  }

  onCommand(event: CommandEvent): void {
    if (event.commandId === 'rest-client.send') {
      sendCurrentRequest(this);
    }
  }
}

/** Parse and send the HTTP request at the cursor position. */
function sendCurrentRequest(plugin: RestClientPlugin): void {
  const bufferId = plugin.host.getActiveBufferId();
  if (bufferId === null) {
    plugin.host.notify({ message: 'No active file', severity: 'warning' });
    return;
  }

  const text = plugin.host.bufferGetText(bufferId);
  if (text.length < 4) return;

  // Parse the first request block
  const request = parseHttpRequest(text);
  if (request === null) {
    plugin.host.notify({ message: 'No valid HTTP request found', severity: 'warning' });
    return;
  }

  // Send via host.httpRequest
  const response = plugin.host.httpRequest({
    url: request.url,
    method: request.method,
    headers: request.headers,
    body: request.body,
  });

  // Show response in a panel
  let panelId = plugin.responsePanelId;
  if (panelId < 1) {
    panelId = plugin.host.panelCreate({
      title: 'REST Response',
      icon: 'network',
      location: 'bottom',
    });
    plugin.responsePanelId = panelId;
  }

  let statusText = String(response.status);
  statusText += ' ';
  statusText += request.method;
  statusText += ' ';
  statusText += request.url;

  plugin.host.panelUpdate(panelId, {
    elements: [
      { type: 'heading', value: statusText, level: 3 },
      { type: 'codeBlock', code: response.body, language: 'json' },
    ],
  });

  plugin.host.notify({
    message: statusText,
    severity: response.status >= 400 ? 'error' : 'info',
  });
}

interface ParsedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
}

/** Parse the first HTTP request from .http file content. */
function parseHttpRequest(text: string): ParsedRequest | null {
  const lines = text.split('\n');
  if (lines.length < 1) return null;

  // First non-empty line should be: METHOD URL
  let methodLine = '';
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.length > 0 && trimmed.charAt(0) !== '#') {
      methodLine = trimmed;
      break;
    }
  }
  if (methodLine.length < 5) return null;

  const spaceIdx = methodLine.indexOf(' ');
  if (spaceIdx < 2) return null;

  const method = methodLine.slice(0, spaceIdx).toUpperCase();
  const url = methodLine.slice(spaceIdx + 1).trim();

  // Parse headers (lines with : after the method line)
  const headers: Record<string, string> = {};
  let bodyStart = -1;
  let foundMethod = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!foundMethod) {
      if (line === methodLine.trim()) foundMethod = true;
      continue;
    }
    if (line.length === 0) {
      bodyStart = i + 1;
      break;
    }
    if (line.indexOf('###') === 0) break;
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim();
      headers[key] = val;
    }
  }

  // Parse body (everything after the blank line until ### or end)
  let body = '';
  if (bodyStart > 0) {
    const bodyLines: string[] = [];
    for (let i = bodyStart; i < lines.length; i++) {
      if (lines[i].trim().indexOf('###') === 0) break;
      bodyLines.push(lines[i]);
    }
    body = bodyLines.join('\n').trim();
  }

  return { method, url, headers, body };
}

let _plugin: RestClientPlugin | null = null;

export function activate(_apiHandle: number): void {
  const host = new HoneHostImpl('rest-client');
  _plugin = new RestClientPlugin(host);
  _plugin.activate();
}

export function deactivate(): void {
  if (_plugin !== null) { _plugin.deactivate(); _plugin = null; }
}

export function onCommand(_eventPtr: number): number {
  if (_plugin !== null) _plugin.onCommand({ commandId: 'rest-client.send', args: [] });
  return 1;
}
