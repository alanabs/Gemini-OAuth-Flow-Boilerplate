/**
 * Core type definitions and interfaces for Google OAuth Gemini boilerplate
 */

/**
 * Token data stored for each user
 */
export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp
  scope: string;
  tokenType: string;
}

/**
 * Interface for token persistence
 * Developers implement this interface with their preferred storage backend
 */
export interface TokenStore {
  /**
   * Save tokens for a user
   */
  saveTokens(userId: string, tokens: TokenData): Promise<void>;

  /**
   * Retrieve tokens for a user
   * @returns TokenData if found, null otherwise
   */
  getTokens(userId: string): Promise<TokenData | null>;

  /**
   * Delete tokens for a user
   */
  deleteTokens(userId: string): Promise<void>;

  /**
   * Update only access token (after refresh)
   */
  updateAccessToken(userId: string, accessToken: string, expiresAt: number): Promise<void>;

  /**
   * Persist complete token payload after refresh/token rotation
   */
  updateTokens(userId: string, tokens: TokenData): Promise<void>;
}

/**
 * Configuration for OAuth client
 */
export interface OAuthClientConfig {
  clientId: string;
  clientSecret?: string; // Optional for public clients
  redirectUri: string;
  scopes: string[];
  tokenStore: TokenStore;
  usePKCE?: boolean; // Default true for public clients
}

/**
 * User information from Google OAuth
 */
export interface UserInfo {
  sub: string; // Google user ID (unique identifier)
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string;
  givenName: string;
  familyName: string;
}

/**
 * Request structure for Gemini API
 */
export interface GeminiRequest {
  model?: string; // Default: 'gemini-1.5-pro'
  contents: Array<{
    parts: Array<{
      text: string;
    }>;
  }>;
  generationConfig?: {
    temperature?: number;
    topK?: number;
    topP?: number;
    maxOutputTokens?: number;
  };
}

/**
 * Response structure from Gemini API
 */
export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
    finishReason: string;
  }>;
}

/**
 * OAuth error types
 */
export enum OAuthErrorType {
  INVALID_REQUEST = 'invalid_request',
  UNAUTHORIZED_CLIENT = 'unauthorized_client',
  ACCESS_DENIED = 'access_denied',
  INVALID_GRANT = 'invalid_grant',
  NETWORK_ERROR = 'network_error',
  TOKEN_EXPIRED = 'token_expired',
  TOKEN_NOT_FOUND = 'token_not_found',
  QUOTA_EXCEEDED = 'quota_exceeded',
  RATE_LIMITED = 'rate_limited',
  UPSTREAM_MALFORMED_RESPONSE = 'upstream_malformed_response',
}

/**
 * Custom error class for OAuth operations
 */
export class OAuthError extends Error {
  public type: OAuthErrorType;
  public originalError?: unknown;
  public retryable: boolean;

  constructor(
    type: OAuthErrorType,
    message: string,
    originalError?: unknown,
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'OAuthError';
    this.type = type;
    this.originalError = originalError;
    this.retryable = retryable;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, OAuthError);
    }
  }
}
