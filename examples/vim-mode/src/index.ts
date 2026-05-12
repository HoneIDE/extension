/**
 * Vim Mode — Vim keybindings for Hone.
 *
 * Provides normal/insert/visual mode keybindings.
 * This is a scaffold — full Vim emulation requires deep editor integration.
 */

import { HonePlugin } from '@honeide/sdk';
import { HoneHostImpl } from '@honeide/sdk';
import type { HoneHost } from '@honeide/sdk';

export class VimModePlugin extends HonePlugin {
  constructor(host: HoneHost) { super(host); }

  activate(): void {
    this.host.commandRegister('vim.toggleMode', 'Vim: Toggle Vim Mode');
    this.host.commandRegister('vim.normalMode', 'Vim: Enter Normal Mode');
    this.host.commandRegister('vim.insertMode', 'Vim: Enter Insert Mode');
    this.host.commandRegister('vim.visualMode', 'Vim: Enter Visual Mode');
    this.host.log('info', 'Vim Mode activated');
    this.host.notify({ message: 'Vim mode enabled', severity: 'info' });
  }

  deactivate(): void {
    this.host.commandUnregister('vim.toggleMode');
    this.host.commandUnregister('vim.normalMode');
    this.host.commandUnregister('vim.insertMode');
    this.host.commandUnregister('vim.visualMode');
  }
}

let _plugin: VimModePlugin | null = null;

export function activate(_apiHandle: number): void {
  const host = new HoneHostImpl('vim-mode');
  _plugin = new VimModePlugin(host);
  _plugin.activate();
}

export function deactivate(): void {
  if (_plugin !== null) { _plugin.deactivate(); _plugin = null; }
}
