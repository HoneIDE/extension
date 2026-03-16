/**
 * Publisher authentication and verification.
 *
 * Supports OAuth via GitHub, GitLab, and Codeberg.
 * Verification tiers determine trust level in the marketplace.
 */

import type { PublisherInfo } from './types';

/** OAuth provider. */
export type OAuthProvider = 'github' | 'gitlab' | 'codeberg';

/** Verification tier. */
export type VerificationTier = 'unverified' | 'email' | 'domain' | 'organization';

/** OAuth token response. */
export interface OAuthToken {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
  provider: OAuthProvider;
  userId: string;
  username: string;
}

/** Publisher registration request. */
export interface PublisherRegistration {
  name: string;
  displayName: string;
  email: string;
  url: string | null;
  oauthProvider: OAuthProvider;
  oauthToken: string;
}

/** OAuth configuration per provider. */
export interface OAuthConfig {
  clientId: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
}

/** Default OAuth configurations. */
export const OAUTH_CONFIGS: Record<OAuthProvider, OAuthConfig> = {
  github: {
    clientId: '', // Set in deployment
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scopes: ['read:user', 'user:email'],
  },
  gitlab: {
    clientId: '',
    authUrl: 'https://gitlab.com/oauth/authorize',
    tokenUrl: 'https://gitlab.com/oauth/token',
    scopes: ['read_user'],
  },
  codeberg: {
    clientId: '',
    authUrl: 'https://codeberg.org/login/oauth/authorize',
    tokenUrl: 'https://codeberg.org/login/oauth/access_token',
    scopes: ['read:user'],
  },
};

/**
 * Generate an OAuth authorization URL.
 */
export function getOAuthUrl(provider: OAuthProvider, redirectUri: string, state: string): string {
  const config = OAUTH_CONFIGS[provider];
  const params = [
    'client_id=' + encodeURIComponent(config.clientId),
    'redirect_uri=' + encodeURIComponent(redirectUri),
    'state=' + encodeURIComponent(state),
    'scope=' + encodeURIComponent(config.scopes.join(' ')),
    'response_type=code',
  ];
  return config.authUrl + '?' + params.join('&');
}

/**
 * Determine the verification tier for a publisher.
 */
export function determineVerificationTier(publisher: PublisherInfo): VerificationTier {
  if (publisher.verificationTier === 'organization') return 'organization';
  if (publisher.verificationTier === 'domain') return 'domain';
  if (publisher.email !== null && publisher.email.length > 0) return 'email';
  return 'unverified';
}

/**
 * Check if a publisher can publish plugins (minimum email verification).
 */
export function canPublish(publisher: PublisherInfo): boolean {
  const tier = determineVerificationTier(publisher);
  return tier !== 'unverified';
}
