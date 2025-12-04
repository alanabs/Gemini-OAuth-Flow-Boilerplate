/**
 * Property-based tests for PKCE generator
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { PKCEGenerator } from '../../src/pkce';
import { createHash } from 'crypto';

describe('PKCE Generator Property Tests', () => {
  /**
   * Feature: google-oauth-gemini-boilerplate, Property 4: PKCE parameter generation
   * Validates: Requirements 1.4, 8.2
   * 
   * For any OAuth Client configured with PKCE enabled, the generated authorization URL 
   * should contain both code_challenge and code_challenge_method=S256 parameters, 
   * and the code challenge should be a valid base64url-encoded SHA256 hash.
   */
  it('Property 4: PKCE parameter generation - code verifier format and challenge validity', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        // Generate code verifier
        const verifier = PKCEGenerator.generateCodeVerifier();
        
        // Property 1: Code verifier should be 43-128 characters long (RFC 7636)
        expect(verifier.length).toBeGreaterThanOrEqual(43);
        expect(verifier.length).toBeLessThanOrEqual(128);
        
        // Property 2: Code verifier should only contain base64url characters
        // Base64url uses: A-Z, a-z, 0-9, -, _ (no padding =)
        const base64UrlPattern = /^[A-Za-z0-9\-_]+$/;
        expect(verifier).toMatch(base64UrlPattern);
        
        // Property 3: Code verifier should not contain padding characters
        expect(verifier).not.toContain('=');
        expect(verifier).not.toContain('+');
        expect(verifier).not.toContain('/');
        
        // Generate code challenge from verifier
        const challenge = PKCEGenerator.generateCodeChallenge(verifier);
        
        // Property 4: Code challenge should be base64url encoded
        expect(challenge).toMatch(base64UrlPattern);
        expect(challenge).not.toContain('=');
        expect(challenge).not.toContain('+');
        expect(challenge).not.toContain('/');
        
        // Property 5: Code challenge should be SHA-256 hash of verifier
        // Verify by computing the hash ourselves
        const expectedHash = createHash('sha256')
          .update(verifier)
          .digest('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
        
        expect(challenge).toBe(expectedHash);
        
        // Property 6: Code challenge should be deterministic for same verifier
        const challenge2 = PKCEGenerator.generateCodeChallenge(verifier);
        expect(challenge).toBe(challenge2);
      }),
      { numRuns: 100 } // Run 100 iterations as specified in design
    );
  });

  it('Property 4: PKCE parameter generation - cryptographic randomness', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        // Generate multiple verifiers
        const verifier1 = PKCEGenerator.generateCodeVerifier();
        const verifier2 = PKCEGenerator.generateCodeVerifier();
        
        // Property 7: Each generated verifier should be unique (cryptographically random)
        expect(verifier1).not.toBe(verifier2);
        
        // Property 8: Challenges should also be unique for different verifiers
        const challenge1 = PKCEGenerator.generateCodeChallenge(verifier1);
        const challenge2 = PKCEGenerator.generateCodeChallenge(verifier2);
        expect(challenge1).not.toBe(challenge2);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 4: PKCE parameter generation - challenge method is SHA-256', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 43, maxLength: 128 }), (customVerifier) => {
        // Filter to only valid base64url characters
        const validVerifier = customVerifier.replace(/[^A-Za-z0-9\-_]/g, 'A');
        
        if (validVerifier.length < 43) {
          // Skip if filtered string is too short
          return true;
        }
        
        // Generate challenge from any valid verifier string
        const challenge = PKCEGenerator.generateCodeChallenge(validVerifier);
        
        // Property 9: Challenge should always be SHA-256 hash (44 chars when base64url encoded)
        // SHA-256 produces 32 bytes, which is 43-44 characters in base64url
        expect(challenge.length).toBeGreaterThanOrEqual(43);
        expect(challenge.length).toBeLessThanOrEqual(44);
        
        // Property 10: Verify it matches SHA-256 computation
        const expectedHash = createHash('sha256')
          .update(validVerifier)
          .digest('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
        
        expect(challenge).toBe(expectedHash);
      }),
      { numRuns: 100 }
    );
  });
});
