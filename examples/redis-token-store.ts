/**
 * Redis Token Store Implementation Example
 * 
 * This example demonstrates how to implement a production-ready token store
 * using Redis with proper encryption and connection handling.
 * 
 * Installation:
 * npm install redis
 * 
 * Setup:
 * See TOKEN_STORE_SETUP.md for Redis installation and configuration instructions.
 */

import { createClient, RedisClientType } from 'redis';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { TokenStore, TokenData } from '../src/types';

/**
 * Redis implementation of TokenStore with AES-256-GCM encryption
 * Suitable for production use with distributed systems and high-performance requirements
 */
export class RedisTokenStore implements TokenStore {
  private client: RedisClientType;
  private encryptionKey: Buffer;
  private keyPrefix: string;
  private connected: boolean = false;

  /**
   * Create a new RedisTokenStore
   * @param redisConfig - Redis connection configuration
   * @param encryptionKey - 32-byte encryption key (base64 encoded string or Buffer)
   * @param keyPrefix - Prefix for Redis keys (default: 'oauth:tokens:')
   */
  constructor(
    redisConfig: {
      url?: string; // Redis URL (e.g., 'redis://localhost:6379')
      host?: string;
      port?: number;
      password?: string;
      database?: number;
      username?: string;
    },
    encryptionKey: string | Buffer,
    keyPrefix: string = 'oauth:tokens:'
  ) {
    // Initialize Redis client
    if (redisConfig.url) {
      this.client = createClient({ url: redisConfig.url });
    } else {
      this.client = createClient({
        socket: {
          host: redisConfig.host || 'localhost',
          port: redisConfig.port || 6379,
        },
        password: redisConfig.password,
        database: redisConfig.database || 0,
        username: redisConfig.username,
      });
    }

    this.keyPrefix = keyPrefix;

    // Set up encryption key
    this.encryptionKey = typeof encryptionKey === 'string'
      ? Buffer.from(encryptionKey, 'base64')
      : encryptionKey;

    if (this.encryptionKey.length !== 32) {
      throw new Error('Encryption key must be exactly 32 bytes for AES-256-GCM');
    }

    // Handle Redis errors
    this.client.on('error', (err: Error) => {
      console.error('Redis Client Error:', err);
    });

    this.client.on('connect', () => {
      console.log('Redis client connected');
      this.connected = true;
    });

    this.client.on('disconnect', () => {
      console.log('Redis client disconnected');
      this.connected = false;
    });
  }

  /**
   * Connect to Redis
   * Must be called before using the store
   */
  async connect(): Promise<void> {
    if (!this.connected) {
      await this.client.connect();
    }
  }

  /**
   * Save tokens for a user with encryption
   * Tokens are stored with automatic expiration based on refresh token lifetime
   */
  async saveTokens(userId: string, tokens: TokenData): Promise<void> {
    await this.ensureConnected();

    const encryptedData = this.encrypt(JSON.stringify(tokens));
    const key = this.getKey(userId);

    // Calculate TTL: refresh tokens typically last 6 months
    // We set Redis expiration to 7 months to be safe
    const ttlSeconds = 60 * 60 * 24 * 210; // 7 months in seconds

    try {
      await this.client.setEx(key, ttlSeconds, encryptedData);
    } catch (error) {
      throw new Error(`Failed to save tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve and decrypt tokens for a user
   */
  async getTokens(userId: string): Promise<TokenData | null> {
    await this.ensureConnected();

    const key = this.getKey(userId);

    try {
      const encryptedData = await this.client.get(key);

      if (!encryptedData) {
        return null;
      }

      const decrypted = this.decrypt(encryptedData);
      return JSON.parse(decrypted) as TokenData;
    } catch (error) {
      // If decryption fails or data is corrupted, return null
      console.error('Failed to retrieve tokens:', error);
      return null;
    }
  }

  /**
   * Delete tokens for a user
   */
  async deleteTokens(userId: string): Promise<void> {
    await this.ensureConnected();

    const key = this.getKey(userId);

    try {
      await this.client.del(key);
    } catch (error) {
      throw new Error(`Failed to delete tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update only the access token for a user
   */
  async updateAccessToken(userId: string, accessToken: string, expiresAt: number): Promise<void> {
    await this.ensureConnected();

    // Get existing tokens
    const existingTokens = await this.getTokens(userId);
    if (!existingTokens) {
      throw new Error(`No tokens found for user: ${userId}`);
    }

    // Update with new access token
    const updatedTokens: TokenData = {
      ...existingTokens,
      accessToken,
      expiresAt,
    };

    await this.saveTokens(userId, updatedTokens);
  }

  async updateTokens(userId: string, tokens: TokenData): Promise<void> {
    await this.saveTokens(userId, tokens);
  }

  /**
   * Close the Redis connection
   * Call this when shutting down your application
   */
  async close(): Promise<void> {
    if (this.connected) {
      await this.client.quit();
      this.connected = false;
    }
  }

  /**
   * Get all user IDs that have tokens stored
   * Useful for administrative purposes
   */
  async getAllUserIds(): Promise<string[]> {
    await this.ensureConnected();

    try {
      const keys = await this.client.keys(`${this.keyPrefix}*`);
      return keys.map((key: string) => key.replace(this.keyPrefix, ''));
    } catch (error) {
      console.error('Failed to get user IDs:', error);
      return [];
    }
  }

  /**
   * Check if tokens exist for a user
   */
  async hasTokens(userId: string): Promise<boolean> {
    await this.ensureConnected();

    const key = this.getKey(userId);
    const exists = await this.client.exists(key);
    return exists === 1;
  }

  /**
   * Get the Redis key for a user
   */
  private getKey(userId: string): string {
    return `${this.keyPrefix}${userId}`;
  }

  /**
   * Ensure Redis is connected before operations
   */
  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
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

/**
 * Example usage:
 * 
 * import { RedisTokenStore } from './redis-token-store';
 * 
 * // Using Redis URL
 * const tokenStore = new RedisTokenStore(
 *   {
 *     url: process.env.REDIS_URL || 'redis://localhost:6379',
 *   },
 *   process.env.ENCRYPTION_KEY!
 * );
 * 
 * // Or using individual connection parameters
 * const tokenStore = new RedisTokenStore(
 *   {
 *     host: process.env.REDIS_HOST || 'localhost',
 *     port: parseInt(process.env.REDIS_PORT || '6379'),
 *     password: process.env.REDIS_PASSWORD,
 *     database: 0,
 *   },
 *   process.env.ENCRYPTION_KEY!,
 *   'myapp:oauth:' // Custom key prefix
 * );
 * 
 * // Connect before using
 * await tokenStore.connect();
 * 
 * // Use with OAuth client
 * const client = new GoogleOAuthClient({
 *   clientId: process.env.GOOGLE_CLIENT_ID!,
 *   clientSecret: process.env.GOOGLE_CLIENT_SECRET,
 *   redirectUri: process.env.GOOGLE_REDIRECT_URI!,
 *   scopes: ['https://www.googleapis.com/auth/generative-language'],
 *   tokenStore,
 * });
 * 
 * // Clean shutdown
 * process.on('SIGTERM', async () => {
 *   await tokenStore.close();
 *   process.exit(0);
 * });
 */
