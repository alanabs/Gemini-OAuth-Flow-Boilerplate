/**
 * Token exchange logic for OAuth authorization code flow
 * Handles exchanging authorization codes for access and refresh tokens
 */

import { OAuthError, OAuthErrorType, TokenData, UserInfo } from './types';
import { ErrorHandler, GoogleErrorResponse } from './error-handler';

/**
 * Response from Google's token endpoint
 */
interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
}

/**
 * Error response from Google's token endpoint
 */
interface TokenErrorResponse {
  error: string;
  error_description?: string;
}

/**
 * Decoded ID token payload
 */
interface IDTokenPayload {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture: string;
  given_name: string;
  family_name: string;
}

/**
 * Handles token exchange operations
 */
export class TokenExchange {
  private static readonly GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

  /**
   * Exchange authorization code for access and refresh tokens
   * 
   * @param code - Authorization code from OAuth callback
   * @param clientId - OAuth client ID
   * @param clientSecret - OAuth client secret (optional for public clients)
   * @param redirectUri - Redirect URI used in authorization request
   * @param codeVerifier - PKCE code verifier (required if PKCE was used)
   * @returns Token data and user information
   * @throws OAuthError if exchange fails
   */
  static async exchangeCodeForTokens(
    code: string,
    clientId: string,
    clientSecret: string | undefined,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<{ tokens: TokenData; userInfo: UserInfo }> {
    try {
      // Build request body
      const body = new URLSearchParams({
        code,
        client_id: clientId,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      });

      // Add client secret if provided
      if (clientSecret) {
        body.append('client_secret', clientSecret);
      }

      // Add PKCE code verifier if provided
      if (codeVerifier) {
        body.append('code_verifier', codeVerifier);
      }

      // Make POST request to token endpoint
      const response = await fetch(this.GOOGLE_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      const data = await response.json();

      // Handle error responses
      if (!response.ok) {
        throw ErrorHandler.createFromGoogleError(
          data as GoogleErrorResponse,
          'Token exchange failed'
        );
      }

      const tokenResponse = data as TokenResponse;

      // Parse token response
      const tokens: TokenData = {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token || '',
        expiresAt: Date.now() + tokenResponse.expires_in * 1000,
        scope: tokenResponse.scope,
        tokenType: tokenResponse.token_type,
      };

      // Extract user info from ID token
      const userInfo = this.extractUserInfoFromIDToken(tokenResponse.id_token);

      return { tokens, userInfo };
    } catch (error) {
      // Wrap error with proper context preservation
      throw ErrorHandler.wrapError(error, 'Token exchange');
    }
  }



  /**
   * Extract user information from ID token
   * ID token is a JWT with three parts: header.payload.signature
   * We only need to decode the payload (base64url encoded JSON)
   * 
   * @param idToken - ID token from token response
   * @returns User information
   * @throws OAuthError if ID token is missing or invalid
   */
  private static extractUserInfoFromIDToken(idToken: string | undefined): UserInfo {
    if (!idToken) {
      throw new OAuthError(
        OAuthErrorType.INVALID_REQUEST,
        'ID token missing from token response'
      );
    }

    try {
      // Split JWT into parts
      const parts = idToken.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      // Decode payload (second part)
      const payload = parts[1];
      const decodedPayload = this.base64UrlDecode(payload);
      const payloadData: IDTokenPayload = JSON.parse(decodedPayload);

      // Extract user info
      return {
        sub: payloadData.sub,
        email: payloadData.email,
        emailVerified: payloadData.email_verified,
        name: payloadData.name,
        picture: payloadData.picture,
        givenName: payloadData.given_name,
        familyName: payloadData.family_name,
      };
    } catch (error) {
      throw new OAuthError(
        OAuthErrorType.INVALID_REQUEST,
        `Failed to parse ID token: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  }

  /**
   * Base64url decode a string
   * 
   * @param str - Base64url encoded string
   * @returns Decoded string
   */
  private static base64UrlDecode(str: string): string {
    // Convert base64url to base64
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    
    // Add padding if needed
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }

    // Decode base64
    return Buffer.from(base64, 'base64').toString('utf-8');
  }
}
