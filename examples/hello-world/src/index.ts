/**
 * Hello World plugin — the simplest possible Hone plugin.
 *
 * Demonstrates: command registration, notification display.
 * Perry-safe: no closures on `this`, no .map(), no string `+`.
 *
 * Plugin entry points:
 * - activate(apiHandle) — called by the host when plugin loads
 * - deactivate()        — called by the host when plugin unloads
 * - onCommand(eventPtr) — hook: called when a registered command is invoked
 */

import { HonePlugin } from '../../../sdk/src/plugin';
import { HoneHostImpl } from '../../../sdk/src/host-impl';
import type { HoneHost } from '../../../sdk/src/host';
import type { CommandEvent } from '../../../sdk/src/types/events';

export class HelloWorldPlugin extends HonePlugin {
  constructor(host: HoneHost) {
    super(host);
  }

  activate(): void {
    this.host.commandRegister('hello-world.greet', 'Hello World: Greet');
    this.host.log('info', 'Hello World plugin activated');
  }

  deactivate(): void {
    this.host.commandUnregister('hello-world.greet');
    this.host.log('info', 'Hello World plugin deactivated');
  }

  onCommand(event: CommandEvent): void {
    if (event.commandId === 'hello-world.greet') {
      this.host.notify({
        message: 'Hello from Hone!',
        severity: 'info',
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Top-level entry points — Perry exports these as symbols in the dylib.
// The host calls activate(apiHandle) via dlsym after dlopen.
// ---------------------------------------------------------------------------

let _plugin: HelloWorldPlugin | null = null;

/** Called by the host. apiHandle is unused (host API is via named FFI symbols). */
export function activate(_apiHandle: number): void {
  const host = new HoneHostImpl('hello-world');
  _plugin = new HelloWorldPlugin(host);
  _plugin.activate();
}

export function deactivate(): void {
  if (_plugin !== null) {
    _plugin.deactivate();
    _plugin = null;
  }
}

/** Hook: command invoked. eventPtr is a Perry StringHeader (JSON). */
export function onCommand(eventPtr: number): number {
  if (_plugin !== null) {
    // Parse the JSON event data from the Perry string pointer
    // For now, pass the commandId directly since the host sends JSON
    _plugin.onCommand({ commandId: 'hello-world.greet', args: [] });
  }
  return 1;
}
