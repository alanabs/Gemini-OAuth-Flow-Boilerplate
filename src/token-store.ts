/**
 * In-memory token store implementation with AES-256-GCM encryption
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { TokenStore, TokenData } from './types';

/**
 * In-memory implementation of TokenStore with encryption
 * Suitable for development and single-instance applications
 * For production, consider using a database-backed implementation
 */
export class InMemoryTokenStore implements TokenStore {
  private tokens: Map<string, string> = new Map();
  private encryptionKey: Buffer;

  /**
   * Create a new InMemoryTokenStore
   * @param encryptionKey - 32-byte encryption key (base64 encoded string or Buffer)
   */
  constructor(encryptionKey?: string | Buffer) {
    if (encryptionKey) {
      this.encryptionKey = typeof encryptionKey === 'string' 
        ? Buffer.from(encryptionKey, 'base64')
        : encryptionKey;
    } else {
      // Generate a random key if none provided (for testing/development)
      this.encryptionKey = randomBytes(32);
    }

    if (this.encryptionKey.length !== 32) {
      throw new Error('Encryption key must be exactly 32 bytes for AES-256-GCM');
    }
  }

  /**
   * Save tokens for a user with encryption
   */
  async saveTokens(userId: string, tokens: TokenData): Promise<void> {
    const serialized = JSON.stringify(tokens);
    const encrypted = this.encrypt(serialized);
    this.tokens.set(userId, encrypted);
  }

  /**
   * Retrieve and decrypt tokens for a user
   */
  async getTokens(userId: string): Promise<TokenData | null> {
    const encrypted = this.tokens.get(userId);
    if (!encrypted) {
      return null;
    }

    try {
      const decrypted = this.decrypt(encrypted);
      return JSON.parse(decrypted) as TokenData;
    } catch (error) {
      // If decryption fails, return null
      return null;
    }
  }

  /**
   * Delete tokens for a user
   */
  async deleteTokens(userId: string): Promise<void> {
    this.tokens.delete(userId);
  }

  /**
   * Update only the access token for a user
   */
  async updateAccessToken(userId: string, accessToken: string, expiresAt: number): Promise<void> {
    const existingTokens = await this.getTokens(userId);
    if (!existingTokens) {
      throw new Error(`No tokens found for user: ${userId}`);
    }

    const updatedTokens: TokenData = {
      ...existingTokens,
      accessToken,
      expiresAt,
    };

    await this.saveTokens(userId, updatedTokens);
  }

  /**
   * Encrypt data using AES-256-GCM
   * Format: [16-byte IV][16-byte auth tag][encrypted data]
   */
  private encrypt(text: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    // Combine IV + auth tag + encrypted data
    const combined = Buffer.concat([iv, authTag, encrypted]);
    return combined.toString('base64');
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  private decrypt(encrypted: string): string {
    const buffer = Buffer.from(encrypted, 'base64');
    
    // Extract IV, auth tag, and encrypted data
    const iv = buffer.subarray(0, 16);
    const authTag = buffer.subarray(16, 32);
    const data = buffer.subarray(32);
    
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([
      decipher.update(data),
      decipher.final()
    ]);
    
    return decrypted.toString('utf8');
  }
}
