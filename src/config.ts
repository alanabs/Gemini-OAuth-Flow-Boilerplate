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
   */
  static load(options: ConfigOptions = {}, tokenStore?: TokenStore): OAuthClientConfig {
    const resolvedTokenStore = options.tokenStore || tokenStore;
    const clientId = options.clientId || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = options.clientSecret || process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = options.redirectUri || process.env.GOOGLE_REDIRECT_URI;
    const scopesFromEnv = process.env.GEMINI_SCOPES?.split(',').map(s => s.trim()).filter(Boolean);
    const scopes = Array.from(new Set([...(options.scopes || scopesFromEnv || [])]));
    const usePKCE = options.usePKCE !== undefined ? options.usePKCE : true;

    const config: OAuthClientConfig = {
      clientId: clientId || '',
      clientSecret,
      redirectUri: redirectUri || '',
      scopes,
      tokenStore: resolvedTokenStore as TokenStore,
      usePKCE,
    };

    this.validate(config);
    return config;
  }

  static validate(config: OAuthClientConfig): void {
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

    this.validateHttps(config.redirectUri);
  }

  static validateHttps(url: string): void {
    try {
      const parsedUrl = new URL(url);
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
