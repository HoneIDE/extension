/**
 * Changes Queue types for the Hone Plugin SDK.
 *
 * Plugins submit edits through the Changes Queue, which tracks trust levels.
 */

export type ChangeSource = 'user' | 'plugin' | 'ai' | 'lsp' | 'external';

export type TrustLevel = 'auto-apply' | 'show-diff' | 'queue' | 'block';
