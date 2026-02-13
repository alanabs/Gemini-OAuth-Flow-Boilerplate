/**
 * Token exchange handler for OAuth authorization code flow
 * Exchanges authorization code for access and refresh tokens
 */

import { TokenData, UserInfo, OAuthError, OAuthErrorType } from './types';
import { ErrorHandler, GoogleErrorResponse } from './error-handler';

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
}

interface IDTokenPayload {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture: string;
  given_name: string;
  family_name: string;
  aud?: string;
  iss?: string;
  exp?: number;
  iat?: number;
}

export class TokenExchange {
  private static readonly GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
  private static readonly VALID_ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

  static async exchangeCodeForTokens(
    code: string,
    clientId: string,
    clientSecret: string | undefined,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<{ tokens: TokenData; userInfo: UserInfo }> {
    try {
      const body = new URLSearchParams({
        code,
        client_id: clientId,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      });

      if (clientSecret) {
        body.append('client_secret', clientSecret);
      }

      if (codeVerifier) {
        body.append('code_verifier', codeVerifier);
      }

      const response = await fetch(this.GOOGLE_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw ErrorHandler.createFromGoogleError(data as GoogleErrorResponse, 'Token exchange failed');
      }

      const tokenResponse = data as TokenResponse;
      if (
        !tokenResponse.access_token ||
        typeof tokenResponse.expires_in !== 'number' ||
        !tokenResponse.scope ||
        !tokenResponse.token_type
      ) {
        throw ErrorHandler.createMalformedResponseError('Token exchange', tokenResponse);
      }

      const tokens: TokenData = {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token || '',
        expiresAt: Date.now() + tokenResponse.expires_in * 1000,
        scope: tokenResponse.scope,
        tokenType: tokenResponse.token_type,
      };

      const userInfo = this.extractUserInfoFromIDToken(tokenResponse.id_token, clientId);

      return { tokens, userInfo };
    } catch (error) {
      throw ErrorHandler.wrapError(error, 'Token exchange');
    }
  }

  private static extractUserInfoFromIDToken(idToken: string | undefined, clientId: string): UserInfo {
    if (!idToken) {
      throw new OAuthError(
        OAuthErrorType.INVALID_REQUEST,
        'ID token missing from token response'
      );
    }

    try {
      const parts = idToken.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      const payload = parts[1];
      const decodedPayload = this.base64UrlDecode(payload);
      const payloadData: IDTokenPayload = JSON.parse(decodedPayload);
      this.validateIDTokenClaims(payloadData, clientId);

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

  private static validateIDTokenClaims(payload: IDTokenPayload, clientId: string): void {
    if (!payload.sub || !payload.email) {
      throw new Error('ID token is missing required user claims');
    }

    if (payload.aud && payload.aud !== clientId) {
      throw new Error('ID token audience does not match client ID');
    }

    if (payload.iss && !this.VALID_ISSUERS.has(payload.iss)) {
      throw new Error('ID token issuer is invalid');
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp <= nowSeconds) {
      throw new Error('ID token has expired');
    }

    if (payload.iat && payload.iat > nowSeconds + 60) {
      throw new Error('ID token issued-at claim is in the future');
    }
  }

  private static base64UrlDecode(str: string): string {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');

    while (base64.length % 4 !== 0) {
      base64 += '=';
    }

    return Buffer.from(base64, 'base64').toString('utf-8');
  }
}
