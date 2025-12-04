/**
 * Main OAuth client class - entry point for all OAuth operations
 * Wires together all components for a simple public API
 */

import { ConfigManager, ConfigOptions } from './config';
import { TokenManager } from './token-manager';
import { GeminiClient } from './gemini-client';
import { URLBuilder, AuthorizationUrlResult } from './url-builder';
import { TokenExchange } from './token-exchange';
import {
  OAuthClientConfig,
  TokenStore,
  UserInfo,
  GeminiRequest,
  GeminiResponse,
  OAuthError,
  OAuthErrorType,
} from './types';
import { ErrorHandler } from './error-handler';

/**
 * Main Google OAuth client for Gemini API access
 * Provides a simple interface for OAuth flow and authenticated API calls
 */
export class GoogleOAuthClient {
  private config: OAuthClientConfig;
  private tokenManager: TokenManager;
  private geminiClient: GeminiClient;
  private static readonly REVOCATION_ENDPOINT = 'https://oauth2.googleapis.com/revoke';

  /**
   * Create a new Google OAuth client
   * 
   * @param options - Configuration options (can also use environment variables)
   * @param tokenStore - Token store implementation for persisting tokens
   */
  constructor(options: ConfigOptions, tokenStore: TokenStore) {
    // Load and validate configuration
    this.config = ConfigManager.load(options, tokenStore);

    // Initialize components
    this.tokenManager = new TokenManager(
      this.config.clientId,
      this.config.clientSecret,
      this.config.tokenStore
    );

    this.geminiClient = new GeminiClient(this.tokenManager);
  }

  /**
   * Generate authorization URL for user to visit
   * User will be redirected to Google's consent screen
   * 
   * @param state - Optional state parameter for CSRF protection
   * @returns Authorization URL result with URL, state, and optional code verifier
   */
  async getAuthorizationUrl(state?: string): Promise<AuthorizationUrlResult> {
    return URLBuilder.generateAuthorizationUrl(this.config, state);
  }

  /**
   * Handle OAuth callback and exchange authorization code for tokens
   * Call this method when user is redirected back from Google
   * 
   * @param code - Authorization code from OAuth callback
   * @param codeVerifier - PKCE code verifier (required if PKCE was used)
   * @returns User information from ID token
   * @throws OAuthError if exchange fails
   */
  async handleCallback(code: string, codeVerifier?: string): Promise<UserInfo> {
    // Exchange authorization code for tokens
    const { tokens, userInfo } = await TokenExchange.exchangeCodeForTokens(
      code,
      this.config.clientId,
      this.config.clientSecret,
      this.config.redirectUri,
      codeVerifier
    );

    // Save tokens to store
    await this.config.tokenStore.saveTokens(userInfo.sub, tokens);

    return userInfo;
  }

  /**
   * Sign out a user and revoke their tokens
   * Calls Google's revocation endpoint and deletes stored tokens
   * 
   * @param userId - User identifier (Google sub)
   * @throws OAuthError if revocation fails
   */
  async signOut(userId: string): Promise<void> {
    // Get tokens from store
    const tokens = await this.config.tokenStore.getTokens(userId);

    if (tokens) {
      // Revoke the refresh token (this also invalidates the access token)
      await this.revokeToken(tokens.refreshToken);
    }

    // Delete tokens from store
    await this.config.tokenStore.deleteTokens(userId);
  }

  /**
   * Make an authenticated Gemini API call
   * Handles token refresh automatically if needed
   * 
   * @param userId - User identifier (Google sub)
   * @param request - Gemini API request
   * @returns Gemini API response
   * @throws OAuthError for authentication or API errors
   */
  async callGemini(userId: string, request: GeminiRequest): Promise<GeminiResponse> {
    return this.geminiClient.generateContent(userId, request);
  }

  /**
   * Get current user information from stored tokens
   * Note: This returns cached user info from token storage
   * For fresh user info, make a call to Google's userinfo endpoint
   * 
   * @param userId - User identifier (Google sub)
   * @returns User information if tokens exist, null otherwise
   */
  async getUserInfo(userId: string): Promise<UserInfo | null> {
    const tokens = await this.config.tokenStore.getTokens(userId);
    
    if (!tokens) {
      return null;
    }

    // For now, we only have the userId (sub)
    // In a real implementation, you might want to store full UserInfo
    // or fetch it from Google's userinfo endpoint
    // For this basic implementation, we return minimal info
    return {
      sub: userId,
      email: '',
      emailVerified: false,
      name: '',
      picture: '',
      givenName: '',
      familyName: '',
    };
  }

  /**
   * Revoke a token at Google's revocation endpoint
   * 
   * @param token - Token to revoke (access or refresh token)
   * @throws OAuthError if revocation fails
   * @private
   */
  private async revokeToken(token: string): Promise<void> {
    try {
      const response = await fetch(GoogleOAuthClient.REVOCATION_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          token,
        }).toString(),
      });

      // Google returns 200 for successful revocation
      // It also returns 200 if the token was already invalid
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new OAuthError(
          OAuthErrorType.NETWORK_ERROR,
          `Token revocation failed: ${response.status} ${response.statusText}`,
          errorData
        );
      }
    } catch (error) {
      // Wrap error with proper context preservation
      throw ErrorHandler.wrapError(error, 'Token revocation');
    }
  }
}
