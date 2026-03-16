/**
 * Filesystem types for the Hone Plugin SDK.
 */

export interface FileStat {
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  createdAt: number;
  modifiedAt: number;
}

export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
}

export type FileWatchEventKind = 'created' | 'modified' | 'deleted';

export interface FileWatchEvent {
  kind: FileWatchEventKind;
  path: string;
}

export interface WatchHandle {
  dispose(): void;
}
