/**
 * Unit tests for Gemini API client error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GeminiClient } from '../../src/gemini-client';
import { TokenManager } from '../../src/token-manager';
import { InMemoryTokenStore } from '../../src/token-store';
import { TokenData, GeminiRequest, OAuthError, OAuthErrorType } from '../../src/types';

describe('GeminiClient Unit Tests', () => {
  let tokenStore: InMemoryTokenStore;
  let tokenManager: TokenManager;
  let geminiClient: GeminiClient;
  const userId = 'test-user-123';

  beforeEach(() => {
    // Create a 32-byte encryption key (base64 encoded)
    const encryptionKey = Buffer.from('12345678901234567890123456789012').toString('base64');
    tokenStore = new InMemoryTokenStore(encryptionKey);
    tokenManager = new TokenManager('test-client-id', 'test-client-secret', tokenStore);
    geminiClient = new GeminiClient(tokenManager);

    // Setup a valid token for the user
    const tokenData: TokenData = {
      accessToken: 'valid-access-token',
      refreshToken: 'valid-refresh-token',
      expiresAt: Date.now() + 3600000, // 1 hour from now
      scope: 'https://www.googleapis.com/auth/generative-language',
      tokenType: 'Bearer',
    };
    tokenStore.saveTokens(userId, tokenData);
  });

  /**
   * Test 401 retry logic
   * Requirements: 5.2
   * 
   * When the API returns 401 unauthorized, the client should attempt token refresh
   * and retry the request once.
   */
  it('should retry request once after 401 error with token refresh', async () => {
    let callCount = 0;
    const originalFetch = global.fetch;

    global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      callCount++;

      if (callCount === 1) {
        // First call returns 401
        return new Response(
          JSON.stringify({ error: { message: 'Invalid authentication' } }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      } else {
        // Second call (after refresh) succeeds
        return new Response(
          JSON.stringify({
            candidates: [{
              content: {
                parts: [{ text: 'Success after retry' }]
              },
              finishReason: 'STOP'
            }]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }) as any;

    try {
      const request: GeminiRequest = {
        contents: [{
          parts: [{ text: 'Test prompt' }]
        }]
      };

      const response = await geminiClient.generateContent(userId, request);

      // Verify the request was retried
      expect(callCount).toBe(2);
      expect(response.candidates[0].content.parts[0].text).toBe('Success after retry');
    } finally {
      global.fetch = originalFetch;
    }
  });

  /**
   * Test quota exceeded error handling
   * Requirements: 5.3
   * 
   * When the API returns 429 quota exceeded, the client should throw an error
   * without retrying.
   */
  it('should throw QUOTA_EXCEEDED error without retry on 429', async () => {
    let callCount = 0;
    const originalFetch = global.fetch;

    global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      callCount++;
      return new Response(
        JSON.stringify({ 
          error: { 
            message: 'Quota exceeded for quota metric',
            status: 'RESOURCE_EXHAUSTED'
          } 
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }) as any;

    try {
      const request: GeminiRequest = {
        contents: [{
          parts: [{ text: 'Test prompt' }]
        }]
      };

      try {
        await geminiClient.generateContent(userId, request);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(OAuthError);
        expect((error as OAuthError).type).toBe(OAuthErrorType.QUOTA_EXCEEDED);
        expect((error as OAuthError).retryable).toBe(false);
        expect((error as OAuthError).message).toContain('quota exceeded');
      }

      // Verify the request was NOT retried (only called once)
      expect(callCount).toBe(1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  /**
   * Test that 401 errors eventually fail if token refresh doesn't help
   */
  it('should fail after retry if 401 persists', async () => {
    let callCount = 0;
    const originalFetch = global.fetch;

    global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      callCount++;
      // Always return 401
      return new Response(
        JSON.stringify({ error: { message: 'Invalid authentication' } }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }) as any;

    try {
      const request: GeminiRequest = {
        contents: [{
          parts: [{ text: 'Test prompt' }]
        }]
      };

      try {
        await geminiClient.generateContent(userId, request);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(OAuthError);
        expect((error as OAuthError).type).toBe(OAuthErrorType.UNAUTHORIZED_CLIENT);
      }

      // Should have tried twice (initial + one retry)
      expect(callCount).toBe(2);
    } finally {
      global.fetch = originalFetch;
    }
  });

  /**
   * Test successful API call
   */
  it('should successfully make API call with valid token', async () => {
    const originalFetch = global.fetch;

    global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      return new Response(
        JSON.stringify({
          candidates: [{
            content: {
              parts: [{ text: 'Generated content' }]
            },
            finishReason: 'STOP'
          }]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as any;

    try {
      const request: GeminiRequest = {
        contents: [{
          parts: [{ text: 'Test prompt' }]
        }]
      };

      const response = await geminiClient.generateContent(userId, request);

      expect(response.candidates).toHaveLength(1);
      expect(response.candidates[0].content.parts[0].text).toBe('Generated content');
      expect(response.candidates[0].finishReason).toBe('STOP');
    } finally {
      global.fetch = originalFetch;
    }
  });

  /**
   * Test network error handling
   */
  it('should throw NETWORK_ERROR on network failure', async () => {
    const originalFetch = global.fetch;

    global.fetch = vi.fn(async () => {
      throw new Error('Network connection failed');
    }) as any;

    try {
      const request: GeminiRequest = {
        contents: [{
          parts: [{ text: 'Test prompt' }]
        }]
      };

      await expect(geminiClient.generateContent(userId, request)).rejects.toThrow(OAuthError);

      try {
        await geminiClient.generateContent(userId, request);
      } catch (error) {
        expect(error).toBeInstanceOf(OAuthError);
        expect((error as OAuthError).type).toBe(OAuthErrorType.NETWORK_ERROR);
        expect((error as OAuthError).retryable).toBe(true);
      }
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should reject malformed Gemini responses', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ notCandidates: true }),
    }) as any;

    await expect(
      geminiClient.generateContent(userId, {
        contents: [{ parts: [{ text: 'Hello' }] }],
      })
    ).rejects.toMatchObject({ type: OAuthErrorType.UPSTREAM_MALFORMED_RESPONSE });
  });

});
