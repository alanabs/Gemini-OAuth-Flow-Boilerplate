/**
 * PKCE (Proof Key for Code Exchange) generator utility
 * Implements RFC 7636 for OAuth 2.0 public clients
 */

import { randomBytes, createHash } from 'crypto';

/**
 * Utility class for generating PKCE parameters
 */
export class PKCEGenerator {
  /**
   * Generate a cryptographically secure code verifier
   * @returns A base64url-encoded random string (43-128 characters)
   */
  static generateCodeVerifier(): string {
    // Generate 32 random bytes (will be 43 characters when base64url encoded)
    const verifier = randomBytes(32);
    return this.base64UrlEncode(verifier);
  }

  /**
   * Generate a code challenge from a code verifier using SHA-256
   * @param verifier The code verifier to hash
   * @returns A base64url-encoded SHA-256 hash of the verifier
   */
  static generateCodeChallenge(verifier: string): string {
    // Hash the verifier using SHA-256
    const hash = createHash('sha256').update(verifier).digest();
    return this.base64UrlEncode(hash);
  }

  /**
   * Base64url encode a buffer (RFC 4648 Section 5)
   * @param buffer The buffer to encode
   * @returns Base64url-encoded string
   */
  private static base64UrlEncode(buffer: Buffer): string {
    return buffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}
