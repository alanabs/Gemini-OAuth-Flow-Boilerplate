/**
 * Unit tests for error handler
 * Tests rate limit error handling and retry-after information extraction
 */

import { describe, it, expect } from 'vitest';
import { ErrorHandler, RateLimitError } from '../../src/error-handler';
import { OAuthErrorType } from '../../src/types';

describe('ErrorHandler Unit Tests', () => {
  describe('Rate Limit Error Handling', () => {
    /**
     * Test retry-after information extraction
     * Requirements: 9.5
     */
    it('should extract retry-after seconds from numeric header', () => {
      const retryAfter = ErrorHandler.parseRetryAfter('60');
      expect(retryAfter).toBe(60);
    });

    it('should extract retry-after seconds from HTTP date header', () => {
      const futureDate = new Date(Date.now() + 120000); // 2 minutes from now
      const retryAfter = ErrorHandler.parseRetryAfter(futureDate.toUTCString());
      
      // Should be approximately 120 seconds (allow for small timing differences)
      expect(retryAfter).toBeGreaterThanOrEqual(119);
      expect(retryAfter).toBeLessThanOrEqual(121);
    });

    it('should return undefined for invalid retry-after header', () => {
      expect(ErrorHandler.parseRetryAfter('invalid')).toBeUndefined();
      expect(ErrorHandler.parseRetryAfter('')).toBeUndefined();
      expect(ErrorHandler.parseRetryAfter(null)).toBeUndefined();
    });

    it('should return undefined for negative retry-after values', () => {
      expect(ErrorHandler.parseRetryAfter('-10')).toBeUndefined();
    });

    it('should handle past dates by returning 0', () => {
      const pastDate = new Date(Date.now() - 60000); // 1 minute ago
      const retryAfter = ErrorHandler.parseRetryAfter(pastDate.toUTCString());
      expect(retryAfter).toBe(0);
    });

    it('should create rate limit error with retry-after information', () => {
      const error = ErrorHandler.createRateLimitError(60, { error: 'rate_limit' });
      
      expect(error).toBeInstanceOf(Error);
      expect(error.type).toBe(OAuthErrorType.NETWORK_ERROR);
      expect(error.retryable).toBe(true);
      expect(error.message).toContain('60 seconds');
      expect((error as RateLimitError).retryAfter).toBe(60);
      expect(error.originalError).toEqual({ error: 'rate_limit' });
    });

    it('should create rate limit error without retry-after information', () => {
      const error = ErrorHandler.createRateLimitError(undefined);
      
      expect(error).toBeInstanceOf(Error);
      expect(error.type).toBe(OAuthErrorType.NETWORK_ERROR);
      expect(error.retryable).toBe(true);
      expect(error.message).toContain('Rate limit exceeded');
      expect(error.message).toContain('try again later');
      expect((error as RateLimitError).retryAfter).toBeUndefined();
    });

    it('should preserve original error in rate limit error', () => {
      const originalError = {
        error: 'rate_limit_exceeded',
        error_description: 'Too many requests',
      };
      
      const error = ErrorHandler.createRateLimitError(30, originalError);
      
      expect(error.originalError).toBe(originalError);
      expect(error.originalError).toEqual(originalError);
    });

    it('should mark rate limit errors as retryable', () => {
      const error1 = ErrorHandler.createRateLimitError(60);
      const error2 = ErrorHandler.createRateLimitError(undefined);
      
      expect(error1.retryable).toBe(true);
      expect(error2.retryable).toBe(true);
    });

    it('should handle zero retry-after value', () => {
      const error = ErrorHandler.createRateLimitError(0);
      
      expect((error as RateLimitError).retryAfter).toBe(0);
      expect(error.message).toContain('0 seconds');
    });

    it('should handle large retry-after values', () => {
      const largeValue = 3600; // 1 hour
      const error = ErrorHandler.createRateLimitError(largeValue);
      
      expect((error as RateLimitError).retryAfter).toBe(largeValue);
      expect(error.message).toContain('3600 seconds');
    });
  });

  describe('Error Wrapping', () => {
    it('should return OAuthError as-is when wrapping', () => {
      const originalError = ErrorHandler.createNetworkError(
        new Error('network failure'),
        'Test operation'
      );
      
      const wrappedError = ErrorHandler.wrapError(originalError, 'Another context');
      
      // Should be the same instance
      expect(wrappedError).toBe(originalError);
    });

    it('should wrap non-OAuthError with proper context', () => {
      const originalError = new Error('Something went wrong');
      const wrappedError = ErrorHandler.wrapError(originalError, 'Database operation');
      
      expect(wrappedError.message).toContain('Database operation');
      expect(wrappedError.message).toContain('Something went wrong');
      expect(wrappedError.originalError).toBe(originalError);
    });
  });
});
