/**
 * Tests for declarative UI element types and Changes Queue integration.
 *
 * Verifies PanelElement creation patterns and ChangeSource tagging.
 */
import { describe, test, expect } from 'bun:test';
import type {
  PanelElement, TextElement, HeadingElement, ListElement,
  ButtonElement, SeparatorElement, ProgressElement, CodeBlockElement,
  InputElement, GroupElement, TreeNode, TableColumn, TableRow,
  StatusBarItemOptions, DecorationTypeOptions, DecorationRange,
  NotificationOptions, ContextMenuOptions, PanelOptions, PanelContent,
  ChangeSource, TrustLevel,
} from '../src/index';

describe('PanelElement creation', () => {
  test('text element', () => {
    const el: PanelElement = { type: 'text', value: 'Hello' };
    expect(el.type).toBe('text');
    expect((el as TextElement).value).toBe('Hello');
  });

  test('text element with style', () => {
    const el: PanelElement = {
      type: 'text',
      value: 'Bold text',
      style: { bold: true, color: '#FF0000', fontSize: 16 },
    };
    expect(el.type).toBe('text');
    expect((el as TextElement).style!.bold).toBe(true);
  });

  test('heading element', () => {
    const el: PanelElement = { type: 'heading', value: 'Title', level: 1 };
    expect((el as HeadingElement).level).toBe(1);
  });

  test('list element', () => {
    const el: PanelElement = {
      type: 'list',
      items: [{ text: 'Item 1' }, { text: 'Item 2', icon: 'star' }],
      ordered: true,
    };
    expect((el as ListElement).items.length).toBe(2);
    expect((el as ListElement).ordered).toBe(true);
  });

  test('tree element', () => {
    const root: TreeNode = {
      label: 'Root',
      children: [
        { label: 'Child 1', expanded: true },
        { label: 'Child 2', children: [{ label: 'Grandchild' }] },
      ],
    };
    const el: PanelElement = { type: 'tree', roots: [root] };
    expect(el.type).toBe('tree');
  });

  test('table element', () => {
    const cols: TableColumn[] = [{ label: 'Name' }, { label: 'Value', width: 100 }];
    const rows: TableRow[] = [{ cells: ['key', 'val'] }];
    const el: PanelElement = { type: 'table', columns: cols, rows: rows };
    expect(el.type).toBe('table');
  });

  test('button element', () => {
    const el: PanelElement = { type: 'button', label: 'Click me', variant: 'primary', commandId: 'my.cmd' };
    expect((el as ButtonElement).variant).toBe('primary');
  });

  test('separator element', () => {
    const el: PanelElement = { type: 'separator' };
    expect(el.type).toBe('separator');
  });

  test('progress element', () => {
    const el: PanelElement = { type: 'progress', value: 75, max: 100, label: 'Loading...' };
    expect((el as ProgressElement).value).toBe(75);
    expect((el as ProgressElement).max).toBe(100);
  });

  test('code block element', () => {
    const el: PanelElement = { type: 'codeBlock', code: 'const x = 1;', language: 'typescript' };
    expect((el as CodeBlockElement).language).toBe('typescript');
  });

  test('input element', () => {
    const el: PanelElement = { type: 'input', id: 'search', placeholder: 'Search...' };
    expect((el as InputElement).id).toBe('search');
  });

  test('group element (row)', () => {
    const el: PanelElement = {
      type: 'group',
      direction: 'row',
      gap: 8,
      children: [
        { type: 'text', value: 'Left' },
        { type: 'text', value: 'Right' },
      ],
    };
    expect((el as GroupElement).children.length).toBe(2);
    expect((el as GroupElement).direction).toBe('row');
  });

  test('nested groups', () => {
    const el: PanelElement = {
      type: 'group',
      direction: 'column',
      children: [
        { type: 'heading', value: 'Section', level: 2 },
        {
          type: 'group',
          direction: 'row',
          children: [
            { type: 'button', label: 'OK', variant: 'primary' },
            { type: 'button', label: 'Cancel', variant: 'secondary' },
          ],
        },
      ],
    };
    const outer = el as GroupElement;
    expect(outer.children.length).toBe(2);
    const inner = outer.children[1] as GroupElement;
    expect(inner.children.length).toBe(2);
  });
});

describe('StatusBar options', () => {
  test('create options', () => {
    const opts: StatusBarItemOptions = {
      text: 'Words: 42',
      tooltip: 'Word count',
      alignment: 'right',
      priority: 100,
      commandId: 'wordcount.show',
    };
    expect(opts.text).toBe('Words: 42');
    expect(opts.alignment).toBe('right');
  });
});

describe('Decoration types', () => {
  test('create decoration type options', () => {
    const opts: DecorationTypeOptions = {
      underlineColor: '#FF0000',
      underlineStyle: 'wavy',
      backgroundColor: '#330000',
    };
    expect(opts.underlineStyle).toBe('wavy');
  });

  test('decoration range', () => {
    const range: DecorationRange = {
      startLine: 0,
      startColumn: 5,
      endLine: 0,
      endColumn: 10,
      hoverMessage: 'Error: unused variable',
    };
    expect(range.hoverMessage).toBe('Error: unused variable');
  });
});

describe('Notifications', () => {
  test('notification options', () => {
    const opts: NotificationOptions = {
      message: 'Format complete',
      severity: 'info',
      actions: [{ label: 'Undo', commandId: 'edit.undo' }],
    };
    expect(opts.actions!.length).toBe(1);
    expect(opts.actions![0].commandId).toBe('edit.undo');
  });
});

describe('Context menus', () => {
  test('context menu options', () => {
    const opts: ContextMenuOptions = {
      location: 'editor',
      label: 'Format Selection',
      commandId: 'editor.formatSelection',
      group: 'format',
    };
    expect(opts.location).toBe('editor');
  });
});

describe('Panel options', () => {
  test('create panel', () => {
    const opts: PanelOptions = {
      title: 'My Plugin Panel',
      icon: 'star',
      location: 'left',
    };
    expect(opts.title).toBe('My Plugin Panel');
  });

  test('panel content', () => {
    const content: PanelContent = {
      elements: [
        { type: 'heading', value: 'Results', level: 2 },
        { type: 'text', value: '3 issues found' },
        { type: 'separator' },
        { type: 'button', label: 'Fix All', variant: 'primary' },
      ],
    };
    expect(content.elements.length).toBe(4);
  });
});

describe('Changes Queue types', () => {
  test('ChangeSource values', () => {
    const sources: ChangeSource[] = ['user', 'plugin', 'ai', 'lsp', 'external'];
    expect(sources.length).toBe(5);
  });

  test('TrustLevel values', () => {
    const levels: TrustLevel[] = ['auto-apply', 'show-diff', 'queue', 'block'];
    expect(levels.length).toBe(4);
  });

  test('plugin change tagging', () => {
    // Verify the pattern: plugin edits tagged with ChangeSource.Plugin
    const source: ChangeSource = 'plugin';
    const sourceId = 'plugin:prettier-hone';
    expect(source).toBe('plugin');
    expect(sourceId.indexOf('plugin:') === 0).toBe(true);
  });
});
