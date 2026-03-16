/**
 * Marketplace types — shared between server, CLI, and IDE client.
 */

/** Plugin listing as returned by search/browse APIs. */
export interface PluginListing {
  name: string;
  displayName: string;
  version: string;
  author: string;
  description: string;
  license: string;
  icon: string | null;
  repository: string | null;
  downloads: number;
  rating: number;
  ratingCount: number;
  tier: number;
  capabilities: string[];
  tags: string[];
  publishedAt: string;
  updatedAt: string;
  verified: boolean;
  featured: boolean;
}

/** Full plugin detail (includes version history). */
export interface PluginDetail extends PluginListing {
  readme: string;
  changelog: string;
  versions: VersionEntry[];
  publisher: PublisherInfo;
  screenshots: string[];
  configSchema: Record<string, ConfigSchemaEntry>;
}

/** A published version. */
export interface VersionEntry {
  version: string;
  publishedAt: string;
  minHoneVersion: string;
  perryVersion: string;
  platforms: string[];
  downloadUrl: string;
  size: number;
  sha256: string;
  signature: string;
}

/** Publisher information. */
export interface PublisherInfo {
  name: string;
  displayName: string;
  email: string | null;
  url: string | null;
  verified: boolean;
  verificationTier: 'unverified' | 'email' | 'domain' | 'organization';
}

/** Config schema entry (from plugin.hone.json). */
export interface ConfigSchemaEntry {
  type: string;
  default?: unknown;
  description?: string;
  enum?: string[];
}

/** Search request parameters. */
export interface SearchParams {
  query?: string;
  category?: string;
  tag?: string;
  sort?: 'relevance' | 'downloads' | 'rating' | 'updated' | 'name';
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
  tier?: number;
  verified?: boolean;
  featured?: boolean;
}

/** Search response. */
export interface SearchResponse {
  results: PluginListing[];
  total: number;
  page: number;
  pageSize: number;
}

/** Publish request. */
export interface PublishRequest {
  manifest: string;
  sourceArchive: Uint8Array;
  readme?: string;
  changelog?: string;
}

/** Publish response. */
export interface PublishResponse {
  success: boolean;
  version: string;
  buildId: string;
  message: string;
}

/** Update check request (batch). */
export interface UpdateCheckRequest {
  plugins: { name: string; version: string }[];
}

/** Update check response. */
export interface UpdateCheckResponse {
  updates: {
    name: string;
    currentVersion: string;
    latestVersion: string;
    downloadUrl: string;
    newCapabilities: string[];
  }[];
}

/** Report request (abuse/malware). */
export interface ReportRequest {
  pluginName: string;
  reason: 'malware' | 'spam' | 'inappropriate' | 'license' | 'other';
  description: string;
  reporterEmail?: string;
}

/** Install result. */
export interface InstallResult {
  success: boolean;
  pluginName: string;
  version: string;
  tier: number;
  newCapabilities: string[];
  message: string;
}
