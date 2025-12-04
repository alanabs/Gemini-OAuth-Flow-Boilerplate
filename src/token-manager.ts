/**
 * Token manager for handling token refresh logic
 * Manages token expiration checking and automatic refresh
 */

import { TokenStore, TokenData, OAuthError, OAuthErrorType } from './types';
import { ErrorHandler, GoogleErrorResponse } from './error-handler';

/**
 * Manages token lifecycle including expiration checking and refresh
 */
export class TokenManager {
  private static readonly TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
  private static readonly EXPIRATION_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private clientId: string,
    private clientSecret: string | undefined,
    private tokenStore: TokenStore
  ) {}

  /**
   * Get a valid access token for a user, refreshing if necessary
   * @param userId - User identifier
   * @returns Valid access token
   * @throws OAuthError if tokens not found or refresh fails
   */
  async getValidAccessToken(userId: string): Promise<string> {
    const tokens = await this.tokenStore.getTokens(userId);
    
    if (!tokens) {
      throw new OAuthError(
        OAuthErrorType.TOKEN_EXPIRED,
        `No tokens found for user: ${userId}`
      );
    }

    // Check if token is expired or will expire soon
    if (this.isTokenExpired(tokens.expiresAt)) {
      // Token is expired, refresh it
      const refreshedTokens = await this.refreshAccessToken(userId, tokens.refreshToken);
      return refreshedTokens.accessToken;
    }

    return tokens.accessToken;
  }

  /**
   * Check if a token is expired or will expire soon
   * Uses a 5-minute buffer to prevent using tokens that are about to expire
   * @param expiresAt - Token expiration timestamp (Unix milliseconds)
   * @returns true if token is expired or will expire within buffer period
   */
  isTokenExpired(expiresAt: number): boolean {
    const now = Date.now();
    return expiresAt - now <= TokenManager.EXPIRATION_BUFFER_MS;
  }

  /**
   * Refresh an access token using a refresh token
   * @param userId - User identifier
   * @param refreshToken - Refresh token to use
   * @returns New token data
   * @throws OAuthError if refresh fails
   */
  async refreshAccessToken(userId: string, refreshToken: string): Promise<TokenData> {
    const params = new URLSearchParams({
      client_id: this.clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    // Add client secret if available (for confidential clients)
    if (this.clientSecret) {
      params.append('client_secret', this.clientSecret);
    }

    try {
      const response = await fetch(TokenManager.TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as any;
        
        // Handle rate limiting with retry-after information
        if (response.status === 429) {
          const retryAfterHeader = response.headers.get('Retry-After');
          const retryAfter = ErrorHandler.parseRetryAfter(retryAfterHeader);
          throw ErrorHandler.createRateLimitError(retryAfter, errorData);
        }

        // Handle other OAuth errors using centralized error handler
        if (errorData.error) {
          throw ErrorHandler.createFromGoogleError(
            errorData as GoogleErrorResponse,
            'Token refresh failed'
          );
        }

        // Generic error for non-OAuth errors
        throw new OAuthError(
          OAuthErrorType.NETWORK_ERROR,
          `Token refresh failed: ${response.status} ${response.statusText}`,
          errorData,
          response.status >= 500 // Server errors are retryable
        );
      }

      const data = await response.json() as any;

      // Calculate expiration timestamp
      const expiresAt = Date.now() + (data.expires_in * 1000);

      const tokenData: TokenData = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken, // Use new refresh token if provided, otherwise keep old one
        expiresAt,
        scope: data.scope,
        tokenType: data.token_type || 'Bearer',
      };

      // Update token store with new access token
      await this.tokenStore.updateAccessToken(userId, tokenData.accessToken, tokenData.expiresAt);

      return tokenData;
    } catch (error) {
      // Wrap error with proper context preservation
      throw ErrorHandler.wrapError(error, 'Token refresh');
    }
  }
}
