/**
 * Configuration manager for OAuth client
 * Handles loading and validation of configuration from various sources
 */

import { OAuthClientConfig, OAuthError, OAuthErrorType, TokenStore } from './types';

/**
 * Configuration options that can be provided to ConfigManager
 */
export interface ConfigOptions {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  scopes?: string[];
  tokenStore?: TokenStore;
  usePKCE?: boolean;
}

/**
 * Manages configuration loading and validation for OAuth client
 */
export class ConfigManager {
  /**
   * Load configuration from provided options and environment variables
   * Environment variables are used as fallback for missing options
   * 
   * @param options - Configuration options
   * @param tokenStore - Token store instance (required)
   * @returns Validated OAuthClientConfig
   * @throws OAuthError if configuration is invalid
   */
  static load(options: ConfigOptions = {}, tokenStore: TokenStore): OAuthClientConfig {
    // Load from options or environment variables
    const clientId = options.clientId || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = options.clientSecret || process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = options.redirectUri || process.env.GOOGLE_REDIRECT_URI;
    const scopesFromEnv = process.env.GEMINI_SCOPES?.split(',').map(s => s.trim());
    const scopes = options.scopes || scopesFromEnv || [];
    const usePKCE = options.usePKCE !== undefined ? options.usePKCE : true;

    const config: OAuthClientConfig = {
      clientId: clientId || '',
      clientSecret,
      redirectUri: redirectUri || '',
      scopes,
      tokenStore,
      usePKCE,
    };

    // Validate the configuration
    this.validate(config);

    return config;
  }

  /**
   * Validate OAuth client configuration
   * 
   * @param config - Configuration to validate
   * @throws OAuthError if configuration is invalid
   */
  static validate(config: OAuthClientConfig): void {
    // Validate required fields
    if (!config.clientId || config.clientId.trim() === '') {
      throw new OAuthError(
        OAuthErrorType.INVALID_REQUEST,
        'Configuration error: clientId is required. Provide it via constructor options or GOOGLE_CLIENT_ID environment variable.'
      );
    }

    if (!config.redirectUri || config.redirectUri.trim() === '') {
      throw new OAuthError(
        OAuthErrorType.INVALID_REQUEST,
        'Configuration error: redirectUri is required. Provide it via constructor options or GOOGLE_REDIRECT_URI environment variable.'
      );
    }

    if (!config.scopes || config.scopes.length === 0) {
      throw new OAuthError(
        OAuthErrorType.INVALID_REQUEST,
        'Configuration error: scopes array is required and must contain at least one scope. Provide it via constructor options or GEMINI_SCOPES environment variable.'
      );
    }

    if (!config.tokenStore) {
      throw new OAuthError(
        OAuthErrorType.INVALID_REQUEST,
        'Configuration error: tokenStore is required. Provide a TokenStore implementation.'
      );
    }

    // Validate HTTPS requirement for redirect URIs
    this.validateHttps(config.redirectUri);
  }

  /**
   * Validate that a URL uses HTTPS protocol
   * Allows http://localhost for development purposes
   * 
   * @param url - URL to validate
   * @throws OAuthError if URL doesn't use HTTPS (except localhost)
   */
  static validateHttps(url: string): void {
    try {
      const parsedUrl = new URL(url);
      
      // Allow http for localhost/127.0.0.1 (development)
      const isLocalhost = parsedUrl.hostname === 'localhost' || 
                         parsedUrl.hostname === '127.0.0.1' ||
                         parsedUrl.hostname === '[::1]';
      
      if (parsedUrl.protocol !== 'https:' && !isLocalhost) {
        throw new OAuthError(
          OAuthErrorType.INVALID_REQUEST,
          `Configuration error: redirectUri must use HTTPS protocol for security. Got: ${parsedUrl.protocol}//`
        );
      }
    } catch (error) {
      if (error instanceof OAuthError) {
        throw error;
      }
      throw new OAuthError(
        OAuthErrorType.INVALID_REQUEST,
        `Configuration error: redirectUri is not a valid URL: ${url}`
      );
    }
  }
}
