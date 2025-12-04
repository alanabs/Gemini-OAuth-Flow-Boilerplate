/**
 * Property-based tests for URL builder
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { URLBuilder } from '../../src/url-builder';
import { OAuthClientConfig, TokenStore, TokenData } from '../../src/types';

// Mock token store for testing
class MockTokenStore implements TokenStore {
  async saveTokens(_userId: string, _tokens: TokenData): Promise<void> {}
  async getTokens(_userId: string): Promise<TokenData | null> { return null; }
  async deleteTokens(_userId: string): Promise<void> {}
  async updateAccessToken(_userId: string, _accessToken: string, _expiresAt: number): Promise<void> {}
}

describe('URL Builder Property Tests', () => {
  /**
   * Feature: google-oauth-gemini-boilerplate, Property 3: Gemini scope inclusion
   * Validates: Requirements 1.3
   * 
   * For any OAuth configuration, the generated authorization URL should include 
   * the scope `https://www.googleapis.com/auth/generative-language` in its scope parameter.
   */
  it('Property 3: Gemini scope inclusion', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          clientId: fc.string({ minLength: 1 }),
          redirectUri: fc.webUrl({ validSchemes: ['https'] }),
          scopes: fc.array(fc.string({ minLength: 1 }), { minLength: 0, maxLength: 5 }),
          usePKCE: fc.boolean(),
        }),
        async (configOptions) => {
          const tokenStore = new MockTokenStore();
          const config: OAuthClientConfig = {
            clientId: configOptions.clientId,
            redirectUri: configOptions.redirectUri,
            scopes: configOptions.scopes,
            tokenStore,
            usePKCE: configOptions.usePKCE,
          };

          // Generate authorization URL
          const result = await URLBuilder.generateAuthorizationUrl(config);

          // Parse the URL to extract parameters
          const url = new URL(result.url);
          const scopeParam = url.searchParams.get('scope');

          // Property: Gemini scope must be present
          expect(scopeParam).toBeTruthy();
          expect(scopeParam).toContain('https://www.googleapis.com/auth/generative-language');

          // Verify it's in the scope list (space-separated)
          const scopes = scopeParam!.split(' ');
          expect(scopes).toContain('https://www.googleapis.com/auth/generative-language');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: google-oauth-gemini-boilerplate, Property 5: Authorization URL format
   * Validates: Requirements 2.1
   * 
   * For any valid configuration, the generated authorization URL should contain 
   * all required OAuth 2.0 parameters: response_type=code, client_id, redirect_uri, 
   * scope, and state.
   */
  it('Property 5: Authorization URL format', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          clientId: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
          redirectUri: fc.webUrl({ validSchemes: ['https'] }),
          scopes: fc.array(
            fc.string({ minLength: 1 }).filter(s => s.trim().length > 0 && !s.includes(' ')),
            { minLength: 1, maxLength: 5 }
          ),
          usePKCE: fc.boolean(),
          state: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
        }),
        async (configOptions) => {
          const tokenStore = new MockTokenStore();
          const config: OAuthClientConfig = {
            clientId: configOptions.clientId,
            redirectUri: configOptions.redirectUri,
            scopes: configOptions.scopes,
            tokenStore,
            usePKCE: configOptions.usePKCE,
          };

          // Generate authorization URL
          const result = await URLBuilder.generateAuthorizationUrl(config, configOptions.state);

          // Parse the URL
          const url = new URL(result.url);

          // Property 1: URL should use Google's OAuth endpoint
          expect(url.origin).toBe('https://accounts.google.com');
          expect(url.pathname).toBe('/o/oauth2/v2/auth');

          // Property 2: response_type must be 'code'
          expect(url.searchParams.get('response_type')).toBe('code');

          // Property 3: client_id must be present and match config
          expect(url.searchParams.get('client_id')).toBe(configOptions.clientId);

          // Property 4: redirect_uri must be present and match config
          expect(url.searchParams.get('redirect_uri')).toBe(configOptions.redirectUri);

          // Property 5: scope must be present
          const scopeParam = url.searchParams.get('scope');
          expect(scopeParam).toBeTruthy();
          expect(scopeParam!.length).toBeGreaterThan(0);

          // Property 6: state must be present
          const stateParam = url.searchParams.get('state');
          expect(stateParam).toBeTruthy();
          expect(stateParam!.length).toBeGreaterThan(0);

          // Property 7: If state was provided, it should match
          if (configOptions.state) {
            expect(stateParam).toBe(configOptions.state);
          }

          // Property 8: If PKCE is enabled, code_challenge and code_challenge_method must be present
          if (configOptions.usePKCE) {
            const codeChallenge = url.searchParams.get('code_challenge');
            const codeChallengeMethod = url.searchParams.get('code_challenge_method');

            expect(codeChallenge).toBeTruthy();
            expect(codeChallenge!.length).toBeGreaterThan(0);
            expect(codeChallengeMethod).toBe('S256');

            // Verify code verifier is returned in result
            expect(result.codeVerifier).toBeTruthy();
            expect(result.codeVerifier!.length).toBeGreaterThanOrEqual(43);
            expect(result.codeVerifier!.length).toBeLessThanOrEqual(128);
          } else {
            // If PKCE is disabled, these parameters should not be present
            expect(url.searchParams.has('code_challenge')).toBe(false);
            expect(url.searchParams.has('code_challenge_method')).toBe(false);
            expect(result.codeVerifier).toBeUndefined();
          }

          // Property 9: All scope values from config should be present
          const scopes = scopeParam!.split(' ');
          for (const scope of configOptions.scopes) {
            expect(scopes).toContain(scope);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5: Authorization URL format - URL encoding', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          clientId: fc.string({ minLength: 1 }),
          redirectUri: fc.webUrl({ validSchemes: ['https'] }),
          scopes: fc.array(
            fc.constantFrom(
              'https://www.googleapis.com/auth/userinfo.email',
              'https://www.googleapis.com/auth/userinfo.profile',
              'openid'
            ),
            { minLength: 1, maxLength: 3 }
          ),
          usePKCE: fc.boolean(),
        }),
        async (configOptions) => {
          const tokenStore = new MockTokenStore();
          const config: OAuthClientConfig = {
            clientId: configOptions.clientId,
            redirectUri: configOptions.redirectUri,
            scopes: configOptions.scopes,
            tokenStore,
            usePKCE: configOptions.usePKCE,
          };

          // Generate authorization URL
          const result = await URLBuilder.generateAuthorizationUrl(config);

          // Property: URL should be properly encoded and parseable
          expect(() => new URL(result.url)).not.toThrow();

          // Parse the URL
          const url = new URL(result.url);

          // Property: Parameters with special characters should be properly encoded
          const redirectUri = url.searchParams.get('redirect_uri');
          expect(redirectUri).toBe(configOptions.redirectUri);

          // Property: Scope parameter should be properly encoded (spaces between scopes)
          const scopeParam = url.searchParams.get('scope');
          expect(scopeParam).toBeTruthy();

          // Verify scopes are space-separated (not URL-encoded %20 in the parameter value)
          const scopes = scopeParam!.split(' ');
          expect(scopes.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
