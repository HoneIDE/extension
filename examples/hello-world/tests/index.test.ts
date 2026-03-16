import { describe, test, expect, beforeEach } from 'bun:test';
import { HelloWorldPlugin } from '../src/index';
import { MockHost } from '../../../sdk/src/testing/mock-host';
import type { PluginCapabilities } from '../../../sdk/src/types/manifest';

const caps: PluginCapabilities = {
  'ui.commandPalette': true,
  'ui.notifications': true,
};

describe('HelloWorldPlugin', () => {
  let host: MockHost;
  let plugin: HelloWorldPlugin;

  beforeEach(() => {
    host = new MockHost(caps);
    plugin = new HelloWorldPlugin(host);
  });

  test('activate registers command', () => {
    plugin.activate();
    expect(host.commands.has('hello-world.greet')).toBe(true);
    expect(host.wasCalled('commandRegister')).toBe(true);
  });

  test('deactivate unregisters command', () => {
    plugin.activate();
    plugin.deactivate();
    expect(host.commands.has('hello-world.greet')).toBe(false);
  });

  test('greet command shows notification', () => {
    plugin.activate();
    plugin.onCommand({ commandId: 'hello-world.greet', args: [] });
    expect(host.notifications.length).toBe(1);
    expect(host.notifications[0].message).toBe('Hello from Hone!');
    expect(host.notifications[0].severity).toBe('info');
  });

  test('unknown command does nothing', () => {
    plugin.activate();
    plugin.onCommand({ commandId: 'other.command', args: [] });
    expect(host.notifications.length).toBe(0);
  });

  test('logs on activate and deactivate', () => {
    plugin.activate();
    plugin.deactivate();
    expect(host.logs.length).toBe(2);
    expect(host.logs[0].level).toBe('info');
    expect(host.logs[1].level).toBe('info');
  });
});
