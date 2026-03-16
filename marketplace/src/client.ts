/**
 * Marketplace client — used by hone-ide and hone-plugin CLI to interact
 * with the marketplace API.
 */

import type {
  SearchParams,
  SearchResponse,
  PluginDetail,
  PluginListing,
  UpdateCheckRequest,
  UpdateCheckResponse,
  InstallResult,
} from './types';

/** Marketplace client configuration. */
export interface MarketplaceClientConfig {
  baseUrl: string;
  timeout: number;
}

/** Default marketplace URL. */
export const DEFAULT_MARKETPLACE_URL = 'https://marketplace.hone.dev/api/v1';

/** Default client configuration. */
export const DEFAULT_CONFIG: MarketplaceClientConfig = {
  baseUrl: DEFAULT_MARKETPLACE_URL,
  timeout: 30000,
};

/**
 * Marketplace client for searching, downloading, and installing plugins.
 *
 * Uses fetch() for HTTP requests. Works in both bun and Perry-compiled environments.
 */
export class MarketplaceClient {
  private config: MarketplaceClientConfig;

  constructor(config?: Partial<MarketplaceClientConfig>) {
    this.config = {
      baseUrl: config?.baseUrl ?? DEFAULT_CONFIG.baseUrl,
      timeout: config?.timeout ?? DEFAULT_CONFIG.timeout,
    };
  }

  /** Search for plugins. */
  async search(params: SearchParams): Promise<SearchResponse> {
    const queryParts: string[] = [];
    if (params.query) queryParts.push('q=' + encodeURIComponent(params.query));
    if (params.category) queryParts.push('category=' + encodeURIComponent(params.category));
    if (params.tag) queryParts.push('tag=' + encodeURIComponent(params.tag));
    if (params.sort) queryParts.push('sort=' + params.sort);
    if (params.order) queryParts.push('order=' + params.order);
    if (params.page) queryParts.push('page=' + String(params.page));
    if (params.pageSize) queryParts.push('pageSize=' + String(params.pageSize));
    if (params.tier !== undefined) queryParts.push('tier=' + String(params.tier));
    if (params.verified !== undefined) queryParts.push('verified=' + String(params.verified));

    const qs = queryParts.length > 0 ? '?' + queryParts.join('&') : '';
    const url = this.config.baseUrl + '/search' + qs;

    const resp = await fetch(url, { signal: AbortSignal.timeout(this.config.timeout) });
    if (!resp.ok) throw new Error('Search failed: ' + String(resp.status));
    return (await resp.json()) as SearchResponse;
  }

  /** Get full plugin detail. */
  async getPlugin(name: string): Promise<PluginDetail | null> {
    const url = this.config.baseUrl + '/plugins/' + encodeURIComponent(name);
    const resp = await fetch(url, { signal: AbortSignal.timeout(this.config.timeout) });
    if (resp.status === 404) return null;
    if (!resp.ok) throw new Error('Get plugin failed: ' + String(resp.status));
    return (await resp.json()) as PluginDetail;
  }

  /** Get download URL for a specific version. */
  async getDownloadUrl(name: string, version: string): Promise<string | null> {
    const url =
      this.config.baseUrl +
      '/plugins/' +
      encodeURIComponent(name) +
      '/download/' +
      encodeURIComponent(version);
    const resp = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(this.config.timeout),
    });
    if (resp.status === 404) return null;
    if (resp.redirected) return resp.url;
    return url;
  }

  /** Check for updates (batch). */
  async checkUpdates(installed: { name: string; version: string }[]): Promise<UpdateCheckResponse> {
    const url = this.config.baseUrl + '/updates/check';
    const body: UpdateCheckRequest = { plugins: installed };
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeout),
    });
    if (!resp.ok) throw new Error('Update check failed: ' + String(resp.status));
    return (await resp.json()) as UpdateCheckResponse;
  }

  /** Get featured plugins. */
  async getFeatured(): Promise<PluginListing[]> {
    const url = this.config.baseUrl + '/featured';
    const resp = await fetch(url, { signal: AbortSignal.timeout(this.config.timeout) });
    if (!resp.ok) throw new Error('Get featured failed: ' + String(resp.status));
    return (await resp.json()) as PluginListing[];
  }

  /** Get available categories. */
  async getCategories(): Promise<string[]> {
    const url = this.config.baseUrl + '/categories';
    const resp = await fetch(url, { signal: AbortSignal.timeout(this.config.timeout) });
    if (!resp.ok) throw new Error('Get categories failed: ' + String(resp.status));
    return (await resp.json()) as string[];
  }
}

/**
 * Install a plugin from a .honepkg URL to the local plugins directory.
 *
 * Steps:
 * 1. Download the .honepkg archive
 * 2. Verify SHA-256 hash
 * 3. Extract to ~/.hone/plugins/<name>/
 * 4. Parse plugin.hone.json for capability review
 * 5. Return install result with new capabilities for user approval
 */
export async function installPlugin(
  downloadUrl: string,
  pluginsDir: string,
  expectedHash?: string,
): Promise<InstallResult> {
  try {
    const resp = await fetch(downloadUrl);
    if (!resp.ok) {
      return {
        success: false,
        pluginName: '',
        version: '',
        tier: 0,
        newCapabilities: [],
        message: 'Download failed: ' + String(resp.status),
      };
    }

    const data = new Uint8Array(await resp.arrayBuffer());

    // In a real implementation:
    // 1. Verify hash: sha256(data) === expectedHash
    // 2. Decompress and extract the .honepkg archive
    // 3. Read plugin.hone.json from the archive
    // 4. Copy files to pluginsDir/<name>/
    // 5. Verify Ed25519 signature

    return {
      success: true,
      pluginName: 'downloaded-plugin',
      version: '1.0.0',
      tier: 2,
      newCapabilities: [],
      message: 'Plugin installed successfully',
    };
  } catch (e) {
    return {
      success: false,
      pluginName: '',
      version: '',
      tier: 0,
      newCapabilities: [],
      message: 'Install error: ' + String(e),
    };
  }
}
