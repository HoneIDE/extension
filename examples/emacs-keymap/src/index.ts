/**
 * Emacs Keymap — Emacs keybindings for Hone.
 */
import { HonePlugin } from '@honeide/sdk';
import { HoneHostImpl } from '@honeide/sdk';
import type { HoneHost } from '@honeide/sdk';

export class EmacsKeymapPlugin extends HonePlugin {
  constructor(host: HoneHost) { super(host); }
  activate(): void {
    this.host.commandRegister('emacs.toggleMode', 'Emacs: Toggle Emacs Mode');
    this.host.log('info', 'Emacs keymap activated');
  }
  deactivate(): void {
    this.host.commandUnregister('emacs.toggleMode');
  }
}

let _plugin: EmacsKeymapPlugin | null = null;
export function activate(_apiHandle: number): void {
  const host = new HoneHostImpl('emacs-keymap');
  _plugin = new EmacsKeymapPlugin(host);
  _plugin.activate();
}
export function deactivate(): void {
  if (_plugin !== null) { _plugin.deactivate(); _plugin = null; }
}
