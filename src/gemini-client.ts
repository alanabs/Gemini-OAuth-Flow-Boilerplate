/**
 * Gemini API client for making authenticated requests
 * Handles automatic token refresh and error handling
 */

import { TokenManager } from './token-manager';
import { GeminiRequest, GeminiResponse, OAuthError, OAuthErrorType } from './types';
import { ErrorHandler } from './error-handler';

/**
 * Client for making authenticated requests to the Gemini API
 */
export class GeminiClient {
  private static readonly GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
  private static readonly DEFAULT_MODEL = 'gemini-1.5-pro';

  constructor(private tokenManager: TokenManager) {}

  /**
   * Generate content using the Gemini API
   * @param userId - User identifier for token retrieval
   * @param request - Gemini API request
   * @returns Gemini API response
   * @throws OAuthError for authentication or API errors
   */
  async generateContent(
    userId: string,
    request: GeminiRequest
  ): Promise<GeminiResponse> {
    const model = request.model || GeminiClient.DEFAULT_MODEL;
    const url = `${GeminiClient.GEMINI_API_BASE}/models/${model}:generateContent`;

    // Get valid access token (will refresh if needed)
    let accessToken = await this.tokenManager.getValidAccessToken(userId);

    try {
      return await this.makeRequest(url, accessToken, request);
    } catch (error) {
      // Handle 401 errors with token refresh and retry
      if (error instanceof OAuthError && error.type === OAuthErrorType.UNAUTHORIZED_CLIENT) {
        // Try to refresh token and retry once
        accessToken = await this.tokenManager.getValidAccessToken(userId);
        return await this.makeRequest(url, accessToken, request);
      }
      throw error;
    }
  }

  /**
   * Make the actual HTTP request to Gemini API
   * @private
   */
  private async makeRequest(
    url: string,
    accessToken: string,
    request: GeminiRequest
  ): Promise<GeminiResponse> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: request.contents,
          generationConfig: request.generationConfig,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as any;

        // Handle 401 Unauthorized - token may be invalid
        if (response.status === 401) {
          throw new OAuthError(
            OAuthErrorType.UNAUTHORIZED_CLIENT,
            'Access token is invalid or expired',
            errorData
          );
        }

        // Handle 429 Quota Exceeded - do not retry
        if (response.status === 429) {
          throw new OAuthError(
            OAuthErrorType.QUOTA_EXCEEDED,
            'Gemini API quota exceeded for this user',
            errorData,
            false // Not retryable
          );
        }

        // Handle other errors
        throw new OAuthError(
          OAuthErrorType.NETWORK_ERROR,
          `Gemini API request failed: ${errorData.error?.message || 'Unknown error'}`,
          errorData,
          response.status >= 500 // Server errors are retryable
        );
      }

      const data = await response.json() as GeminiResponse;
      return data;
    } catch (error) {
      // Wrap error with proper context preservation
      throw ErrorHandler.wrapError(error, 'Gemini API request');
    }
  }
}
