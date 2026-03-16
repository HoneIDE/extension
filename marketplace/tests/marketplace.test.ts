import { describe, test, expect, beforeEach } from 'bun:test';
import {
  InMemoryMarketplace,
  CATEGORIES,
  type PluginDetail,
  type PluginListing,
  type SearchParams,
  type PublisherInfo,
} from '../src/index';
import { determineVerificationTier, canPublish, getOAuthUrl } from '../src/publisher';

function makePlugin(overrides: Partial<PluginDetail> = {}): PluginDetail {
  return {
    name: overrides.name ?? 'test-plugin',
    displayName: overrides.displayName ?? 'Test Plugin',
    version: overrides.version ?? '1.0.0',
    author: overrides.author ?? 'Test Author',
    description: overrides.description ?? 'A test plugin',
    license: 'MIT',
    icon: null,
    repository: null,
    downloads: overrides.downloads ?? 0,
    rating: overrides.rating ?? 0,
    ratingCount: 0,
    tier: overrides.tier ?? 2,
    capabilities: overrides.capabilities ?? ['editor.read'],
    tags: overrides.tags ?? [],
    publishedAt: '2026-01-01T00:00:00Z',
    updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00Z',
    verified: overrides.verified ?? false,
    featured: overrides.featured ?? false,
    readme: '',
    changelog: '',
    versions: overrides.versions ?? [{
      version: '1.0.0',
      publishedAt: '2026-01-01T00:00:00Z',
      minHoneVersion: '>=0.1.0',
      perryVersion: '0.12.0',
      platforms: ['darwin-arm64'],
      downloadUrl: 'https://cdn.hone.dev/plugins/test-plugin-1.0.0.honepkg',
      size: 50000,
      sha256: 'abc123',
      signature: '',
    }],
    publisher: {
      name: 'test-author',
      displayName: 'Test Author',
      email: 'test@example.com',
      url: null,
      verified: false,
      verificationTier: 'email',
    },
    screenshots: [],
    configSchema: {},
  };
}

