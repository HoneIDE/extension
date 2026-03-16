/**
 * Sublime Text Keymap — Sublime keybindings for Hone.
 */
import { HonePlugin } from '@hone/sdk';
import { HoneHostImpl } from '@hone/sdk';
import type { HoneHost } from '@hone/sdk';

export class SublimeKeymapPlugin extends HonePlugin {
  constructor(host: HoneHost) { super(host); }
  activate(): void {
    this.host.commandRegister('sublime.toggleMode', 'Sublime: Toggle Sublime Keymap');
    this.host.log('info', 'Sublime keymap activated');
  }
  deactivate(): void {
    this.host.commandUnregister('sublime.toggleMode');
  }
}

let _plugin: SublimeKeymapPlugin | null = null;
export function activate(_apiHandle: number): void {
  const host = new HoneHostImpl('sublime-keymap');
  _plugin = new SublimeKeymapPlugin(host);
  _plugin.activate();
}
export function deactivate(): void {
  if (_plugin !== null) { _plugin.deactivate(); _plugin = null; }
}
