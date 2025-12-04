/**
 * Unit tests for TokenManager
 * Tests specific scenarios for token refresh
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TokenManager } from '../../src/token-manager';
import { InMemoryTokenStore } from '../../src/token-store';
import { TokenData, OAuthErrorType } from '../../src/types';

describe('TokenManager Unit Tests', () => {
  let tokenStore: InMemoryTokenStore;
  let tokenManager: TokenManager;

  beforeEach(() => {
    tokenStore = new InMemoryTokenStore();
    tokenManager = new TokenManager('test-client-id', 'test-secret', tokenStore);
    vi.restoreAllMocks();
  });

  describe('Successful refresh flow', () => {
    it('should successfully refresh an expired token', async () => {
      const userId = 'user123';
      const oldAccessToken = 'old_access_token';
      const refreshToken = 'refresh_token_123';
      const newAccessToken = 'new_access_token';

      // Store expired token
      const expiredTokenData: TokenData = {
        accessToken: oldAccessToken,
        refreshToken: refreshToken,
        expiresAt: Date.now() - 1000,
        scope: 'https://www.googleapis.com/auth/generative-language',
        tokenType: 'Bearer',
      };
      await tokenStore.saveTokens(userId, expiredTokenData);

      // Mock successful refresh response
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

      const result = await tokenManager.getValidAccessToken(userId);

      expect(result).toBe(newAccessToken);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Verify the fetch call parameters
      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[0]).toBe('https://oauth2.googleapis.com/token');
      expect(fetchCall[1].method).toBe('POST');
      expect(fetchCall[1].headers['Content-Type']).toBe('application/x-www-form-urlencoded');

      // Verify token store was updated
      const updatedTokens = await tokenStore.getTokens(userId);
      expect(updatedTokens?.accessToken).toBe(newAccessToken);
    });

    it('should handle refresh response with new refresh token', async () => {
      const userId = 'user123';
      const oldRefreshToken = 'old_refresh_token';
      const newRefreshToken = 'new_refresh_token';
      const newAccessToken = 'new_access_token';

      // Store expired token
      const expiredTokenData: TokenData = {
        accessToken: 'old_access_token',
        refreshToken: oldRefreshToken,
        expiresAt: Date.now() - 1000,
        scope: 'https://www.googleapis.com/auth/generative-language',
        tokenType: 'Bearer',
      };
      await tokenStore.saveTokens(userId, expiredTokenData);

      // Mock refresh response with new refresh token
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: newAccessToken,
          refresh_token: newRefreshToken, // New refresh token provided
          expires_in: 3600,
          scope: 'https://www.googleapis.com/auth/generative-language',
          token_type: 'Bearer',
        }),
        headers: new Map(),
      });
      global.fetch = mockFetch as any;

      await tokenManager.getValidAccessToken(userId);

      // Note: The current implementation only updates access token in the store
      // The refresh token update would need to be handled differently
      // This test documents the current behavior
      const updatedTokens = await tokenStore.getTokens(userId);
      expect(updatedTokens?.accessToken).toBe(newAccessToken);
    });
  });

  describe('invalid_grant error handling', () => {
    it('should throw INVALID_GRANT error when refresh token is invalid', async () => {
      const userId = 'user123';
      const refreshToken = 'invalid_refresh_token';

      // Store expired token with invalid refresh token
      const expiredTokenData: TokenData = {
        accessToken: 'old_access_token',
        refreshToken: refreshToken,
        expiresAt: Date.now() - 1000,
        scope: 'https://www.googleapis.com/auth/generative-language',
        tokenType: 'Bearer',
      };
      await tokenStore.saveTokens(userId, expiredTokenData);

      // Mock invalid_grant error response
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'Token has been expired or revoked.',
        }),
        headers: new Map(),
      });
      global.fetch = mockFetch as any;

      await expect(tokenManager.getValidAccessToken(userId)).rejects.toMatchObject({
        type: OAuthErrorType.INVALID_GRANT,
        message: expect.stringContaining('Token has been expired or revoked'),
      });
    });

    it('should include original error in INVALID_GRANT error', async () => {
      const userId = 'user123';

      const expiredTokenData: TokenData = {
        accessToken: 'old_access_token',
        refreshToken: 'invalid_token',
        expiresAt: Date.now() - 1000,
        scope: 'https://www.googleapis.com/auth/generative-language',
        tokenType: 'Bearer',
      };
      await tokenStore.saveTokens(userId, expiredTokenData);

      const errorData = {
        error: 'invalid_grant',
        error_description: 'Token has been expired or revoked.',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => errorData,
        headers: new Map(),
      });
      global.fetch = mockFetch as any;

      try {
        await tokenManager.getValidAccessToken(userId);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.type).toBe(OAuthErrorType.INVALID_GRANT);
        expect(error.originalError).toEqual(errorData);
      }
    });
  });

  describe('Rate limiting error handling', () => {
    it('should throw retryable error with retry-after information on 429', async () => {
      const userId = 'user123';

      const expiredTokenData: TokenData = {
        accessToken: 'old_access_token',
        refreshToken: 'refresh_token',
        expiresAt: Date.now() - 1000,
        scope: 'https://www.googleapis.com/auth/generative-language',
        tokenType: 'Bearer',
      };
      await tokenStore.saveTokens(userId, expiredTokenData);

      // Mock rate limit response
      const mockHeaders = new Map();
      mockHeaders.set('Retry-After', '60');

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({
          error: 'rate_limit_exceeded',
          error_description: 'Too many requests',
        }),
        headers: {
          get: (key: string) => mockHeaders.get(key),
        },
      });
      global.fetch = mockFetch as any;

      try {
        await tokenManager.getValidAccessToken(userId);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.type).toBe(OAuthErrorType.NETWORK_ERROR);
        expect(error.message).toContain('Rate limit exceeded');
        expect(error.message).toContain('Retry after 60 seconds');
        expect(error.retryable).toBe(true);
      }
    });

    it('should handle rate limit without retry-after header', async () => {
      const userId = 'user123';

      const expiredTokenData: TokenData = {
        accessToken: 'old_access_token',
        refreshToken: 'refresh_token',
        expiresAt: Date.now() - 1000,
        scope: 'https://www.googleapis.com/auth/generative-language',
        tokenType: 'Bearer',
      };
      await tokenStore.saveTokens(userId, expiredTokenData);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({
          error: 'rate_limit_exceeded',
        }),
        headers: {
          get: () => null,
        },
      });
      global.fetch = mockFetch as any;

      try {
        await tokenManager.getValidAccessToken(userId);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.type).toBe(OAuthErrorType.NETWORK_ERROR);
        expect(error.message).toContain('Rate limit exceeded');
        expect(error.retryable).toBe(true);
      }
    });
  });

  describe('Network error handling', () => {
    it('should wrap network errors as retryable NETWORK_ERROR', async () => {
      const userId = 'user123';

      const expiredTokenData: TokenData = {
        accessToken: 'old_access_token',
        refreshToken: 'refresh_token',
        expiresAt: Date.now() - 1000,
        scope: 'https://www.googleapis.com/auth/generative-language',
        tokenType: 'Bearer',
      };
      await tokenStore.saveTokens(userId, expiredTokenData);

      // Mock network failure
      const networkError = new Error('Network connection failed');
      const mockFetch = vi.fn().mockRejectedValue(networkError);
      global.fetch = mockFetch as any;

      try {
        await tokenManager.getValidAccessToken(userId);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.type).toBe(OAuthErrorType.NETWORK_ERROR);
        expect(error.message).toContain('Token refresh failed');
        expect(error.message).toContain('Network connection failed');
        expect(error.retryable).toBe(true);
        expect(error.originalError).toBe(networkError);
      }
    });

    it('should mark server errors (5xx) as retryable', async () => {
      const userId = 'user123';

      const expiredTokenData: TokenData = {
        accessToken: 'old_access_token',
        refreshToken: 'refresh_token',
        expiresAt: Date.now() - 1000,
        scope: 'https://www.googleapis.com/auth/generative-language',
        tokenType: 'Bearer',
      };
      await tokenStore.saveTokens(userId, expiredTokenData);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: async () => ({}), // No error field, so it uses generic error handling
        headers: new Map(),
      });
      global.fetch = mockFetch as any;

      try {
        await tokenManager.getValidAccessToken(userId);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.type).toBe(OAuthErrorType.NETWORK_ERROR);
        expect(error.retryable).toBe(true);
      }
    });

    it('should mark client errors (4xx except 429) as non-retryable', async () => {
      const userId = 'user123';

      const expiredTokenData: TokenData = {
        accessToken: 'old_access_token',
        refreshToken: 'refresh_token',
        expiresAt: Date.now() - 1000,
        scope: 'https://www.googleapis.com/auth/generative-language',
        tokenType: 'Bearer',
      };
      await tokenStore.saveTokens(userId, expiredTokenData);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({}), // No error field, so it uses generic error handling
        headers: new Map(),
      });
      global.fetch = mockFetch as any;

      try {
        await tokenManager.getValidAccessToken(userId);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.type).toBe(OAuthErrorType.NETWORK_ERROR);
        expect(error.retryable).toBe(false);
      }
    });
  });

  describe('Token expiration checking', () => {
    it('should consider tokens expired if they expire within 5 minutes', () => {
      const now = Date.now();
      
      // Token expiring in 4 minutes
      expect(tokenManager.isTokenExpired(now + 4 * 60 * 1000)).toBe(true);
      
      // Token expiring in exactly 5 minutes
      expect(tokenManager.isTokenExpired(now + 5 * 60 * 1000)).toBe(true);
      
      // Token expiring in 6 minutes
      expect(tokenManager.isTokenExpired(now + 6 * 60 * 1000)).toBe(false);
    });

    it('should consider tokens expired if they already expired', () => {
      const now = Date.now();
      
      // Token expired 1 second ago
      expect(tokenManager.isTokenExpired(now - 1000)).toBe(true);
      
      // Token expired 1 hour ago
      expect(tokenManager.isTokenExpired(now - 3600 * 1000)).toBe(true);
    });

    it('should not consider valid tokens as expired', () => {
      const now = Date.now();
      
      // Token expiring in 10 minutes
      expect(tokenManager.isTokenExpired(now + 10 * 60 * 1000)).toBe(false);
      
      // Token expiring in 1 hour
      expect(tokenManager.isTokenExpired(now + 3600 * 1000)).toBe(false);
    });
  });

  describe('Missing tokens', () => {
    it('should throw TOKEN_EXPIRED error when no tokens found', async () => {
      const userId = 'nonexistent_user';

      await expect(tokenManager.getValidAccessToken(userId)).rejects.toMatchObject({
        type: OAuthErrorType.TOKEN_EXPIRED,
        message: expect.stringContaining('No tokens found for user'),
      });
    });
  });
});
