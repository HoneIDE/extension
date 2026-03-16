/**
 * Configuration types for the Hone Plugin SDK.
 */

export type ConfigValueType = 'string' | 'number' | 'boolean';

export interface ConfigSchemaEntry {
  type: ConfigValueType;
  default?: string | number | boolean;
  description?: string;
  enum?: string[];
}

export type ConfigSchema = Record<string, ConfigSchemaEntry>;
