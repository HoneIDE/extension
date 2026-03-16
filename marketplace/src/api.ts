/**
 * Marketplace REST API — route definitions and handlers.
 *
 * Base URL: https://marketplace.hone.dev/api/v1
 *
 * Endpoints:
 *   GET  /search                — Search/browse plugins
 *   GET  /plugins/:name         — Get plugin detail
 *   GET  /plugins/:name/versions — Get version history
 *   GET  /plugins/:name/download/:version — Download .honepkg
 *   POST /plugins/publish       — Publish a new version
 *   POST /plugins/report        — Report abuse
 *   POST /updates/check         — Batch update check
 *   GET  /categories            — List categories
 *   GET  /featured              — Featured plugins
 *   GET  /stats                 — Marketplace statistics
 */

import type {
  SearchParams,
  SearchResponse,
  PluginDetail,
  PluginListing,
  VersionEntry,
  PublishRequest,
  PublishResponse,
  UpdateCheckRequest,
  UpdateCheckResponse,
  ReportRequest,
} from './types';

/** Marketplace API endpoint definitions. */
export interface MarketplaceAPI {
  search(params: SearchParams): SearchResponse;
  getPlugin(name: string): PluginDetail | null;
  getVersions(name: string): VersionEntry[];
  getDownloadUrl(name: string, version: string): string | null;
  publish(request: PublishRequest, token: string): PublishResponse;
  report(request: ReportRequest): { success: boolean };
  checkUpdates(request: UpdateCheckRequest): UpdateCheckResponse;
  getCategories(): string[];
  getFeatured(): PluginListing[];
  getStats(): MarketplaceStats;
}

/** Marketplace-wide statistics. */
export interface MarketplaceStats {
  totalPlugins: number;
  totalDownloads: number;
  totalPublishers: number;
  updatedAt: string;
}

/** Predefined categories. */
export const CATEGORIES = [
  'Languages',
  'Formatters',
  'Linters',
  'Themes',
  'Keymaps',
  'Snippets',
  'Debuggers',
  'Testing',
  'Git',
  'AI',
  'Data',
  'Visualization',
  'Other',
];

/** In-memory marketplace store for testing and development. */
export class InMemoryMarketplace implements MarketplaceAPI {
  private plugins: Map<string, PluginDetail> = new Map();
  private downloadCounts: Map<string, number> = new Map();

  /** Add a plugin to the store (for testing). */
  addPlugin(detail: PluginDetail): void {
    this.plugins.set(detail.name, detail);
    this.downloadCounts.set(detail.name, detail.downloads);
  }

  search(params: SearchParams): SearchResponse {
    let results = Array.from(this.plugins.values());

    // Filter by query
    if (params.query !== undefined && params.query.length > 0) {
      const q = params.query.toLowerCase();
      results = results.filter(
        (p) =>
          p.name.toLowerCase().indexOf(q) >= 0 ||
          p.displayName.toLowerCase().indexOf(q) >= 0 ||
          p.description.toLowerCase().indexOf(q) >= 0,
      );
    }

    // Filter by category
    if (params.category !== undefined) {
      results = results.filter((p) => p.tags.indexOf(params.category!) >= 0);
    }

    // Filter by tag
    if (params.tag !== undefined) {
      results = results.filter((p) => p.tags.indexOf(params.tag!) >= 0);
    }

    // Filter by tier
    if (params.tier !== undefined) {
      results = results.filter((p) => p.tier === params.tier);
    }

    // Filter by verified
    if (params.verified !== undefined) {
      results = results.filter((p) => p.verified === params.verified);
    }

    // Filter by featured
    if (params.featured !== undefined) {
      results = results.filter((p) => p.featured === params.featured);
    }

    // Sort
    const sort = params.sort ?? 'relevance';
    const order = params.order ?? 'desc';
    results.sort((a, b) => {
      let cmp = 0;
      if (sort === 'downloads') cmp = a.downloads - b.downloads;
      else if (sort === 'rating') cmp = a.rating - b.rating;
      else if (sort === 'updated') cmp = a.updatedAt.localeCompare(b.updatedAt);
      else if (sort === 'name') cmp = a.name.localeCompare(b.name);
      else cmp = a.downloads - b.downloads; // relevance fallback
      return order === 'desc' ? -cmp : cmp;
    });

    // Paginate
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const start = (page - 1) * pageSize;
    const paged = results.slice(start, start + pageSize);

    // Map to PluginListing (omit detail fields)
    const listings: PluginListing[] = paged.map((p) => ({
      name: p.name,
      displayName: p.displayName,
      version: p.version,
      author: p.author,
      description: p.description,
      license: p.license,
      icon: p.icon,
      repository: p.repository,
      downloads: p.downloads,
      rating: p.rating,
      ratingCount: p.ratingCount,
      tier: p.tier,
      capabilities: p.capabilities,
      tags: p.tags,
      publishedAt: p.publishedAt,
      updatedAt: p.updatedAt,
      verified: p.verified,
      featured: p.featured,
    }));

    return {
      results: listings,
      total: results.length,
      page: page,
      pageSize: pageSize,
    };
  }

  getPlugin(name: string): PluginDetail | null {
    return this.plugins.get(name) ?? null;
  }

  getVersions(name: string): VersionEntry[] {
    const plugin = this.plugins.get(name);
    if (plugin === undefined) return [];
    return plugin.versions;
  }

  getDownloadUrl(name: string, version: string): string | null {
    const plugin = this.plugins.get(name);
    if (plugin === undefined) return null;
    for (let i = 0; i < plugin.versions.length; i++) {
      if (plugin.versions[i].version === version) {
        // Increment download count
        const count = this.downloadCounts.get(name) ?? 0;
        this.downloadCounts.set(name, count + 1);
        plugin.downloads = count + 1;
        return plugin.versions[i].downloadUrl;
      }
    }
    return null;
  }

  publish(request: PublishRequest, _token: string): PublishResponse {
    // In a real implementation, this would:
    // 1. Verify the token
    // 2. Parse and validate the manifest
    // 3. Store the source archive
    // 4. Queue a build for all platforms
    // 5. Sign the resulting binaries
    return {
      success: true,
      version: '0.0.0',
      buildId: 'build-' + String(Date.now()),
      message: 'Plugin submitted for review',
    };
  }

  report(_request: ReportRequest): { success: boolean } {
    return { success: true };
  }

  checkUpdates(request: UpdateCheckRequest): UpdateCheckResponse {
    const updates: UpdateCheckResponse['updates'] = [];

    for (let i = 0; i < request.plugins.length; i++) {
      const req = request.plugins[i];
      const plugin = this.plugins.get(req.name);
      if (plugin === undefined) continue;
      if (plugin.version !== req.version) {
        updates.push({
          name: req.name,
          currentVersion: req.version,
          latestVersion: plugin.version,
          downloadUrl: plugin.versions.length > 0 ? plugin.versions[0].downloadUrl : '',
          newCapabilities: [],
        });
      }
    }

    return { updates: updates };
  }

  getCategories(): string[] {
    return CATEGORIES.slice();
  }

  getFeatured(): PluginListing[] {
    return this.search({ featured: true, pageSize: 10 }).results;
  }

  getStats(): MarketplaceStats {
    return {
      totalPlugins: this.plugins.size,
      totalDownloads: Array.from(this.downloadCounts.values()).reduce((a, b) => a + b, 0),
      totalPublishers: new Set(Array.from(this.plugins.values()).map((p) => p.author)).size,
      updatedAt: new Date().toISOString(),
    };
  }
}
