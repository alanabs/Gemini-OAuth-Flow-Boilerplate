import { ErrorHandler } from './error-handler';
import { OAuthError, OAuthErrorType, UserInfo } from './types';

interface GoogleUserInfoResponse {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
}

export class UserInfoClient {
  private static readonly USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

  async fetchUserInfo(accessToken: string): Promise<UserInfo> {
    try {
      const response = await fetch(UserInfoClient.USERINFO_ENDPOINT, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const raw = await response.json().catch(() => ({}));
      const data = raw as GoogleUserInfoResponse;
      if (!response.ok) {
        throw new OAuthError(
          OAuthErrorType.UNAUTHORIZED_CLIENT,
          `Failed to fetch user profile: ${response.status} ${response.statusText}`,
          data,
          response.status >= 500
        );
      }

      if (!data || !data.sub || !data.email) {
        throw new OAuthError(
          OAuthErrorType.UPSTREAM_MALFORMED_RESPONSE,
          'Failed to fetch user profile: malformed userinfo payload from Google.',
          data
        );
      }

      const payload = data as GoogleUserInfoResponse;
      return {
        sub: payload.sub || '',
        email: payload.email || '',
        emailVerified: payload.email_verified || false,
        name: payload.name || '',
        picture: payload.picture || '',
        givenName: payload.given_name || '',
        familyName: payload.family_name || '',
      };
    } catch (error) {
      throw ErrorHandler.wrapError(error, 'Fetch user info');
    }
  }
}
