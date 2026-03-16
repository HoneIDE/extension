/**
 * UI types for the Hone Plugin SDK.
 *
 * Declarative panel elements — plugins return these, Hone renders them.
 * No closures on `this`, no complex generics.
 */

export type PanelElementType =
  | 'text'
  | 'heading'
  | 'list'
  | 'tree'
  | 'table'
  | 'input'
  | 'button'
  | 'separator'
  | 'progress'
  | 'codeBlock'
  | 'group';

export interface TextElement {
  type: 'text';
  value: string;
  style?: TextStyle;
}

export interface TextStyle {
  bold?: boolean;
  italic?: boolean;
  color?: string;
  fontSize?: number;
}

export interface HeadingElement {
  type: 'heading';
  value: string;
  level: number;
}

export interface ListItem {
  text: string;
  icon?: string;
}

export interface ListElement {
  type: 'list';
  items: ListItem[];
  ordered?: boolean;
}

export interface TreeNode {
  label: string;
  icon?: string;
  children?: TreeNode[];
  expanded?: boolean;
}

export interface TreeElement {
  type: 'tree';
  roots: TreeNode[];
}

export interface TableColumn {
  label: string;
  width?: number;
}

export interface TableRow {
  cells: string[];
}

export interface TableElement {
  type: 'table';
  columns: TableColumn[];
  rows: TableRow[];
}

export interface InputElement {
  type: 'input';
  id: string;
  placeholder?: string;
  value?: string;
}

export interface ButtonElement {
  type: 'button';
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  commandId?: string;
}

export interface SeparatorElement {
  type: 'separator';
}

export interface ProgressElement {
  type: 'progress';
  value: number;
  max: number;
  label?: string;
}

export interface CodeBlockElement {
  type: 'codeBlock';
  code: string;
  language?: string;
}

export interface GroupElement {
  type: 'group';
  direction: 'row' | 'column';
  children: PanelElement[];
  gap?: number;
}

export type PanelElement =
  | TextElement
  | HeadingElement
  | ListElement
  | TreeElement
  | TableElement
  | InputElement
  | ButtonElement
  | SeparatorElement
  | ProgressElement
  | CodeBlockElement
  | GroupElement;

/** Opaque ID for a panel instance. */
export type PanelId = number;

/** Options for creating a side panel. */
export interface PanelOptions {
  title: string;
  icon?: string;
  location?: 'left' | 'right' | 'bottom';
}

/** Content to render in a panel. */
export interface PanelContent {
  elements: PanelElement[];
}

/** Opaque ID for a status bar item. */
export type StatusBarItemId = number;

/** Options for creating a status bar item. */
export interface StatusBarItemOptions {
  text: string;
  tooltip?: string;
  alignment?: 'left' | 'right';
  priority?: number;
  commandId?: string;
}

/** Opaque ID for a decoration type. */
export type DecorationTypeId = number;

/** Options for creating a decoration type. */
export interface DecorationTypeOptions {
  underlineColor?: string;
  underlineStyle?: 'solid' | 'dashed' | 'dotted' | 'wavy';
  backgroundColor?: string;
  gutterIcon?: string;
  isWholeLine?: boolean;
}

/** A range with an optional hover message for decorations. */
export interface DecorationRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  hoverMessage?: string;
}

/** Opaque ID for a gutter provider. */
export type GutterProviderId = number;

/** Options for creating a gutter provider. */
export interface GutterProviderOptions {
  id: string;
}

/** A gutter item to display next to a line. */
export interface GutterItem {
  line: number;
  icon: string;
  tooltip?: string;
  commandId?: string;
}

/** Opaque ID for a context menu registration. */
export type ContextMenuId = number;

/** Options for registering a context menu item. */
export interface ContextMenuOptions {
  location: 'editor' | 'explorer' | 'tab';
  label: string;
  commandId: string;
  group?: string;
}

/** Notification severity. */
export type NotificationSeverity = 'info' | 'warning' | 'error';

/** Options for showing a notification. */
export interface NotificationOptions {
  message: string;
  severity?: NotificationSeverity;
  actions?: NotificationAction[];
}

/** An action button on a notification. */
export interface NotificationAction {
  label: string;
  commandId: string;
}
