/**
 * Centralized error handling utilities for OAuth operations
 * Maps Google OAuth error codes to OAuthErrorType and provides error classification
 */

import { OAuthError, OAuthErrorType } from './types';

/**
 * Google OAuth error response structure
 */
export interface GoogleErrorResponse {
  error: string;
  error_description?: string;
  error_uri?: string;
}

/**
 * Extended OAuth error with retry-after information
 */
export interface RateLimitError extends OAuthError {
  retryAfter?: number; // Seconds to wait before retrying
}

/**
 * Error handler for OAuth operations
 */
export class ErrorHandler {
  /**
   * Map Google OAuth error codes to OAuthErrorType enum
   * 
   * @param errorCode - Google OAuth error code
   * @returns Corresponding OAuthErrorType
   */
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
      default:
        // Unknown error codes default to INVALID_REQUEST
        return OAuthErrorType.INVALID_REQUEST;
    }
  }

  /**
   * Create an OAuthError from a Google error response
   * Preserves original error context and maps error codes
   * 
   * @param errorResponse - Google OAuth error response
   * @param defaultMessage - Default message if description is missing
   * @returns OAuthError with mapped type and preserved context
   */
  static createFromGoogleError(
    errorResponse: GoogleErrorResponse,
    defaultMessage: string = 'OAuth operation failed'
  ): OAuthError {
    const errorType = this.mapErrorCodeToType(errorResponse.error);
    const message = errorResponse.error_description || 
                   `${defaultMessage}: ${errorResponse.error}`;

    return new OAuthError(
      errorType,
      message,
      errorResponse,
      false // Google OAuth errors are generally not retryable
    );
  }

  /**
   * Classify network errors as retryable
   * Network failures, timeouts, and connection errors are retryable
   * 
   * @param error - Original error
   * @returns true if error is a network error that should be retried
   */
  static isNetworkError(error: any): boolean {
    if (!error) return false;

    // Check for common network error indicators
    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.code?.toLowerCase() || '';

    // Network error patterns
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

  /**
   * Create an OAuthError for network failures
   * Classifies network errors as retryable and preserves original error
   * 
   * @param error - Original network error
   * @param context - Additional context about the operation
   * @returns OAuthError with NETWORK_ERROR type
   */
  static createNetworkError(error: any, context: string = 'Network operation'): OAuthError {
    const message = error instanceof Error 
      ? `${context} failed: ${error.message}`
      : `${context} failed: Unknown error`;

    return new OAuthError(
      OAuthErrorType.NETWORK_ERROR,
      message,
      error,
      true // Network errors are retryable
    );
  }

  /**
   * Create an OAuthError for rate limit errors
   * Includes retry-after information if available
   * 
   * @param retryAfter - Seconds to wait before retrying (from Retry-After header)
   * @param originalError - Original error response
   * @returns OAuthError with rate limit information
   */
  static createRateLimitError(
    retryAfter: number | undefined,
    originalError?: any
  ): OAuthError {
    const message = retryAfter !== undefined
      ? `Rate limit exceeded. Retry after ${retryAfter} seconds.`
      : 'Rate limit exceeded. Please try again later.';

    const error = new OAuthError(
      OAuthErrorType.NETWORK_ERROR,
      message,
      originalError,
      true // Rate limit errors are retryable
    ) as RateLimitError;

    // Add retry-after information
    if (retryAfter !== undefined) {
      error.retryAfter = retryAfter;
    }

    return error;
  }

  /**
   * Parse Retry-After header value
   * Can be either a number of seconds or an HTTP date
   * 
   * @param retryAfterHeader - Value from Retry-After header
   * @returns Number of seconds to wait, or undefined if invalid
   */
  static parseRetryAfter(retryAfterHeader: string | null): number | undefined {
    if (!retryAfterHeader) return undefined;

    // Try parsing as number (seconds)
    const seconds = parseInt(retryAfterHeader, 10);
    if (!isNaN(seconds)) {
      // Only accept non-negative values
      if (seconds >= 0) {
        return seconds;
      }
      // If it's a valid number but negative, don't try date parsing
      return undefined;
    }

    // Try parsing as HTTP date
    const date = new Date(retryAfterHeader);
    if (!isNaN(date.getTime())) {
      const secondsUntil = Math.max(0, Math.floor((date.getTime() - Date.now()) / 1000));
      return secondsUntil;
    }

    return undefined;
  }

  /**
   * Wrap an error with proper context preservation
   * If error is already an OAuthError, returns it as-is
   * Otherwise, creates appropriate OAuthError based on error type
   * 
   * @param error - Original error
   * @param context - Context about the operation
   * @returns OAuthError with preserved context
   */
  static wrapError(error: any, context: string = 'Operation'): OAuthError {
    // If already an OAuthError, return as-is
    if (error instanceof OAuthError) {
      return error;
    }

    // Check if it's a network error
    if (this.isNetworkError(error)) {
      return this.createNetworkError(error, context);
    }

    // Default to generic error
    const message = error instanceof Error
      ? `${context} failed: ${error.message}`
      : `${context} failed: Unknown error`;

    return new OAuthError(
      OAuthErrorType.NETWORK_ERROR,
      message,
      error,
      false
    );
  }
}
