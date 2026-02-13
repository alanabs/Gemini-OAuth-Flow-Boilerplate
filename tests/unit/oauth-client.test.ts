/**
 * Unit tests for GoogleOAuthClient
 * Tests token revocation and main OAuth flow
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GoogleOAuthClient } from '../../src/oauth-client';
import { InMemoryTokenStore } from '../../src/token-store';
import { TokenData, OAuthErrorType } from '../../src/types';

describe('GoogleOAuthClient', () => {
  let tokenStore: InMemoryTokenStore;
  let client: GoogleOAuthClient;

  beforeEach(() => {
    // Create a 32-byte buffer and encode as base64
    const key = Buffer.from('12345678901234567890123456789012');
    tokenStore = new InMemoryTokenStore(key.toString('base64'));
    client = new GoogleOAuthClient(
      {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'https://example.com/callback',
        scopes: ['https://www.googleapis.com/auth/generative-language'],
      },
      tokenStore
    );

    // Clear all mocks
    vi.restoreAllMocks();
  });

  describe('signOut', () => {
    it('should call Google revocation endpoint with refresh token', async () => {
      // Arrange
      const userId = 'test-user-123';
      const tokens: TokenData = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: Date.now() + 3600000,
        scope: 'test-scope',
        tokenType: 'Bearer',
      };

      // Save tokens to store
      await tokenStore.saveTokens(userId, tokens);

      // Mock fetch to capture the revocation request
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      });
      global.fetch = mockFetch;

      // Act
      await client.signOut(userId);

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/revoke',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'token=test-refresh-token',
        })
      );

      // Verify tokens were deleted from store
      const storedTokens = await tokenStore.getTokens(userId);
      expect(storedTokens).toBeNull();
    });

    it('should delete tokens even if revocation fails', async () => {
      // Arrange
      const userId = 'test-user-123';
      const tokens: TokenData = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: Date.now() + 3600000,
        scope: 'test-scope',
        tokenType: 'Bearer',
      };

      await tokenStore.saveTokens(userId, tokens);

      // Mock fetch to simulate revocation failure
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ error: 'invalid_token' }),
      });
      global.fetch = mockFetch;

      // Act & Assert
      await expect(client.signOut(userId)).rejects.toThrow();

      // Verify revocation was attempted
      expect(mockFetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/revoke',
        expect.any(Object)
      );
    });

    it('should handle signOut when no tokens exist', async () => {
      // Arrange
      const userId = 'non-existent-user';

      // Mock fetch (should not be called)
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      // Act
      await client.signOut(userId);

      // Assert - revocation should not be called if no tokens exist
      expect(mockFetch).not.toHaveBeenCalled();

      // Verify deleteTokens was still called
      const storedTokens = await tokenStore.getTokens(userId);
      expect(storedTokens).toBeNull();
    });

    it('should handle network errors during revocation', async () => {
      // Arrange
      const userId = 'test-user-123';
      const tokens: TokenData = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: Date.now() + 3600000,
        scope: 'test-scope',
        tokenType: 'Bearer',
      };

      await tokenStore.saveTokens(userId, tokens);

      // Mock fetch to simulate network error
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = mockFetch;

      // Act & Assert
      await expect(client.signOut(userId)).rejects.toThrow('Token revocation failed: Network error');
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should generate authorization URL with all required parameters', async () => {
      // Act
      const result = await client.getAuthorizationUrl('test-state');

      // Assert
      expect(result.url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(result.url).toContain('response_type=code');
      expect(result.url).toContain('client_id=test-client-id');
      expect(result.url).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Fcallback');
      expect(result.url).toContain('state=test-state');
      expect(result.state).toBe('test-state');
      expect(result.codeVerifier).toBeDefined(); // PKCE is enabled by default
    });
  });

  describe('getUserInfo', () => {
    it('should return null when no tokens exist', async () => {
      // Act
      const userInfo = await client.getUserInfo('non-existent-user');

      // Assert
      expect(userInfo).toBeNull();
    });

    it('should return user info when tokens exist', async () => {
      // Arrange
      const userId = 'test-user-123';
      const tokens: TokenData = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: Date.now() + 3600000,
        scope: 'test-scope',
        tokenType: 'Bearer',
      };

      await tokenStore.saveTokens(userId, tokens);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          sub: userId,
          email: 'test@example.com',
          email_verified: true,
          name: 'Test User',
          picture: '',
          given_name: 'Test',
          family_name: 'User',
        }),
      });
      global.fetch = mockFetch;

      // Act
      const userInfo = await client.getUserInfo(userId);

      // Assert
      expect(userInfo).not.toBeNull();
      expect(userInfo?.sub).toBe(userId);
      expect(userInfo?.email).toBe('test@example.com');
    });
  });
});
