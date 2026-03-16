/**
 * Process types for the Hone Plugin SDK.
 */

export interface SpawnOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

export interface ChildProcess {
  exitCode: number;
  stdout: string;
  stderr: string;
}
