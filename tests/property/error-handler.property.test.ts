/**
 * Property-based tests for error handling
 * Tests error type mapping, network error classification, and context preservation
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ErrorHandler, GoogleErrorResponse } from '../../src/error-handler';
import { OAuthError, OAuthErrorType } from '../../src/types';

describe('ErrorHandler Property Tests', () => {
  /**
   * Feature: google-oauth-gemini-boilerplate, Property 13: Error type mapping
   * Validates: Requirements 6.4, 9.1
   * 
   * For any Google OAuth error response with a standard error code,
   * the OAuth Client should throw an OAuthError with the corresponding OAuthErrorType
   */
  it('Property 13: maps all Google OAuth error codes to correct OAuthErrorType', () => {
    // Define known Google OAuth error codes and their expected mappings
    const errorCodeMappings: Array<[string, OAuthErrorType]> = [
      ['invalid_request', OAuthErrorType.INVALID_REQUEST],
      ['invalid_client', OAuthErrorType.UNAUTHORIZED_CLIENT],
      ['unauthorized_client', OAuthErrorType.UNAUTHORIZED_CLIENT],
      ['access_denied', OAuthErrorType.ACCESS_DENIED],
      ['invalid_grant', OAuthErrorType.INVALID_GRANT],
      ['unsupported_grant_type', OAuthErrorType.INVALID_REQUEST],
      ['invalid_scope', OAuthErrorType.INVALID_REQUEST],
    ];

    // Generator for known error codes
    const knownErrorCodeArb = fc.constantFrom(
      ...errorCodeMappings.map(([code]) => code)
    );

    // Generator for unknown error codes (should default to INVALID_REQUEST)
    const unknownErrorCodeArb = fc.string({ minLength: 1, maxLength: 50 })
      .filter(code => !errorCodeMappings.some(([known]) => known === code));

    fc.assert(
      fc.property(
        fc.oneof(knownErrorCodeArb, unknownErrorCodeArb),
        fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
        (errorCode, errorDescription) => {
          // Create Google error response
          const errorResponse: GoogleErrorResponse = {
            error: errorCode,
            error_description: errorDescription,
          };

          // Map error code to type
          const mappedType = ErrorHandler.mapErrorCodeToType(errorCode);

          // Create error from Google response
          const oauthError = ErrorHandler.createFromGoogleError(errorResponse);

          // Find expected type
          const expectedMapping = errorCodeMappings.find(([code]) => code === errorCode);
          const expectedType = expectedMapping 
            ? expectedMapping[1] 
            : OAuthErrorType.INVALID_REQUEST; // Unknown codes default to INVALID_REQUEST

          // Verify mapping is correct
          expect(mappedType).toBe(expectedType);
          expect(oauthError.type).toBe(expectedType);

          // Verify error is an OAuthError instance
          expect(oauthError).toBeInstanceOf(OAuthError);

          // Verify original error is preserved
          expect(oauthError.originalError).toEqual(errorResponse);

          // Verify message contains error information
          expect(oauthError.message).toBeTruthy();
          expect(oauthError.message.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: google-oauth-gemini-boilerplate, Property 14: Network error classification
   * Validates: Requirements 9.2
   * 
   * For any network failure, the OAuth Client should throw an OAuthError
   * with type NETWORK_ERROR and include the original error as context
   */
  it('Property 14: classifies network errors as retryable with NETWORK_ERROR type', () => {
    // Generator for network error patterns
    const networkErrorPatterns = [
      'network request failed',
      'fetch failed',
      'timeout exceeded',
      'ECONNREFUSED',
      'ENOTFOUND',
      'ECONNRESET',
      'ETIMEDOUT',
      'socket hang up',
      'DNS lookup failed',
      'connection refused',
    ];

    const networkErrorArb = fc.record({
      message: fc.constantFrom(...networkErrorPatterns),
      code: fc.option(
        fc.constantFrom('ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET'),
        { nil: undefined }
      ),
    });

    // Generator for non-network errors
    const nonNetworkErrorArb = fc.record({
      message: fc.string({ minLength: 1, maxLength: 100 })
        .filter(msg => {
          const lowerMsg = msg.toLowerCase();
          return !networkErrorPatterns.some(pattern => 
            lowerMsg.includes(pattern.toLowerCase())
          );
        }),
      code: fc.option(
        fc.string({ minLength: 1, maxLength: 20 })
          .filter(code => !['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET']
            .includes(code.toUpperCase())),
        { nil: undefined }
      ),
    });

    fc.assert(
      fc.property(
        fc.oneof(networkErrorArb, nonNetworkErrorArb),
        fc.string({ minLength: 1, maxLength: 50 }),
        (errorObj, context) => {
          // Create error object
          const error = new Error(errorObj.message);
          if (errorObj.code) {
            (error as any).code = errorObj.code;
          }

          // Check if it's classified as network error
          const isNetwork = ErrorHandler.isNetworkError(error);

          // Create OAuthError from network error
          const oauthError = ErrorHandler.createNetworkError(error, context);

          // Verify classification
          const shouldBeNetwork = networkErrorPatterns.some(pattern =>
            errorObj.message.toLowerCase().includes(pattern.toLowerCase())
          ) || Boolean(errorObj.code && ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET']
            .includes(errorObj.code.toUpperCase()));

          expect(isNetwork).toBe(shouldBeNetwork);

          // Verify network errors are created with correct properties
          expect(oauthError).toBeInstanceOf(OAuthError);
          expect(oauthError.type).toBe(OAuthErrorType.NETWORK_ERROR);
          expect(oauthError.retryable).toBe(true);
          expect(oauthError.originalError).toBe(error);
          expect(oauthError.message).toContain(context);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: google-oauth-gemini-boilerplate, Property 15: Error context preservation
   * Validates: Requirements 9.4
   * 
   * For any error that occurs during token refresh, the thrown OAuthError
   * should include the underlying error reason in its originalError property
   */
  it('Property 15: preserves original error context in all error wrapping operations', () => {
    // Generator for various error types
    const errorArb = fc.oneof(
      // Standard Error objects
      fc.record({
        type: fc.constant('Error'),
        message: fc.string({ minLength: 1, maxLength: 100 }),
      }),
      // Google error responses
      fc.record({
        type: fc.constant('GoogleError'),
        error: fc.constantFrom(
          'invalid_request',
          'invalid_grant',
          'access_denied',
          'unauthorized_client'
        ),
        error_description: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
      }),
      // Network errors
      fc.record({
        type: fc.constant('NetworkError'),
        message: fc.constantFrom('fetch failed', 'network error', 'timeout'),
        code: fc.option(fc.constantFrom('ECONNREFUSED', 'ETIMEDOUT'), { nil: undefined }),
      })
    );

    fc.assert(
      fc.property(
        errorArb,
        fc.string({ minLength: 1, maxLength: 50 }),
        (errorData, context) => {
          let originalError: any;
          let wrappedError: OAuthError;

          // Create appropriate error based on type
          if (errorData.type === 'Error') {
            originalError = new Error(errorData.message);
            wrappedError = ErrorHandler.wrapError(originalError, context);
          } else if (errorData.type === 'GoogleError') {
            originalError = {
              error: errorData.error,
              error_description: errorData.error_description,
            };
            wrappedError = ErrorHandler.createFromGoogleError(originalError, context);
          } else {
            originalError = new Error(errorData.message);
            if (errorData.code) {
              (originalError as any).code = errorData.code;
            }
            wrappedError = ErrorHandler.createNetworkError(originalError, context);
          }

          // Verify original error is preserved
          expect(wrappedError.originalError).toBeDefined();
          expect(wrappedError.originalError).toBe(originalError);

          // Verify it's an OAuthError
          expect(wrappedError).toBeInstanceOf(OAuthError);
          expect(wrappedError).toBeInstanceOf(Error);

          // Verify error has a type
          expect(Object.values(OAuthErrorType)).toContain(wrappedError.type);

          // Verify message is present
          expect(wrappedError.message).toBeTruthy();
          expect(wrappedError.message.length).toBeGreaterThan(0);

          // Verify retryable flag is a boolean
          expect(typeof wrappedError.retryable).toBe('boolean');
        }
      ),
      { numRuns: 100 }
    );
  });
});
