/**
 * Integration tests for complete OAuth flow
 * Tests end-to-end scenarios with mocked Google endpoints
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GoogleOAuthClient } from '../../src/oauth-client';
import { InMemoryTokenStore } from '../../src/token-store';
import { OAuthErrorType } from '../../src/types';

describe('OAuth Flow Integration Tests', () => {
  let tokenStore: InMemoryTokenStore;
  let client: GoogleOAuthClient;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    // Save original fetch
    originalFetch = global.fetch;

    // Create a 32-byte buffer and encode as base64
    const key = Buffer.from('12345678901234567890123456789012');
    tokenStore = new InMemoryTokenStore(key.toString('base64'));
    client = new GoogleOAuthClient(
      {
        clientId: 'test-client-id.apps.googleusercontent.com',
        clientSecret: 'test-client-secret',
        redirectUri: 'https://example.com/callback',
        scopes: ['https://www.googleapis.com/auth/generative-language'],
      },
      tokenStore
    );
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('Complete OAuth Flow', () => {
    it('should complete full OAuth flow from authorization to API call', async () => {
      // Step 1: Generate authorization URL
      const authResult = await client.getAuthorizationUrl('test-state-123');
      
      expect(authResult.url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(authResult.url).toContain('client_id=test-client-id.apps.googleusercontent.com');
      expect(authResult.url).toContain('state=test-state-123');
      expect(authResult.codeVerifier).toBeDefined();

      // Step 2: Mock token exchange
      const mockIdToken = createMockIdToken({
        sub: 'user-123',
        email: 'test@example.com',
        email_verified: true,
        name: 'Test User',
        picture: 'https://example.com/photo.jpg',
        given_name: 'Test',
        family_name: 'User',
      });

      const mockFetch = vi.fn()
        // Token exchange call
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'mock-access-token',
            refresh_token: 'mock-refresh-token',
            expires_in: 3600,
            scope: 'https://www.googleapis.com/auth/generative-language',
            token_type: 'Bearer',
            id_token: mockIdToken,
          }),
        })
        // Gemini API call
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [{ text: 'Hello! How can I help you?' }],
                },
                finishReason: 'STOP',
              },
            ],
          }),
        });

      global.fetch = mockFetch;

      // Step 3: Handle callback and exchange code for tokens
      const userInfo = await client.handleCallback('mock-auth-code', authResult.codeVerifier);

      expect(userInfo.sub).toBe('user-123');
      expect(userInfo.email).toBe('test@example.com');
      expect(userInfo.name).toBe('Test User');

      // Verify token exchange was called correctly
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      );

      // Step 4: Make authenticated Gemini API call
      const response = await client.callGemini(userInfo.sub, {
        contents: [
          {
            parts: [{ text: 'Hello' }],
          },
        ],
      });

      expect(response.candidates).toHaveLength(1);
      expect(response.candidates[0].content.parts[0].text).toBe('Hello! How can I help you?');

      // Verify Gemini API was called with correct authorization
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-access-token',
            'Content-Type': 'application/json',
          }),
        })
      );

      // Verify tokens were stored
      const storedTokens = await tokenStore.getTokens(userInfo.sub);
      expect(storedTokens).not.toBeNull();
      expect(storedTokens?.accessToken).toBe('mock-access-token');
      expect(storedTokens?.refreshToken).toBe('mock-refresh-token');
    });

    it('should handle user denying authorization', async () => {
      // Mock token exchange with access_denied error
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'access_denied',
          error_description: 'User denied access',
        }),
      });

      global.fetch = mockFetch;

      // Attempt to handle callback with denied authorization
      await expect(
        client.handleCallback('mock-auth-code', 'mock-verifier')
      ).rejects.toThrow('User denied access');
    });

    it('should handle invalid authorization code', async () => {
      // Mock token exchange with invalid_grant error
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'Invalid authorization code',
        }),
      });

      global.fetch = mockFetch;

      // Attempt to handle callback with invalid code
      await expect(
        client.handleCallback('invalid-code', 'mock-verifier')
      ).rejects.toThrow('Invalid authorization code');
    });
  });

  describe('Token Refresh Flow', () => {
    it('should automatically refresh expired token before API call', async () => {
      // Setup: Store expired token
      const userId = 'user-123';
      await tokenStore.saveTokens(userId, {
        accessToken: 'expired-token',
        refreshToken: 'valid-refresh-token',
        expiresAt: Date.now() - 1000, // Expired 1 second ago
        scope: 'https://www.googleapis.com/auth/generative-language',
        tokenType: 'Bearer',
      });

      const mockFetch = vi.fn()
        // Token refresh call
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'new-access-token',
            expires_in: 3600,
            scope: 'https://www.googleapis.com/auth/generative-language',
            token_type: 'Bearer',
          }),
        })
        // Gemini API call
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [{ text: 'Response with refreshed token' }],
                },
                finishReason: 'STOP',
              },
            ],
          }),
        });

      global.fetch = mockFetch;

      // Make API call - should trigger token refresh
      const response = await client.callGemini(userId, {
        contents: [{ parts: [{ text: 'Test' }] }],
      });

      expect(response.candidates[0].content.parts[0].text).toBe('Response with refreshed token');

      // Verify token refresh was called
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('grant_type=refresh_token'),
        })
      );

      // Verify Gemini API was called with new token
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer new-access-token',
          }),
        })
      );

      // Verify token was updated in store
      const updatedTokens = await tokenStore.getTokens(userId);
      expect(updatedTokens?.accessToken).toBe('new-access-token');
    });

    it('should handle refresh token expiration', async () => {
      // Setup: Store token with expired refresh token
      const userId = 'user-123';
      await tokenStore.saveTokens(userId, {
        accessToken: 'expired-token',
        refreshToken: 'expired-refresh-token',
        expiresAt: Date.now() - 1000,
        scope: 'https://www.googleapis.com/auth/generative-language',
        tokenType: 'Bearer',
      });

      // Mock token refresh failure with invalid_grant
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'Token has been expired or revoked',
        }),
      });

      global.fetch = mockFetch;

      // Attempt to make API call - should fail with invalid_grant
      await expect(
        client.callGemini(userId, {
          contents: [{ parts: [{ text: 'Test' }] }],
        })
      ).rejects.toThrow('Token has been expired or revoked');
    });

    it('should handle rate limiting during token refresh', async () => {
      // Setup: Store expired token
      const userId = 'user-123';
      await tokenStore.saveTokens(userId, {
        accessToken: 'expired-token',
        refreshToken: 'valid-refresh-token',
        expiresAt: Date.now() - 1000,
        scope: 'https://www.googleapis.com/auth/generative-language',
        tokenType: 'Bearer',
      });

      // Mock rate limit response
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: {
          get: (name: string) => name === 'Retry-After' ? '60' : null,
        },
        json: async () => ({
          error: 'rate_limit_exceeded',
          error_description: 'Too many requests',
        }),
      });

      global.fetch = mockFetch;

      // Attempt to make API call - should fail with rate limit error
      await expect(
        client.callGemini(userId, {
          contents: [{ parts: [{ text: 'Test' }] }],
        })
      ).rejects.toThrow(/rate limit/i);
    });
  });

  describe('Gemini API Error Handling', () => {
    it('should handle 401 error by attempting token refresh', async () => {
      // Setup: Store token that appears valid but will be rejected by API
      const userId = 'user-123';
      await tokenStore.saveTokens(userId, {
        accessToken: 'valid-but-will-be-rejected',
        refreshToken: 'valid-refresh-token',
        expiresAt: Date.now() + 3600000, // Valid for 1 hour
        scope: 'https://www.googleapis.com/auth/generative-language',
        tokenType: 'Bearer',
      });

      const mockFetch = vi.fn()
        // First Gemini API call - returns 401
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({
            error: {
              code: 401,
              message: 'Request had invalid authentication credentials',
            },
          }),
        })
        // The 401 triggers getValidAccessToken again, but token isn't expired
        // so it returns the same token and retries
        // Second Gemini API call - also returns 401 (no more retries)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({
            error: {
              code: 401,
              message: 'Request had invalid authentication credentials',
            },
          }),
        });

      global.fetch = mockFetch;

      // Make API call - should get 401, retry once, then fail
      await expect(
        client.callGemini(userId, {
          contents: [{ parts: [{ text: 'Test' }] }],
        })
      ).rejects.toThrow(/access token is invalid or expired/i);

      // Verify two API calls were made (initial + one retry)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle quota exceeded error without retry', async () => {
      // Setup: Store valid token
      const userId = 'user-123';
      await tokenStore.saveTokens(userId, {
        accessToken: 'valid-token',
        refreshToken: 'valid-refresh-token',
        expiresAt: Date.now() + 3600000,
        scope: 'https://www.googleapis.com/auth/generative-language',
        tokenType: 'Bearer',
      });

      // Mock quota exceeded response
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: {
            code: 429,
            message: 'Quota exceeded for quota metric',
          },
        }),
      });

      global.fetch = mockFetch;

      // Attempt to make API call - should fail with quota exceeded
      await expect(
        client.callGemini(userId, {
          contents: [{ parts: [{ text: 'Test' }] }],
        })
      ).rejects.toThrow(/quota exceeded/i);

      // Verify only one call was made (no retry)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle network errors during API call', async () => {
      // Setup: Store valid token
      const userId = 'user-123';
      await tokenStore.saveTokens(userId, {
        accessToken: 'valid-token',
        refreshToken: 'valid-refresh-token',
        expiresAt: Date.now() + 3600000,
        scope: 'https://www.googleapis.com/auth/generative-language',
        tokenType: 'Bearer',
      });

      // Mock network error
      const mockFetch = vi.fn().mockRejectedValueOnce(new Error('Network connection failed'));

      global.fetch = mockFetch;

      // Attempt to make API call - should fail with network error
      await expect(
        client.callGemini(userId, {
          contents: [{ parts: [{ text: 'Test' }] }],
        })
      ).rejects.toThrow(/network connection failed/i);
    });
  });

  describe('Token Revocation Flow', () => {
    it('should successfully revoke tokens and sign out user', async () => {
      // Setup: Complete OAuth flow first
      const mockIdToken = createMockIdToken({
        sub: 'user-123',
        email: 'test@example.com',
        email_verified: true,
        name: 'Test User',
        picture: 'https://example.com/photo.jpg',
        given_name: 'Test',
        family_name: 'User',
      });

      let fetchCallCount = 0;
      const mockFetch = vi.fn()
        // Token exchange
        .mockImplementationOnce(async () => {
          fetchCallCount++;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              access_token: 'mock-access-token',
              refresh_token: 'mock-refresh-token',
              expires_in: 3600,
              scope: 'https://www.googleapis.com/auth/generative-language',
              token_type: 'Bearer',
              id_token: mockIdToken,
            }),
          };
        })
        // Token revocation
        .mockImplementationOnce(async () => {
          fetchCallCount++;
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
          };
        });

      global.fetch = mockFetch;

      // Step 1: Complete OAuth flow
      const userInfo = await client.handleCallback('mock-auth-code', 'mock-verifier');
      expect(userInfo.sub).toBe('user-123');

      // Verify tokens are stored
      let storedTokens = await tokenStore.getTokens(userInfo.sub);
      expect(storedTokens).not.toBeNull();

      // Step 2: Sign out
      await client.signOut(userInfo.sub);

      // Verify revocation was called
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'https://oauth2.googleapis.com/revoke',
        expect.objectContaining({
          method: 'POST',
          body: 'token=mock-refresh-token',
        })
      );

      // Verify tokens are deleted
      storedTokens = await tokenStore.getTokens(userInfo.sub);
      expect(storedTokens).toBeNull();
    });

    it('should handle revocation failure gracefully', async () => {
      // Setup: Store tokens
      const userId = 'user-123';
      await tokenStore.saveTokens(userId, {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresAt: Date.now() + 3600000,
        scope: 'https://www.googleapis.com/auth/generative-language',
        tokenType: 'Bearer',
      });

      // Mock revocation failure
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          error: 'invalid_token',
        }),
      });

      global.fetch = mockFetch;

      // Attempt to sign out - should throw error
      await expect(client.signOut(userId)).rejects.toThrow();

      // Verify revocation was attempted
      expect(mockFetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/revoke',
        expect.any(Object)
      );
    });
  });

  describe('Error Scenarios', () => {
    it('should handle missing tokens when making API call', async () => {
      const userId = 'non-existent-user';

      // Attempt to make API call without tokens
      await expect(
        client.callGemini(userId, {
          contents: [{ parts: [{ text: 'Test' }] }],
        })
      ).rejects.toThrow();

      try {
        await client.callGemini(userId, {
          contents: [{ parts: [{ text: 'Test' }] }],
        });
      } catch (error: any) {
        expect(error.type).toBe(OAuthErrorType.TOKEN_EXPIRED);
        expect(error.message).toContain('No tokens found');
      }
    });

    it('should handle malformed token response', async () => {
      // Mock malformed token response
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          // Missing required fields
          access_token: 'token',
          expires_in: 3600,
          scope: 'test',
          token_type: 'Bearer',
          // No id_token
        }),
      });

      global.fetch = mockFetch;

      // Attempt to handle callback - should fail due to missing ID token
      await expect(
        client.handleCallback('mock-code', 'mock-verifier')
      ).rejects.toThrow(/ID token/i);
    });

    it('should handle invalid ID token format', async () => {
      // Mock response with invalid ID token
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          expires_in: 3600,
          scope: 'https://www.googleapis.com/auth/generative-language',
          token_type: 'Bearer',
          id_token: 'invalid.token', // Invalid JWT format (only 2 parts)
        }),
      });

      global.fetch = mockFetch;

      // Attempt to handle callback - should fail due to invalid JWT format
      await expect(
        client.handleCallback('mock-code', 'mock-verifier')
      ).rejects.toThrow(/ID token/i);
    });
  });
});

/**
 * Helper function to create a mock ID token (JWT)
 */
function createMockIdToken(payload: any): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = 'mock-signature';

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Helper function to base64url encode a string
 */
function base64UrlEncode(str: string): string {
  const base64 = Buffer.from(str).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
