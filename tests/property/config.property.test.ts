/**
 * Property-based tests for configuration validation
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ConfigManager } from '../../src/config';
import { OAuthError, OAuthErrorType, TokenStore, TokenData } from '../../src/types';

class MockTokenStore implements TokenStore {
  async saveTokens(_userId: string, _tokens: TokenData): Promise<void> {}
  async getTokens(_userId: string): Promise<TokenData | null> { return null; }
  async deleteTokens(_userId: string): Promise<void> {}
  async updateAccessToken(_userId: string, _accessToken: string, _expiresAt: number): Promise<void> {}
  async updateTokens(_userId: string, _tokens: TokenData): Promise<void> {}
}

describe('Configuration Property Tests', () => {
  it('Property 1: Configuration validation rejects invalid inputs', () => {
    fc.assert(
      fc.property(
        fc.record({
          clientId: fc.option(fc.string(), { nil: undefined }),
          clientSecret: fc.option(fc.string(), { nil: undefined }),
          redirectUri: fc.option(fc.string(), { nil: undefined }),
          scopes: fc.option(fc.array(fc.string()), { nil: undefined }),
        }),
        (configOptions) => {
          const tokenStore = new MockTokenStore();

          const hasClientId = configOptions.clientId !== undefined &&
                             configOptions.clientId !== null &&
                             configOptions.clientId.trim() !== '';
          const hasRedirectUri = configOptions.redirectUri !== undefined &&
                                configOptions.redirectUri !== null &&
                                configOptions.redirectUri.trim() !== '';
          const hasScopes = configOptions.scopes !== undefined &&
                           configOptions.scopes !== null &&
                           configOptions.scopes.length > 0;

          const isInvalid = !hasClientId || !hasRedirectUri || !hasScopes;

          if (isInvalid) {
            expect(() => {
              ConfigManager.load(configOptions, tokenStore);
            }).toThrow(OAuthError);

            try {
              ConfigManager.load(configOptions, tokenStore);
            } catch (error) {
              expect(error).toBeInstanceOf(OAuthError);
              expect((error as OAuthError).type).toBe(OAuthErrorType.INVALID_REQUEST);

              const message = (error as Error).message;
              expect(message).toBeTruthy();
              expect(message.length).toBeGreaterThan(0);

              if (!hasClientId) {
                expect(message.toLowerCase()).toContain('clientid');
              } else if (!hasRedirectUri) {
                expect(message.toLowerCase()).toContain('redirecturi');
              } else if (!hasScopes) {
                expect(message.toLowerCase()).toContain('scope');
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2: HTTPS enforcement for OAuth endpoints', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.record({
            protocol: fc.constant('http'),
            hostname: fc.domain().filter(d => d !== 'localhost' && d !== '127.0.0.1'),
            path: fc.constantFrom('', '/callback', '/auth/callback', '/oauth/redirect'),
          }),
          fc.record({
            protocol: fc.constant('https'),
            hostname: fc.domain(),
            path: fc.constantFrom('', '/callback', '/auth/callback', '/oauth/redirect'),
          }),
          fc.record({
            protocol: fc.constant('http'),
            hostname: fc.constantFrom('localhost', '127.0.0.1', '[::1]'),
            path: fc.constantFrom('', '/callback', '/auth/callback', '/oauth/redirect'),
          })
        ),
        (urlParts) => {
          const url = `${urlParts.protocol}://${urlParts.hostname}${urlParts.path}`;

          if (urlParts.protocol === 'http' &&
              urlParts.hostname !== 'localhost' &&
              urlParts.hostname !== '127.0.0.1' &&
              urlParts.hostname !== '[::1]') {
            expect(() => ConfigManager.validateHttps(url)).toThrow(OAuthError);
          } else {
            expect(() => ConfigManager.validateHttps(url)).not.toThrow();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
