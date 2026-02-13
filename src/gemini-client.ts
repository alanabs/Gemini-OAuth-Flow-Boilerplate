/**
 * Gemini API client for making authenticated requests
 * Handles automatic token refresh and error handling
 */

import { TokenManager } from './token-manager';
import { GeminiRequest, GeminiResponse, OAuthError, OAuthErrorType } from './types';
import { ErrorHandler } from './error-handler';

export class GeminiClient {
  private static readonly GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
  private static readonly DEFAULT_MODEL = 'gemini-1.5-pro';

  constructor(private tokenManager: TokenManager) {}

  async generateContent(userId: string, request: GeminiRequest): Promise<GeminiResponse> {
    const model = request.model || GeminiClient.DEFAULT_MODEL;
    const url = `${GeminiClient.GEMINI_API_BASE}/models/${model}:generateContent`;

    let accessToken = await this.tokenManager.getValidAccessToken(userId);

    try {
      return await this.makeRequest(url, accessToken, request);
    } catch (error) {
      if (error instanceof OAuthError && error.type === OAuthErrorType.UNAUTHORIZED_CLIENT) {
        accessToken = await this.tokenManager.getValidAccessToken(userId);
        return await this.makeRequest(url, accessToken, request);
      }
      throw error;
    }
  }

  private validateGeminiResponse(data: unknown): GeminiResponse {
    const payload = data as GeminiResponse;
    if (!payload || !Array.isArray(payload.candidates)) {
      throw ErrorHandler.createMalformedResponseError('Gemini API request', data);
    }

    return payload;
  }

  private async makeRequest(url: string, accessToken: string, request: GeminiRequest): Promise<GeminiResponse> {
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

        if (response.status === 401) {
          throw new OAuthError(
            OAuthErrorType.UNAUTHORIZED_CLIENT,
            'Access token is invalid or expired. Re-authenticate if this persists.',
            errorData
          );
        }

        if (response.status === 429) {
          throw new OAuthError(
            OAuthErrorType.QUOTA_EXCEEDED,
            'Gemini API quota exceeded for this user. Retry later or increase quota.',
            errorData,
            false
          );
        }

        throw new OAuthError(
          OAuthErrorType.NETWORK_ERROR,
          `Gemini API request failed: ${errorData.error?.message || 'Unknown error'}`,
          errorData,
          response.status >= 500
        );
      }

      const data = await response.json();
      return this.validateGeminiResponse(data);
    } catch (error) {
      throw ErrorHandler.wrapError(error, 'Gemini API request');
    }
  }
}
