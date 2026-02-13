/**
 * Token manager for handling token refresh logic
 * Manages token expiration checking and automatic refresh
 */

import { TokenStore, TokenData, OAuthError, OAuthErrorType } from './types';
import { ErrorHandler, GoogleErrorResponse } from './error-handler';

interface TokenRefreshResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type?: string;
}

export class TokenManager {
  private static readonly TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
  private static readonly EXPIRATION_BUFFER_MS = 5 * 60 * 1000;

  constructor(
    private clientId: string,
    private clientSecret: string | undefined,
    private tokenStore: TokenStore
  ) {}

  async getValidAccessToken(userId: string): Promise<string> {
    const tokens = await this.tokenStore.getTokens(userId);

    if (!tokens) {
      throw new OAuthError(
        OAuthErrorType.TOKEN_NOT_FOUND,
        `No tokens found for user: ${userId}. Re-authenticate this user to continue.`
      );
    }

    if (this.isTokenExpired(tokens.expiresAt)) {
      const refreshedTokens = await this.refreshAccessToken(userId, tokens.refreshToken);
      return refreshedTokens.accessToken;
    }

    return tokens.accessToken;
  }

  isTokenExpired(expiresAt: number): boolean {
    const now = Date.now();
    return expiresAt - now <= TokenManager.EXPIRATION_BUFFER_MS;
  }

  async refreshAccessToken(userId: string, refreshToken: string): Promise<TokenData> {
    const params = new URLSearchParams({
      client_id: this.clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

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

        if (response.status === 429) {
          const retryAfterHeader = response.headers.get('Retry-After');
          const retryAfter = ErrorHandler.parseRetryAfter(retryAfterHeader);
          throw ErrorHandler.createRateLimitError(retryAfter, errorData);
        }

        if (errorData.error) {
          throw ErrorHandler.createFromGoogleError(
            errorData as GoogleErrorResponse,
            'Token refresh failed'
          );
        }

        throw new OAuthError(
          OAuthErrorType.NETWORK_ERROR,
          `Token refresh failed: ${response.status} ${response.statusText}`,
          errorData,
          response.status >= 500
        );
      }

      const data = await response.json() as TokenRefreshResponse;
      if (!data.access_token || typeof data.expires_in !== 'number' || !data.scope) {
        throw ErrorHandler.createMalformedResponseError('Token refresh', data);
      }

      const tokenData: TokenData = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        expiresAt: Date.now() + (data.expires_in * 1000),
        scope: data.scope,
        tokenType: data.token_type || 'Bearer',
      };

      await this.tokenStore.updateTokens(userId, tokenData);
      return tokenData;
    } catch (error) {
      throw ErrorHandler.wrapError(error, 'Token refresh');
    }
  }
}
