/**
 * URL builder for OAuth authorization flow
 * Constructs authorization URLs with all required parameters
 */

import { OAuthClientConfig } from './types';
import { PKCEGenerator } from './pkce';

/**
 * PKCE parameters for authorization request
 */
export interface PKCEParams {
  codeVerifier: string;
  codeChallenge: string;
}

/**
 * Result of authorization URL generation
 */
export interface AuthorizationUrlResult {
  url: string;
  state: string;
  codeVerifier?: string; // Only present when PKCE is enabled
}

/**
 * Builds authorization URLs for OAuth flow
 */
export class URLBuilder {
  private static readonly GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
  private static readonly GEMINI_SCOPE = 'https://www.googleapis.com/auth/generative-language';

  /**
   * Generate authorization URL with all required parameters
   * 
   * @param config - OAuth client configuration
   * @param state - Optional state parameter for CSRF protection
   * @returns Authorization URL result with URL, state, and optional code verifier
   */
  static async generateAuthorizationUrl(
    config: OAuthClientConfig,
    state?: string
  ): Promise<AuthorizationUrlResult> {
    // Generate state if not provided
    const stateParam = state || this.generateState();

    // Ensure Gemini scope is always included
    const scopes = this.ensureGeminiScope(config.scopes);

    // Build base parameters
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: scopes.join(' '),
      state: stateParam,
    });

    // Add PKCE parameters if enabled
    let codeVerifier: string | undefined;
    if (config.usePKCE) {
      const pkceParams = this.generatePKCEParams();
      params.append('code_challenge', pkceParams.codeChallenge);
      params.append('code_challenge_method', 'S256');
      codeVerifier = pkceParams.codeVerifier;
    }

    // Construct final URL
    const url = `${this.GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;

    return {
      url,
      state: stateParam,
      codeVerifier,
    };
  }

  /**
   * Ensure Gemini scope is included in the scopes array
   * 
   * @param scopes - Array of scopes
   * @returns Array of scopes with Gemini scope included
   */
  private static ensureGeminiScope(scopes: string[]): string[] {
    // Check if Gemini scope is already present
    if (scopes.includes(this.GEMINI_SCOPE)) {
      return scopes;
    }

    // Add Gemini scope
    return [...scopes, this.GEMINI_SCOPE];
  }

  /**
   * Generate PKCE parameters (code verifier and challenge)
   * 
   * @returns PKCE parameters
   */
  private static generatePKCEParams(): PKCEParams {
    const codeVerifier = PKCEGenerator.generateCodeVerifier();
    const codeChallenge = PKCEGenerator.generateCodeChallenge(codeVerifier);

    return {
      codeVerifier,
      codeChallenge,
    };
  }

  /**
   * Generate a random state parameter for CSRF protection
   * 
   * @returns Random state string
   */
  private static generateState(): string {
    // Use PKCE generator to create a random state (same security requirements)
    return PKCEGenerator.generateCodeVerifier();
  }
}
