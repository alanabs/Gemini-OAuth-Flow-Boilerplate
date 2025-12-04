/**
 * Property-based tests for configuration validation
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ConfigManager } from '../../src/config';
import { OAuthError, OAuthErrorType, TokenStore, TokenData } from '../../src/types';

// Mock token store for testing
class MockTokenStore implements TokenStore {
  async saveTokens(userId: string, tokens: TokenData): Promise<void> {}
  async getTokens(userId: string): Promise<TokenData | null> { return null; }
  async deleteTokens(userId: string): Promise<void> {}
  async updateAccessToken(userId: string, accessToken: string, expiresAt: number): Promise<void> {}
}

describe('Configuration Property Tests', () => {
  /**
   * Feature: google-oauth-gemini-boilerplate, Property 1: Configuration validation rejects invalid inputs
   * Validates: Requirements 1.5
   * 
   * For any configuration object with missing required fields (clientId, redirectUri, or scopes),
   * the configuration validator should throw an OAuthError with type INVALID_REQUEST and a
   * descriptive message indicating which field is missing.
   */
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
          
          // Determine if configuration is invalid
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
            // Should throw OAuthError with INVALID_REQUEST type
            expect(() => {
              ConfigManager.load(configOptions, tokenStore);
            }).toThrow(OAuthError);
            
            try {
              ConfigManager.load(configOptions, tokenStore);
            } catch (error) {
              expect(error).toBeInstanceOf(OAuthError);
              expect((error as OAuthError).type).toBe(OAuthErrorType.INVALID_REQUEST);
              
              // Check that error message is descriptive
              const message = (error as Error).message;
              expect(message).toBeTruthy();
              expect(message.length).toBeGreaterThan(0);
              
              // Verify message mentions the specific missing field
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

  /**
   * Feature: google-oauth-gemini-boilerplate, Property 2: HTTPS enforcement for OAuth endpoints
   * Validates: Requirements 1.2, 8.1
   * 
   * For any redirect URI or OAuth endpoint URL that uses HTTP instead of HTTPS,
   * the OAuth Client should reject it with a validation error.
   * Exception: localhost URLs are allowed to use HTTP for development.
   */
  it('Property 2: HTTPS enforcement for OAuth endpoints', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Generate HTTP URLs (non-localhost)
          fc.record({
            protocol: fc.constant('http'),
            hostname: fc.domain().filter(d => d !== 'localhost' && d !== '127.0.0.1'),
            path: fc.constantFrom('', '/callback', '/auth/callback', '/oauth/redirect'),
          }),
          // Generate HTTPS URLs
          fc.record({
            protocol: fc.constant('https'),
            hostname: fc.domain(),
            path: fc.constantFrom('', '/callback', '/auth/callback', '/oauth/redirect'),
          }),
          // Generate localhost HTTP URLs (should be allowed)
          fc.record({
            protocol: fc.constant('http'),
            hostname: fc.constantFrom('localhost', '127.0.0.1', '[::1]'),
            path: fc.constantFrom('', '/callback', '/auth/callback', '/oauth/redirect'),
          })
        ),
        (urlParts) => {
          const tokenStore = new MockTokenStore();
          const redirectUri = `${urlParts.protocol}://${urlParts.hostname}${urlParts.path}`;
          
          const isLocalhost = urlParts.hostname === 'localhost' || 
                             urlParts.hostname === '127.0.0.1' ||
                             urlParts.hostname === '[::1]';
          const isHttps = urlParts.protocol === 'https';
          const shouldBeValid = isHttps || isLocalhost;
          
          const configOptions = {
            clientId: 'test-client-id',
            redirectUri,
            scopes: ['https://www.googleapis.com/auth/generative-language'],
          };
          
          if (shouldBeValid) {
            // Should not throw for HTTPS or localhost HTTP
            expect(() => {
              ConfigManager.load(configOptions, tokenStore);
            }).not.toThrow();
          } else {
            // Should throw OAuthError for non-localhost HTTP
            expect(() => {
              ConfigManager.load(configOptions, tokenStore);
            }).toThrow(OAuthError);
            
            try {
              ConfigManager.load(configOptions, tokenStore);
            } catch (error) {
              expect(error).toBeInstanceOf(OAuthError);
              expect((error as OAuthError).type).toBe(OAuthErrorType.INVALID_REQUEST);
              
              // Error message should mention HTTPS requirement
              const message = (error as Error).message.toLowerCase();
              expect(message).toContain('https');
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