describe('InMemoryMarketplace', () => {
  let marketplace: InMemoryMarketplace;

  beforeEach(() => {
    marketplace = new InMemoryMarketplace();
  });

  test('search returns empty for no plugins', () => {
    const result = marketplace.search({});
    expect(result.total).toBe(0);
    expect(result.results.length).toBe(0);
  });

  test('search finds plugins by name', () => {
    marketplace.addPlugin(makePlugin({ name: 'prettier', displayName: 'Prettier' }));
    marketplace.addPlugin(makePlugin({ name: 'eslint', displayName: 'ESLint' }));

    const result = marketplace.search({ query: 'prettier' });
    expect(result.total).toBe(1);
    expect(result.results[0].name).toBe('prettier');
  });

  test('search finds plugins by description', () => {
    marketplace.addPlugin(makePlugin({
      name: 'fmt',
      description: 'Code formatter for JavaScript',
    }));
    const result = marketplace.search({ query: 'javascript' });
    expect(result.total).toBe(1);
  });

  test('search filters by tier', () => {
    marketplace.addPlugin(makePlugin({ name: 'a', tier: 1 }));
    marketplace.addPlugin(makePlugin({ name: 'b', tier: 2 }));
    marketplace.addPlugin(makePlugin({ name: 'c', tier: 3 }));

    const result = marketplace.search({ tier: 2 });
    expect(result.total).toBe(1);
    expect(result.results[0].name).toBe('b');
  });

  test('search filters by verified', () => {
    marketplace.addPlugin(makePlugin({ name: 'a', verified: true }));
    marketplace.addPlugin(makePlugin({ name: 'b', verified: false }));

    const result = marketplace.search({ verified: true });
    expect(result.total).toBe(1);
    expect(result.results[0].name).toBe('a');
  });

  test('search filters by featured', () => {
    marketplace.addPlugin(makePlugin({ name: 'a', featured: true }));
    marketplace.addPlugin(makePlugin({ name: 'b', featured: false }));

    const result = marketplace.search({ featured: true });
    expect(result.total).toBe(1);
    expect(result.results[0].name).toBe('a');
  });

  test('search sorts by downloads', () => {
    marketplace.addPlugin(makePlugin({ name: 'a', downloads: 100 }));
    marketplace.addPlugin(makePlugin({ name: 'b', downloads: 500 }));
    marketplace.addPlugin(makePlugin({ name: 'c', downloads: 200 }));

    const result = marketplace.search({ sort: 'downloads', order: 'desc' });
    expect(result.results[0].name).toBe('b');
    expect(result.results[1].name).toBe('c');
    expect(result.results[2].name).toBe('a');
  });

  test('search paginates', () => {
    for (let i = 0; i < 25; i++) {
      marketplace.addPlugin(makePlugin({ name: 'plugin-' + String(i) }));
    }

    const page1 = marketplace.search({ page: 1, pageSize: 10 });
    expect(page1.results.length).toBe(10);
    expect(page1.total).toBe(25);

    const page3 = marketplace.search({ page: 3, pageSize: 10 });
    expect(page3.results.length).toBe(5);
  });

  test('search by tag', () => {
    marketplace.addPlugin(makePlugin({ name: 'a', tags: ['Languages', 'TypeScript'] }));
    marketplace.addPlugin(makePlugin({ name: 'b', tags: ['Formatters'] }));

    const result = marketplace.search({ tag: 'Languages' });
    expect(result.total).toBe(1);
    expect(result.results[0].name).toBe('a');
  });

  test('getPlugin returns full detail', () => {
    marketplace.addPlugin(makePlugin({ name: 'my-plugin' }));
    const detail = marketplace.getPlugin('my-plugin');
    expect(detail).not.toBeNull();
    expect(detail!.readme).toBeDefined();
    expect(detail!.versions.length).toBe(1);
  });

  test('getPlugin returns null for unknown', () => {
    expect(marketplace.getPlugin('nonexistent')).toBeNull();
  });

  test('getVersions returns version history', () => {
    marketplace.addPlugin(makePlugin({
      name: 'versioned',
      versions: [
        { version: '2.0.0', publishedAt: '2026-02-01', minHoneVersion: '>=0.1.0', perryVersion: '0.12.0', platforms: ['darwin-arm64'], downloadUrl: 'url2', size: 60000, sha256: 'def', signature: '' },
        { version: '1.0.0', publishedAt: '2026-01-01', minHoneVersion: '>=0.1.0', perryVersion: '0.12.0', platforms: ['darwin-arm64'], downloadUrl: 'url1', size: 50000, sha256: 'abc', signature: '' },
      ],
    }));
    const versions = marketplace.getVersions('versioned');
    expect(versions.length).toBe(2);
  });

  test('getDownloadUrl increments download count', () => {
    marketplace.addPlugin(makePlugin({ name: 'dl-test', downloads: 10 }));
    const url = marketplace.getDownloadUrl('dl-test', '1.0.0');
    expect(url).not.toBeNull();
    const detail = marketplace.getPlugin('dl-test');
    expect(detail!.downloads).toBe(11);
  });

  test('checkUpdates finds outdated plugins', () => {
    marketplace.addPlugin(makePlugin({ name: 'outdated', version: '2.0.0' }));
    marketplace.addPlugin(makePlugin({ name: 'current', version: '1.0.0' }));

    const result = marketplace.checkUpdates({
      plugins: [
        { name: 'outdated', version: '1.0.0' },
        { name: 'current', version: '1.0.0' },
      ],
    });
    expect(result.updates.length).toBe(1);
    expect(result.updates[0].name).toBe('outdated');
    expect(result.updates[0].latestVersion).toBe('2.0.0');
  });

  test('getCategories returns predefined list', () => {
    const cats = marketplace.getCategories();
    expect(cats.length).toBe(CATEGORIES.length);
    expect(cats.indexOf('Languages') >= 0).toBe(true);
  });

  test('getFeatured returns featured plugins', () => {
    marketplace.addPlugin(makePlugin({ name: 'feat', featured: true }));
    marketplace.addPlugin(makePlugin({ name: 'nonfeat', featured: false }));
    const featured = marketplace.getFeatured();
    expect(featured.length).toBe(1);
    expect(featured[0].name).toBe('feat');
  });

  test('getStats returns counts', () => {
    marketplace.addPlugin(makePlugin({ name: 'a', author: 'Alice', downloads: 100 }));
    marketplace.addPlugin(makePlugin({ name: 'b', author: 'Bob', downloads: 200 }));
    const stats = marketplace.getStats();
    expect(stats.totalPlugins).toBe(2);
    expect(stats.totalDownloads).toBe(300);
    expect(stats.totalPublishers).toBe(2);
  });

  test('publish returns success', () => {
    const result = marketplace.publish({
      manifest: '{}',
      sourceArchive: new Uint8Array(0),
    }, 'token');
    expect(result.success).toBe(true);
    expect(result.buildId.length).toBeGreaterThan(0);
  });

  test('report returns success', () => {
    const result = marketplace.report({
      pluginName: 'bad-plugin',
      reason: 'malware',
      description: 'Contains malicious code',
    });
    expect(result.success).toBe(true);
  });
});

describe('Publisher verification', () => {
  test('email-verified publisher can publish', () => {
    const pub: PublisherInfo = {
      name: 'alice',
      displayName: 'Alice',
      email: 'alice@example.com',
      url: null,
      verified: false,
      verificationTier: 'email',
    };
    expect(canPublish(pub)).toBe(true);
    expect(determineVerificationTier(pub)).toBe('email');
  });

  test('unverified publisher cannot publish', () => {
    const pub: PublisherInfo = {
      name: 'bob',
      displayName: 'Bob',
      email: null,
      url: null,
      verified: false,
      verificationTier: 'unverified',
    };
    expect(canPublish(pub)).toBe(false);
  });

  test('organization tier is highest', () => {
    const pub: PublisherInfo = {
      name: 'org',
      displayName: 'Org',
      email: 'dev@org.com',
      url: 'https://org.com',
      verified: true,
      verificationTier: 'organization',
    };
    expect(determineVerificationTier(pub)).toBe('organization');
  });

  test('OAuth URL generation', () => {
    const url = getOAuthUrl('github', 'https://hone.dev/callback', 'state123');
    expect(url.indexOf('github.com/login/oauth/authorize') >= 0).toBe(true);
    expect(url.indexOf('state123') >= 0).toBe(true);
  });
});

describe('Categories', () => {
  test('categories list is complete', () => {
    expect(CATEGORIES.length).toBeGreaterThanOrEqual(10);
    expect(CATEGORIES.indexOf('Languages') >= 0).toBe(true);
    expect(CATEGORIES.indexOf('Formatters') >= 0).toBe(true);
    expect(CATEGORIES.indexOf('Themes') >= 0).toBe(true);
    expect(CATEGORIES.indexOf('AI') >= 0).toBe(true);
  });
});
