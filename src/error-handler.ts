/**
 * Centralized error handling utilities for OAuth operations
 * Maps Google OAuth error codes to OAuthErrorType and provides error classification
 */

import { OAuthError, OAuthErrorType } from './types';

export interface GoogleErrorResponse {
  error: string;
  error_description?: string;
  error_uri?: string;
}

export interface RateLimitError extends OAuthError {
  retryAfter?: number;
}

export class ErrorHandler {
  static mapErrorCodeToType(errorCode: string): OAuthErrorType {
    switch (errorCode) {
      case 'invalid_request':
        return OAuthErrorType.INVALID_REQUEST;
      case 'invalid_client':
      case 'unauthorized_client':
        return OAuthErrorType.UNAUTHORIZED_CLIENT;
      case 'access_denied':
        return OAuthErrorType.ACCESS_DENIED;
      case 'invalid_grant':
        return OAuthErrorType.INVALID_GRANT;
      case 'unsupported_grant_type':
      case 'invalid_scope':
        return OAuthErrorType.INVALID_REQUEST;
      case 'rate_limit_exceeded':
        return OAuthErrorType.RATE_LIMITED;
      default:
        return OAuthErrorType.INVALID_REQUEST;
    }
  }

  static createFromGoogleError(
    errorResponse: GoogleErrorResponse,
    defaultMessage: string = 'OAuth operation failed'
  ): OAuthError {
    const errorType = this.mapErrorCodeToType(errorResponse.error);
    const message = errorResponse.error_description || `${defaultMessage}: ${errorResponse.error}`;

    return new OAuthError(
      errorType,
      message,
      errorResponse,
      errorType === OAuthErrorType.RATE_LIMITED
    );
  }

  static isNetworkError(error: any): boolean {
    if (!error) return false;

    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.code?.toLowerCase() || '';
    const networkPatterns = [
      'network',
      'fetch',
      'timeout',
      'econnrefused',
      'enotfound',
      'econnreset',
      'etimedout',
      'socket',
      'dns',
      'connection',
    ];

    return networkPatterns.some(pattern =>
      errorMessage.includes(pattern) || errorCode.includes(pattern)
    );
  }

  static createNetworkError(error: any, context: string = 'Network operation'): OAuthError {
    const message = error instanceof Error
      ? `${context} failed: ${error.message}`
      : `${context} failed: Unknown error`;

    return new OAuthError(OAuthErrorType.NETWORK_ERROR, message, error, true);
  }

  static createRateLimitError(retryAfter: number | undefined, originalError?: any): OAuthError {
    const message = retryAfter !== undefined
      ? `Rate limit exceeded. Retry after ${retryAfter} seconds.`
      : 'Rate limit exceeded. Please try again later.';

    const error = new OAuthError(
      OAuthErrorType.RATE_LIMITED,
      message,
      originalError,
      true
    ) as RateLimitError;

    if (retryAfter !== undefined) {
      error.retryAfter = retryAfter;
    }

    return error;
  }

  static createMalformedResponseError(context: string, payload?: unknown): OAuthError {
    return new OAuthError(
      OAuthErrorType.UPSTREAM_MALFORMED_RESPONSE,
      `${context} failed: upstream service returned malformed response.`,
      payload,
      false
    );
  }

  static parseRetryAfter(retryAfterHeader: string | null): number | undefined {
    if (!retryAfterHeader) return undefined;

    const seconds = parseInt(retryAfterHeader, 10);
    if (!isNaN(seconds)) {
      return seconds >= 0 ? seconds : undefined;
    }

    const date = new Date(retryAfterHeader);
    if (!isNaN(date.getTime())) {
      return Math.max(0, Math.floor((date.getTime() - Date.now()) / 1000));
    }

    return undefined;
  }

  static wrapError(error: any, context: string = 'Operation'): OAuthError {
    if (error instanceof OAuthError) {
      return error;
    }

    if (this.isNetworkError(error)) {
      return this.createNetworkError(error, context);
    }

    const message = error instanceof Error
      ? `${context} failed: ${error.message}`
      : `${context} failed: Unknown error`;

    return new OAuthError(OAuthErrorType.NETWORK_ERROR, message, error, false);
  }
}
