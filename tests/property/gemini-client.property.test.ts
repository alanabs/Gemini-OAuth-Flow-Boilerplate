/**
 * Property-based tests for Gemini API client
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { GeminiClient } from '../../src/gemini-client';
import { TokenManager } from '../../src/token-manager';
import { InMemoryTokenStore } from '../../src/token-store';
import { TokenData, GeminiRequest } from '../../src/types';

describe('GeminiClient Property Tests', () => {
  let tokenStore: InMemoryTokenStore;
  let tokenManager: TokenManager;
  let geminiClient: GeminiClient;

  beforeEach(() => {
    // Create a 32-byte encryption key (base64 encoded)
    const encryptionKey = Buffer.from('12345678901234567890123456789012').toString('base64');
    tokenStore = new InMemoryTokenStore(encryptionKey);
    tokenManager = new TokenManager('test-client-id', 'test-client-secret', tokenStore);
    geminiClient = new GeminiClient(tokenManager);
  });

  /**
   * Feature: google-oauth-gemini-boilerplate, Property 11: Authorization header format
   * Validates: Requirements 5.1
   * 
   * For any Gemini API request with a valid access token, the HTTP request should 
   * include an Authorization header with the format `Bearer {access_token}`.
   */
  it('should include Authorization header with Bearer token format', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 20, maxLength: 200 }).filter(s => s.trim().length > 0), // access token (non-empty)
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // user ID (non-empty)
        fc.string({ minLength: 10, maxLength: 500 }), // prompt text
        async (accessToken, userId, promptText) => {
          // Setup: Store a valid token
          const tokenData: TokenData = {
            accessToken,
            refreshToken: 'refresh-token',
            expiresAt: Date.now() + 3600000, // 1 hour from now
            scope: 'https://www.googleapis.com/auth/generative-language',
            tokenType: 'Bearer',
          };
          await tokenStore.saveTokens(userId, tokenData);

          // Mock fetch to capture the request
          let capturedAuthHeader: string | undefined;
          const originalFetch = global.fetch;
          global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
            // Capture the Authorization header directly from init
            if (init?.headers) {
              const headers = init.headers as Record<string, string>;
              capturedAuthHeader = headers['Authorization'];
            }
            
            // Return a mock successful response
            return new Response(
              JSON.stringify({
                candidates: [{
                  content: {
                    parts: [{ text: 'Mock response' }]
                  },
                  finishReason: 'STOP'
                }]
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          };

          try {
            const request: GeminiRequest = {
              contents: [{
                parts: [{ text: promptText }]
              }]
            };

            await geminiClient.generateContent(userId, request);

            // Verify Authorization header format
            expect(capturedAuthHeader).toBeDefined();
            expect(capturedAuthHeader).toBe(`Bearer ${accessToken}`);
          } finally {
            global.fetch = originalFetch;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: google-oauth-gemini-boilerplate, Property 12: API endpoint format
   * Validates: Requirements 5.4
   * 
   * For any Gemini API request, the constructed URL should match the pattern 
   * `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`.
   */
  it('should construct API endpoint URL with correct format', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // user ID
        fc.option(fc.constantFrom('gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro'), { nil: undefined }), // model
        fc.string({ minLength: 10, maxLength: 500 }), // prompt text
        async (userId, model, promptText) => {
          // Setup: Store a valid token
          const tokenData: TokenData = {
            accessToken: 'test-access-token',
            refreshToken: 'refresh-token',
            expiresAt: Date.now() + 3600000,
            scope: 'https://www.googleapis.com/auth/generative-language',
            tokenType: 'Bearer',
          };
          await tokenStore.saveTokens(userId, tokenData);

          // Mock fetch to capture the URL
          let capturedUrl: string | undefined;
          const originalFetch = global.fetch;
          global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
            capturedUrl = url.toString();
            
            return new Response(
              JSON.stringify({
                candidates: [{
                  content: {
                    parts: [{ text: 'Mock response' }]
                  },
                  finishReason: 'STOP'
                }]
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          };

          try {
            const request: GeminiRequest = {
              model,
              contents: [{
                parts: [{ text: promptText }]
              }]
            };

            await geminiClient.generateContent(userId, request);

            // Verify URL format
            expect(capturedUrl).toBeDefined();
            const expectedModel = model || 'gemini-1.5-pro';
            const expectedUrl = `https://generativelanguage.googleapis.com/v1beta/models/${expectedModel}:generateContent`;
            expect(capturedUrl).toBe(expectedUrl);
          } finally {
            global.fetch = originalFetch;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
