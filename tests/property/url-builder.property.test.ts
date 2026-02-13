/**
 * Property-based tests for URL builder
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { URLBuilder } from '../../src/url-builder';
import { OAuthClientConfig, TokenStore, TokenData } from '../../src/types';

class MockTokenStore implements TokenStore {
  async saveTokens(_userId: string, _tokens: TokenData): Promise<void> {}
  async getTokens(_userId: string): Promise<TokenData | null> { return null; }
  async deleteTokens(_userId: string): Promise<void> {}
  async updateAccessToken(_userId: string, _accessToken: string, _expiresAt: number): Promise<void> {}
  async updateTokens(_userId: string, _tokens: TokenData): Promise<void> {}
}

describe('URL Builder Property Tests', () => {
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

          const result = await URLBuilder.generateAuthorizationUrl(config);
          const url = new URL(result.url);
          const scopeParam = url.searchParams.get('scope');

          expect(scopeParam).toBeTruthy();
          expect(scopeParam).toContain('https://www.googleapis.com/auth/generative-language');
          expect(scopeParam!.split(' ')).toContain('https://www.googleapis.com/auth/generative-language');
        }
      ),
      { numRuns: 100 }
    );
  });

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

          const result = await URLBuilder.generateAuthorizationUrl(config, configOptions.state);
          const url = new URL(result.url);

          expect(url.origin).toBe('https://accounts.google.com');
          expect(url.pathname).toBe('/o/oauth2/v2/auth');
          expect(url.searchParams.get('response_type')).toBe('code');
          expect(url.searchParams.get('client_id')).toBe(configOptions.clientId);
          expect(url.searchParams.get('redirect_uri')).toBe(configOptions.redirectUri);
          expect(url.searchParams.get('scope')).toBeTruthy();
        }
      ),
      { numRuns: 100 }
    );
  });
});
