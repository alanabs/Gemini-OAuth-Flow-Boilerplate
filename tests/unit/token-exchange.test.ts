/**
 * Unit tests for token exchange error handling
 * Tests specific error scenarios from Google's token endpoint
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TokenExchange } from '../../src/token-exchange';
import { OAuthError, OAuthErrorType } from '../../src/types';

describe('TokenExchange Error Handling', () => {
  // Store original fetch
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Mock fetch for each test
    global.fetch = vi.fn();
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('access_denied error scenario', () => {
    it('should throw OAuthError with ACCESS_DENIED type when user denies authorization', async () => {
      // Mock fetch to return access_denied error
      (global.fetch as any).mockResolvedValue({
        ok: false,
        json: async () => ({
          error: 'access_denied',
          error_description: 'The user denied access to your application',
        }),
      });

      // Attempt token exchange
      await expect(
        TokenExchange.exchangeCodeForTokens(
          'test_code',
          'test_client_id',
          'test_client_secret',
          'https://example.com/callback'
        )
      ).rejects.toThrow(OAuthError);

      // Verify error details
      try {
        await TokenExchange.exchangeCodeForTokens(
          'test_code',
          'test_client_id',
          'test_client_secret',
          'https://example.com/callback'
        );
      } catch (error) {
        expect(error).toBeInstanceOf(OAuthError);
        expect((error as OAuthError).type).toBe(OAuthErrorType.ACCESS_DENIED);
        expect((error as OAuthError).message).toContain('The user denied access');
        expect((error as OAuthError).retryable).toBe(false);
      }
    });

    it('should include original error response in OAuthError', async () => {
      const errorResponse = {
        error: 'access_denied',
        error_description: 'User cancelled the authorization',
      };

      (global.fetch as any).mockResolvedValue({
        ok: false,
        json: async () => errorResponse,
      });

      try {
        await TokenExchange.exchangeCodeForTokens(
          'test_code',
          'test_client_id',
          'test_client_secret',
          'https://example.com/callback'
        );
      } catch (error) {
        expect((error as OAuthError).originalError).toEqual(errorResponse);
      }
    });
  });

  describe('invalid_grant error scenario', () => {
    it('should throw OAuthError with INVALID_GRANT type when authorization code is invalid', async () => {
      // Mock fetch to return invalid_grant error
      (global.fetch as any).mockResolvedValue({
        ok: false,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'The authorization code is invalid or has expired',
        }),
      });

      // Attempt token exchange
      await expect(
        TokenExchange.exchangeCodeForTokens(
          'invalid_code',
          'test_client_id',
          'test_client_secret',
          'https://example.com/callback'
        )
      ).rejects.toThrow(OAuthError);

      // Verify error details
      try {
        await TokenExchange.exchangeCodeForTokens(
          'invalid_code',
          'test_client_id',
          'test_client_secret',
          'https://example.com/callback'
        );
      } catch (error) {
        expect(error).toBeInstanceOf(OAuthError);
        expect((error as OAuthError).type).toBe(OAuthErrorType.INVALID_GRANT);
        expect((error as OAuthError).message).toContain('authorization code is invalid');
        expect((error as OAuthError).retryable).toBe(false);
      }
    });

    it('should handle invalid_grant when code has already been used', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'Code was already redeemed',
        }),
      });

      try {
        await TokenExchange.exchangeCodeForTokens(
          'used_code',
          'test_client_id',
          'test_client_secret',
          'https://example.com/callback'
        );
      } catch (error) {
        expect(error).toBeInstanceOf(OAuthError);
        expect((error as OAuthError).type).toBe(OAuthErrorType.INVALID_GRANT);
        expect((error as OAuthError).message).toContain('Code was already redeemed');
      }
    });

    it('should handle invalid_grant when PKCE verifier is incorrect', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'Code verifier does not match code challenge',
        }),
      });

      try {
        await TokenExchange.exchangeCodeForTokens(
          'test_code',
          'test_client_id',
          undefined,
          'https://example.com/callback',
          'wrong_verifier'
        );
      } catch (error) {
        expect(error).toBeInstanceOf(OAuthError);
        expect((error as OAuthError).type).toBe(OAuthErrorType.INVALID_GRANT);
        expect((error as OAuthError).message).toContain('Code verifier does not match');
      }
    });
  });

  describe('other error scenarios', () => {
    it('should handle invalid_request error', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        json: async () => ({
          error: 'invalid_request',
          error_description: 'Missing required parameter: code',
        }),
      });

      try {
        await TokenExchange.exchangeCodeForTokens(
          '',
          'test_client_id',
          'test_client_secret',
          'https://example.com/callback'
        );
      } catch (error) {
        expect(error).toBeInstanceOf(OAuthError);
        expect((error as OAuthError).type).toBe(OAuthErrorType.INVALID_REQUEST);
      }
    });

    it('should handle unauthorized_client error', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        json: async () => ({
          error: 'unauthorized_client',
          error_description: 'Client is not authorized',
        }),
      });

      try {
        await TokenExchange.exchangeCodeForTokens(
          'test_code',
          'invalid_client_id',
          'invalid_secret',
          'https://example.com/callback'
        );
      } catch (error) {
        expect(error).toBeInstanceOf(OAuthError);
        expect((error as OAuthError).type).toBe(OAuthErrorType.UNAUTHORIZED_CLIENT);
      }
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network connection failed'));

      try {
        await TokenExchange.exchangeCodeForTokens(
          'test_code',
          'test_client_id',
          'test_client_secret',
          'https://example.com/callback'
        );
      } catch (error) {
        expect(error).toBeInstanceOf(OAuthError);
        expect((error as OAuthError).type).toBe(OAuthErrorType.NETWORK_ERROR);
        expect((error as OAuthError).message).toContain('Token exchange failed');
        expect((error as OAuthError).retryable).toBe(true);
      }
    });
  });
});
