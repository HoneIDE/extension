/**
 * JetBrains Keymap — IntelliJ/WebStorm keybindings for Hone.
 */
import { HonePlugin } from '@honeide/sdk';
import { HoneHostImpl } from '@honeide/sdk';
import type { HoneHost } from '@honeide/sdk';

export class JetBrainsKeymapPlugin extends HonePlugin {
  constructor(host: HoneHost) { super(host); }
  activate(): void {
    this.host.commandRegister('jetbrains.toggleMode', 'JetBrains: Toggle JetBrains Keymap');
    this.host.log('info', 'JetBrains keymap activated');
  }
  deactivate(): void {
    this.host.commandUnregister('jetbrains.toggleMode');
  }
}

let _plugin: JetBrainsKeymapPlugin | null = null;
export function activate(_apiHandle: number): void {
  const host = new HoneHostImpl('jetbrains-keymap');
  _plugin = new JetBrainsKeymapPlugin(host);
  _plugin.activate();
}
export function deactivate(): void {
  if (_plugin !== null) { _plugin.deactivate(); _plugin = null; }
}
