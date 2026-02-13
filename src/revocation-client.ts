import { ErrorHandler } from './error-handler';
import { OAuthError, OAuthErrorType } from './types';

export class RevocationClient {
  private static readonly REVOCATION_ENDPOINT = 'https://oauth2.googleapis.com/revoke';

  async revokeToken(token: string): Promise<void> {
    try {
      const response = await fetch(RevocationClient.REVOCATION_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }).toString(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new OAuthError(
          OAuthErrorType.NETWORK_ERROR,
          `Token revocation failed: ${response.status} ${response.statusText}`,
          errorData,
          response.status >= 500
        );
      }
    } catch (error) {
      throw ErrorHandler.wrapError(error, 'Token revocation');
    }
  }
}
