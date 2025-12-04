/**
 * Property-based tests for token store
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { InMemoryTokenStore } from '../../src/token-store';
import { TokenData } from '../../src/types';

describe('InMemoryTokenStore - Property Tests', () => {
  /**
   * Feature: google-oauth-gemini-boilerplate, Property 7: Token encryption round-trip
   * Validates: Requirements 3.1, 3.3
   * 
   * For any token data, encrypting and then decrypting should produce equivalent token values
   */
  it('should preserve token data through encryption/decryption round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary token data
        fc.record({
          accessToken: fc.string({ minLength: 20, maxLength: 200 }),
          refreshToken: fc.string({ minLength: 20, maxLength: 200 }),
          expiresAt: fc.integer({ min: Date.now(), max: Date.now() + 86400000 * 365 }),
          scope: fc.string({ minLength: 1, maxLength: 200 }),
          tokenType: fc.constant('Bearer'),
        }),
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        async (tokenData: TokenData, userId: string) => {
          // Create a token store with a fixed encryption key
          const store = new InMemoryTokenStore();

          // Save the tokens
          await store.saveTokens(userId, tokenData);

          // Retrieve the tokens
          const retrieved = await store.getTokens(userId);

          // Verify all fields match
          expect(retrieved).not.toBeNull();
          expect(retrieved?.accessToken).toBe(tokenData.accessToken);
          expect(retrieved?.refreshToken).toBe(tokenData.refreshToken);
          expect(retrieved?.expiresAt).toBe(tokenData.expiresAt);
          expect(retrieved?.scope).toBe(tokenData.scope);
          expect(retrieved?.tokenType).toBe(tokenData.tokenType);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: google-oauth-gemini-boilerplate, Property 6: Token-user association
   * Validates: Requirements 2.5
   * 
   * For any user ID and token data, after saving tokens to the store and retrieving them,
   * the retrieved tokens should be associated with the same user ID
   */
  it('should correctly associate tokens with user IDs', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate multiple user-token pairs
        fc.array(
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 50 }),
            tokenData: fc.record({
              accessToken: fc.string({ minLength: 20, maxLength: 200 }),
              refreshToken: fc.string({ minLength: 20, maxLength: 200 }),
              expiresAt: fc.integer({ min: Date.now(), max: Date.now() + 86400000 * 365 }),
              scope: fc.string({ minLength: 1, maxLength: 200 }),
              tokenType: fc.constant('Bearer'),
            }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (userTokenPairs) => {
          const store = new InMemoryTokenStore();

          // Save all tokens
          for (const { userId, tokenData } of userTokenPairs) {
            await store.saveTokens(userId, tokenData);
          }

          // Verify each user gets their own tokens back
          for (const { userId, tokenData } of userTokenPairs) {
            const retrieved = await store.getTokens(userId);
            expect(retrieved).not.toBeNull();
            expect(retrieved?.accessToken).toBe(tokenData.accessToken);
            expect(retrieved?.refreshToken).toBe(tokenData.refreshToken);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: google-oauth-gemini-boilerplate, Property 8: Token deletion completeness
   * Validates: Requirements 3.4
   * 
   * For any user ID, after storing tokens and then deleting them,
   * attempting to retrieve tokens should return null
   */
  it('should completely delete tokens when requested', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        fc.record({
          accessToken: fc.string({ minLength: 20, maxLength: 200 }),
          refreshToken: fc.string({ minLength: 20, maxLength: 200 }),
          expiresAt: fc.integer({ min: Date.now(), max: Date.now() + 86400000 * 365 }),
          scope: fc.string({ minLength: 1, maxLength: 200 }),
          tokenType: fc.constant('Bearer'),
        }),
        async (userId: string, tokenData: TokenData) => {
          const store = new InMemoryTokenStore();

          // Save tokens
          await store.saveTokens(userId, tokenData);

          // Verify tokens exist
          const beforeDelete = await store.getTokens(userId);
          expect(beforeDelete).not.toBeNull();

          // Delete tokens
          await store.deleteTokens(userId);

          // Verify tokens are gone
          const afterDelete = await store.getTokens(userId);
          expect(afterDelete).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: google-oauth-gemini-boilerplate, Property 9: Token expiration metadata
   * Validates: Requirements 3.5
   * 
   * For any stored token data, the retrieved data should include an expiresAt field
   * with a valid Unix timestamp
   */
  it('should include expiration metadata in stored tokens', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // userId
        fc.record({
          accessToken: fc.string({ minLength: 20, maxLength: 200 }),
          refreshToken: fc.string({ minLength: 20, maxLength: 200 }),
          expiresAt: fc.integer({ min: Date.now(), max: Date.now() + 86400000 * 365 }),
          scope: fc.string({ minLength: 1, maxLength: 200 }),
          tokenType: fc.constant('Bearer'),
        }),
        async (userId: string, tokenData: TokenData) => {
          const store = new InMemoryTokenStore();

          // Save tokens
          await store.saveTokens(userId, tokenData);

          // Retrieve tokens
          const retrieved = await store.getTokens(userId);

          // Verify expiration metadata exists and is valid
          expect(retrieved).not.toBeNull();
          expect(retrieved?.expiresAt).toBeDefined();
          expect(typeof retrieved?.expiresAt).toBe('number');
          expect(retrieved?.expiresAt).toBeGreaterThan(0);
          expect(retrieved?.expiresAt).toBe(tokenData.expiresAt);
        }
      ),
      { numRuns: 100 }
    );
  });
});
