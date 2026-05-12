/**
 * @honeide/marketplace — Hone Plugin Marketplace
 *
 * REST API, client, and publisher tooling for the plugin ecosystem.
 */

export type {
  PluginListing,
  PluginDetail,
  VersionEntry,
  PublisherInfo,
  ConfigSchemaEntry,
  SearchParams,
  SearchResponse,
  PublishRequest,
  PublishResponse,
  UpdateCheckRequest,
  UpdateCheckResponse,
  ReportRequest,
  InstallResult,
} from './types';

export {
  InMemoryMarketplace,
  CATEGORIES,
  type MarketplaceAPI,
  type MarketplaceStats,
} from './api';

export {
  MarketplaceClient,
  installPlugin,
  DEFAULT_MARKETPLACE_URL,
  DEFAULT_CONFIG,
  type MarketplaceClientConfig,
} from './client';

export {
  getOAuthUrl,
  determineVerificationTier,
  canPublish,
  OAUTH_CONFIGS,
  type OAuthProvider,
  type VerificationTier,
  type OAuthToken,
  type OAuthConfig,
  type PublisherRegistration,
} from './publisher';
