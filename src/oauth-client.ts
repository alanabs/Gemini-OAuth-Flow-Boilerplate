/**
 * Main OAuth client class - entry point for all OAuth operations
 * Wires together all components for a simple public API
 */

import { ConfigManager, ConfigOptions } from './config';
import { TokenManager } from './token-manager';
import { GeminiClient } from './gemini-client';
import { URLBuilder, AuthorizationUrlResult } from './url-builder';
import { TokenExchange } from './token-exchange';
import {
  OAuthClientConfig,
  TokenStore,
  UserInfo,
  GeminiRequest,
  GeminiResponse,
} from './types';
import { RevocationClient } from './revocation-client';
import { UserInfoClient } from './userinfo-client';

export class GoogleOAuthClient {
  private config: OAuthClientConfig;
  private tokenManager: TokenManager;
  private geminiClient: GeminiClient;
  private revocationClient: RevocationClient;
  private userInfoClient: UserInfoClient;

  /**
   * Backward-compatible signature:
   * - new GoogleOAuthClient(optionsWithTokenStore)
   * - new GoogleOAuthClient(optionsWithoutTokenStore, tokenStore)
   */
  constructor(options: ConfigOptions, tokenStore?: TokenStore) {
    this.config = ConfigManager.load(options, tokenStore);

    this.tokenManager = new TokenManager(
      this.config.clientId,
      this.config.clientSecret,
      this.config.tokenStore
    );

    this.geminiClient = new GeminiClient(this.tokenManager);
    this.revocationClient = new RevocationClient();
    this.userInfoClient = new UserInfoClient();
  }

  async getAuthorizationUrl(state?: string): Promise<AuthorizationUrlResult> {
    return URLBuilder.generateAuthorizationUrl(this.config, state);
  }

  async handleCallback(code: string, codeVerifier?: string): Promise<UserInfo> {
    const { tokens, userInfo } = await TokenExchange.exchangeCodeForTokens(
      code,
      this.config.clientId,
      this.config.clientSecret,
      this.config.redirectUri,
      codeVerifier
    );

    await this.config.tokenStore.saveTokens(userInfo.sub, tokens);
    return userInfo;
  }

  async signOut(userId: string): Promise<void> {
    const tokens = await this.config.tokenStore.getTokens(userId);

    if (tokens) {
      await this.revocationClient.revokeToken(tokens.refreshToken);
    }

    await this.config.tokenStore.deleteTokens(userId);
  }

  async callGemini(userId: string, request: GeminiRequest): Promise<GeminiResponse> {
    return this.geminiClient.generateContent(userId, request);
  }

  /**
   * Returns current user profile by calling Google's userinfo endpoint.
   * If no tokens exist, returns null.
   */
  async getUserInfo(userId: string): Promise<UserInfo | null> {
    const tokens = await this.config.tokenStore.getTokens(userId);

    if (!tokens) {
      return null;
    }

    const accessToken = await this.tokenManager.getValidAccessToken(userId);
    return this.userInfoClient.fetchUserInfo(accessToken);
  }
}
