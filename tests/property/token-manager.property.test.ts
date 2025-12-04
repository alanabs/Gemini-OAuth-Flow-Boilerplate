/**
 * Property-based tests for TokenManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { TokenManager } from '../../src/token-manager';
import { InMemoryTokenStore } from '../../src/token-store';
import { TokenData, OAuthErrorType } from '../../src/types';

describe('TokenManager Property Tests', () => {
  let tokenStore: InMemoryTokenStore;

  beforeEach(() => {
    tokenStore = new InMemoryTokenStore();
    // Clear all mocks before each test
    vi.restoreAllMocks();
  });

  /**
   * Feature: google-oauth-gemini-boilerplate, Property 10: Expired token triggers refresh
   * Validates: Requirements 4.1, 4.4
   * 
   * For any user with an expired access token and valid refresh token,
   * attempting to get a valid access token should trigger a refresh operation before returning the token.
   */
  it('Property 10: Expired token triggers refresh', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        fc.string({ minLength: 20, maxLength: 100 }), // old access token
        fc.string({ minLength: 20, maxLength: 100 }), // refresh token
        fc.string({ minLength: 20, maxLength: 100 }), // new access token
        fc.integer({ min: 1, max: 3600 }), // expires_in seconds
        async (userId, oldAccessToken, refreshToken, newAccessToken, expiresIn) => {
          // Ensure tokens are different
          fc.pre(oldAccessToken !== newAccessToken);
          fc.pre(oldAccessToken !== refreshToken);
          fc.pre(newAccessToken !== refreshToken);

          const tokenManager = new TokenManager('test-client-id', 'test-secret', tokenStore);

          // Store an expired token
          const expiredTokenData: TokenData = {
            accessToken: oldAccessToken,
            refreshToken: refreshToken,
            expiresAt: Date.now() - 1000, // Expired 1 second ago
            scope: 'https://www.googleapis.com/auth/generative-language',
            tokenType: 'Bearer',
          };
          await tokenStore.saveTokens(userId, expiredTokenData);

          // Mock fetch to simulate successful token refresh
          const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
              access_token: newAccessToken,
              refresh_token: refreshToken,
              expires_in: expiresIn,
              scope: 'https://www.googleapis.com/auth/generative-language',
              token_type: 'Bearer',
            }),
            headers: new Map(),
          });
          global.fetch = mockFetch as any;

          // Get valid access token - should trigger refresh
          const result = await tokenManager.getValidAccessToken(userId);

          // Verify that fetch was called (refresh was triggered)
          expect(mockFetch).toHaveBeenCalledTimes(1);
          
          // Verify the result is the new access token
          expect(result).toBe(newAccessToken);

          // Verify token store was updated
          const updatedTokens = await tokenStore.getTokens(userId);
          expect(updatedTokens).not.toBeNull();
          expect(updatedTokens!.accessToken).toBe(newAccessToken);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: google-oauth-gemini-boilerplate, Property 16: Token validation before use
   * Validates: Requirements 8.5
   * 
   * For any token with an expiration timestamp in the past or with invalid format,
   * the OAuth Client should reject it and not use it for API calls.
   */
  it('Property 16: Token validation before use', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        fc.string({ minLength: 20, maxLength: 100 }), // access token
        fc.string({ minLength: 20, maxLength: 100 }), // refresh token
        fc.integer({ min: 1, max: 86400 }), // seconds in the past
        async (userId, accessToken, refreshToken, secondsInPast) => {
          fc.pre(accessToken !== refreshToken);

          const tokenManager = new TokenManager('test-client-id', 'test-secret', tokenStore);

          // Store a token that expired in the past
          const expiredTokenData: TokenData = {
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresAt: Date.now() - (secondsInPast * 1000), // Expired in the past
            scope: 'https://www.googleapis.com/auth/generative-language',
            tokenType: 'Bearer',
          };
          await tokenStore.saveTokens(userId, expiredTokenData);

          // Verify that isTokenExpired correctly identifies expired tokens
          const isExpired = tokenManager.isTokenExpired(expiredTokenData.expiresAt);
          expect(isExpired).toBe(true);

          // Mock fetch for refresh
          const newAccessToken = accessToken + '_refreshed';
          const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
              access_token: newAccessToken,
              refresh_token: refreshToken,
              expires_in: 3600,
              scope: 'https://www.googleapis.com/auth/generative-language',
              token_type: 'Bearer',
            }),
            headers: new Map(),
          });
          global.fetch = mockFetch as any;

          // Getting valid access token should NOT return the expired token
          const result = await tokenManager.getValidAccessToken(userId);
          
          // Should have triggered refresh and returned new token
          expect(result).not.toBe(accessToken);
          expect(result).toBe(newAccessToken);
          expect(mockFetch).toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Tokens within expiration buffer trigger refresh
   * Tests that tokens expiring within 5 minutes are considered expired
   */
  it('Property: Tokens within expiration buffer trigger refresh', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        fc.string({ minLength: 20, maxLength: 100 }), // access token
        fc.string({ minLength: 20, maxLength: 100 }), // refresh token
        fc.integer({ min: 1, max: 299 }), // seconds until expiration (less than 5 minutes)
        async (userId, accessToken, refreshToken, secondsUntilExpiration) => {
          fc.pre(accessToken !== refreshToken);

          const tokenManager = new TokenManager('test-client-id', 'test-secret', tokenStore);

          // Store a token that will expire soon (within 5 minute buffer)
          const soonToExpireTokenData: TokenData = {
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresAt: Date.now() + (secondsUntilExpiration * 1000),
            scope: 'https://www.googleapis.com/auth/generative-language',
            tokenType: 'Bearer',
          };
          await tokenStore.saveTokens(userId, soonToExpireTokenData);

          // Verify that isTokenExpired correctly identifies soon-to-expire tokens
          const isExpired = tokenManager.isTokenExpired(soonToExpireTokenData.expiresAt);
          expect(isExpired).toBe(true);

          // Mock fetch for refresh
          const newAccessToken = accessToken + '_refreshed';
          const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
              access_token: newAccessToken,
              refresh_token: refreshToken,
              expires_in: 3600,
              scope: 'https://www.googleapis.com/auth/generative-language',
              token_type: 'Bearer',
            }),
            headers: new Map(),
          });
          global.fetch = mockFetch as any;

          // Getting valid access token should trigger refresh
          const result = await tokenManager.getValidAccessToken(userId);
          
          expect(mockFetch).toHaveBeenCalled();
          expect(result).toBe(newAccessToken);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Valid tokens (not expired) don't trigger refresh
   */
  it('Property: Valid tokens do not trigger refresh', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        fc.string({ minLength: 20, maxLength: 100 }), // access token
        fc.string({ minLength: 20, maxLength: 100 }), // refresh token
        fc.integer({ min: 301, max: 7200 }), // seconds until expiration (more than 5 minutes)
        async (userId, accessToken, refreshToken, secondsUntilExpiration) => {
          fc.pre(accessToken !== refreshToken);

          const tokenManager = new TokenManager('test-client-id', 'test-secret', tokenStore);

          // Store a valid token that won't expire soon
          const validTokenData: TokenData = {
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresAt: Date.now() + (secondsUntilExpiration * 1000),
            scope: 'https://www.googleapis.com/auth/generative-language',
            tokenType: 'Bearer',
          };
          await tokenStore.saveTokens(userId, validTokenData);

          // Verify that isTokenExpired correctly identifies valid tokens
          const isExpired = tokenManager.isTokenExpired(validTokenData.expiresAt);
          expect(isExpired).toBe(false);

          // Mock fetch (should not be called)
          const mockFetch = vi.fn();
          global.fetch = mockFetch as any;

          // Getting valid access token should NOT trigger refresh
          const result = await tokenManager.getValidAccessToken(userId);
          
          // Should return the existing token without calling fetch
          expect(result).toBe(accessToken);
          expect(mockFetch).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});
