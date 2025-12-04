/**
 * PostgreSQL Token Store Implementation Example
 * 
 * This example demonstrates how to implement a production-ready token store
 * using PostgreSQL with proper encryption and connection pooling.
 * 
 * Installation:
 * npm install pg
 * npm install --save-dev @types/pg
 * 
 * Setup:
 * See TOKEN_STORE_SETUP.md for database schema and configuration instructions.
 */

import { Pool, PoolClient } from 'pg';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { TokenStore, TokenData } from '../src/types';

/**
 * PostgreSQL implementation of TokenStore with AES-256-GCM encryption
 * Suitable for production use with proper connection pooling and error handling
 */
export class DatabaseTokenStore implements TokenStore {
  private pool: Pool;
  private encryptionKey: Buffer;

  /**
   * Create a new DatabaseTokenStore
   * @param connectionConfig - PostgreSQL connection configuration
   * @param encryptionKey - 32-byte encryption key (base64 encoded string or Buffer)
   */
  constructor(
    connectionConfig: {
      host: string;
      port: number;
      database: string;
      user: string;
      password: string;
      max?: number; // Maximum pool size (default: 10)
      idleTimeoutMillis?: number; // Idle timeout (default: 30000)
      connectionTimeoutMillis?: number; // Connection timeout (default: 2000)
    },
    encryptionKey: string | Buffer
  ) {
    // Initialize connection pool
    this.pool = new Pool({
      host: connectionConfig.host,
      port: connectionConfig.port,
      database: connectionConfig.database,
      user: connectionConfig.user,
      password: connectionConfig.password,
      max: connectionConfig.max || 10,
      idleTimeoutMillis: connectionConfig.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: connectionConfig.connectionTimeoutMillis || 2000,
    });

    // Set up encryption key
    this.encryptionKey = typeof encryptionKey === 'string'
      ? Buffer.from(encryptionKey, 'base64')
      : encryptionKey;

    if (this.encryptionKey.length !== 32) {
      throw new Error('Encryption key must be exactly 32 bytes for AES-256-GCM');
    }

    // Handle pool errors
    this.pool.on('error', (err: Error) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  /**
   * Save tokens for a user with encryption
   */
  async saveTokens(userId: string, tokens: TokenData): Promise<void> {
    const encryptedAccess = this.encrypt(tokens.accessToken);
    const encryptedRefresh = this.encrypt(tokens.refreshToken);
    const expiresAt = new Date(tokens.expiresAt);

    const query = `
      INSERT INTO oauth_tokens (
        user_id, 
        access_token, 
        refresh_token, 
        expires_at, 
        scope, 
        token_type,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (user_id) 
      DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        expires_at = EXCLUDED.expires_at,
        scope = EXCLUDED.scope,
        token_type = EXCLUDED.token_type,
        updated_at = NOW()
    `;

    try {
      await this.pool.query(query, [
        userId,
        encryptedAccess,
        encryptedRefresh,
        expiresAt,
        tokens.scope,
        tokens.tokenType,
      ]);
    } catch (error) {
      throw new Error(`Failed to save tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve and decrypt tokens for a user
   */
  async getTokens(userId: string): Promise<TokenData | null> {
    const query = `
      SELECT 
        access_token, 
        refresh_token, 
        expires_at, 
        scope, 
        token_type
      FROM oauth_tokens
      WHERE user_id = $1
    `;

    try {
      const result = await this.pool.query(query, [userId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];

      return {
        accessToken: this.decrypt(row.access_token),
        refreshToken: this.decrypt(row.refresh_token),
        expiresAt: new Date(row.expires_at).getTime(),
        scope: row.scope,
        tokenType: row.token_type,
      };
    } catch (error) {
      // If decryption fails or query fails, return null
      console.error('Failed to retrieve tokens:', error);
      return null;
    }
  }

  /**
   * Delete tokens for a user
   */
  async deleteTokens(userId: string): Promise<void> {
    const query = 'DELETE FROM oauth_tokens WHERE user_id = $1';

    try {
      await this.pool.query(query, [userId]);
    } catch (error) {
      throw new Error(`Failed to delete tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update only the access token for a user
   */
  async updateAccessToken(userId: string, accessToken: string, expiresAt: number): Promise<void> {
    const encryptedAccess = this.encrypt(accessToken);
    const expiresAtDate = new Date(expiresAt);

    const query = `
      UPDATE oauth_tokens
      SET 
        access_token = $1,
        expires_at = $2,
        updated_at = NOW()
      WHERE user_id = $3
    `;

    try {
      const result = await this.pool.query(query, [encryptedAccess, expiresAtDate, userId]);

      if (result.rowCount === 0) {
        throw new Error(`No tokens found for user: ${userId}`);
      }
    } catch (error) {
      throw new Error(`Failed to update access token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Close the database connection pool
   * Call this when shutting down your application
   */
  async close(): Promise<void> {
    await this.pool.end();
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
 * import { DatabaseTokenStore } from './database-token-store';
 * 
 * const tokenStore = new DatabaseTokenStore(
 *   {
 *     host: process.env.DB_HOST || 'localhost',
 *     port: parseInt(process.env.DB_PORT || '5432'),
 *     database: process.env.DB_NAME || 'oauth_db',
 *     user: process.env.DB_USER || 'postgres',
 *     password: process.env.DB_PASSWORD || '',
 *     max: 20, // Maximum 20 connections in pool
 *   },
 *   process.env.ENCRYPTION_KEY!
 * );
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
