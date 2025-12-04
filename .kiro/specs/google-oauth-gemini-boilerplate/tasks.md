# Implementation Plan

- [x] 1. Set up project structure and dependencies
  - Create TypeScript project with tsconfig.json
  - Install dependencies: fast-check for property testing, crypto for encryption
  - Set up test framework (Jest or Vitest)
  - Create directory structure: src/, tests/unit/, tests/property/, tests/integration/
  - _Requirements: 6.5_

- [x] 2. Implement core type definitions and interfaces
  - Define TokenStore interface with save, get, delete, and update methods
  - Define OAuthClientConfig interface
  - Define TokenData, UserInfo, GeminiRequest, GeminiResponse interfaces
  - Define OAuthErrorType enum and OAuthError class
  - _Requirements: 6.5_

- [x] 3. Implement PKCE generator utility
  - Create PKCEGenerator class with generateCodeVerifier method
  - Implement generateCodeChallenge method using SHA-256
  - Use cryptographically secure random generation
  - _Requirements: 1.4, 8.2_

- [x] 3.1 Write property test for PKCE generation
  - **Property 4: PKCE parameter generation**
  - **Validates: Requirements 1.4, 8.2**

- [x] 4. Implement configuration manager
  - Create ConfigManager class with load and validate methods
  - Support loading from constructor parameters and environment variables
  - Validate required fields (clientId, redirectUri, scopes)
  - Validate HTTPS requirement for redirect URIs
  - Provide descriptive error messages for missing/invalid configuration
  - _Requirements: 1.1, 1.2, 1.5, 6.1, 8.1_

- [x] 4.1 Write property test for configuration validation
  - **Property 1: Configuration validation rejects invalid inputs**
  - **Validates: Requirements 1.5**

- [x] 4.2 Write property test for HTTPS enforcement
  - **Property 2: HTTPS enforcement for OAuth endpoints**
  - **Validates: Requirements 1.2, 8.1**

- [x] 5. Implement URL builder for authorization flow
  - Create method to generate authorization URL with all required parameters
  - Include client_id, redirect_uri, scope, response_type, state
  - Add PKCE parameters (code_challenge, code_challenge_method) when enabled
  - Ensure Gemini scope is always included
  - Properly encode URL parameters
  - _Requirements: 1.3, 2.1_

- [x] 5.1 Write property test for Gemini scope inclusion
  - **Property 3: Gemini scope inclusion**
  - **Validates: Requirements 1.3**

- [x] 5.2 Write property test for authorization URL format
  - **Property 5: Authorization URL format**
  - **Validates: Requirements 2.1**

- [x] 6. Implement token exchange logic
  - Create method to exchange authorization code for tokens
  - Make POST request to Google's token endpoint
  - Handle PKCE code_verifier parameter
  - Parse response to extract access_token, refresh_token, expires_in
  - Extract user info from ID token
  - Handle error responses from Google
  - _Requirements: 2.3, 2.4_

- [x] 6.1 Write unit test for token exchange error handling
  - Test access_denied error scenario
  - Test invalid_grant error scenario
  - _Requirements: 2.4_

- [x] 7. Implement in-memory token store
  - Create InMemoryTokenStore class implementing TokenStore interface
  - Use Map to store tokens by user ID
  - Implement encryption/decryption using AES-256-GCM
  - Implement saveTokens, getTokens, deleteTokens, updateAccessToken methods
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 7.1 Write property test for token encryption round-trip
  - **Property 7: Token encryption round-trip**
  - **Validates: Requirements 3.1, 3.3**

- [x] 7.2 Write property test for token-user association
  - **Property 6: Token-user association**
  - **Validates: Requirements 2.5**

- [x] 7.3 Write property test for token deletion
  - **Property 8: Token deletion completeness**
  - **Validates: Requirements 3.4**

- [x] 7.4 Write property test for token expiration metadata
  - **Property 9: Token expiration metadata**
  - **Validates: Requirements 3.5**

- [x] 8. Implement token manager for refresh logic
  - Create TokenManager class with getValidAccessToken method
  - Implement isTokenExpired check with 5-minute buffer
  - Implement refreshAccessToken method
  - Make POST request to Google's token endpoint with refresh_token grant
  - Update token store with new access token
  - Handle refresh errors (invalid_grant, network errors)
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 8.1 Write property test for expired token refresh
  - **Property 10: Expired token triggers refresh**
  - **Validates: Requirements 4.1, 4.4**

- [x] 8.2 Write property test for token validation
  - **Property 16: Token validation before use**
  - **Validates: Requirements 8.5**

- [x] 8.3 Write unit tests for token refresh scenarios
  - Test successful refresh flow
  - Test invalid_grant error handling
  - Test rate limiting error handling
  - _Requirements: 4.2, 4.3, 4.5_

- [x] 9. Implement Gemini API client
  - Create GeminiClient class with generateContent method
  - Construct API URL with model parameter
  - Get valid access token from TokenManager
  - Add Authorization header with Bearer token
  - Make POST request to Gemini API endpoint
  - Handle 401 errors with token refresh and retry
  - Handle quota exceeded errors without retry
  - Parse and return response
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 9.1 Write property test for authorization header format
  - **Property 11: Authorization header format**
  - **Validates: Requirements 5.1**

- [x] 9.2 Write property test for API endpoint format
  - **Property 12: API endpoint format**
  - **Validates: Requirements 5.4**

- [x] 9.3 Write unit tests for API error handling
  - Test 401 retry logic
  - Test quota exceeded error handling
  - _Requirements: 5.2, 5.3_

- [x] 10. Implement main OAuth client class
  - Create GoogleOAuthClient class as main entry point
  - Implement constructor accepting OAuthClientConfig
  - Implement getAuthorizationUrl method
  - Implement handleCallback method
  - Implement signOut method with token revocation
  - Implement callGemini method
  - Implement getUserInfo method
  - Wire together all components (ConfigManager, TokenManager, GeminiClient)
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 8.4_

- [x] 10.1 Write unit test for token revocation
  - Test that signOut calls Google's revocation endpoint
  - _Requirements: 8.4_

- [x] 11. Implement comprehensive error handling
  - Map Google OAuth error codes to OAuthErrorType enum
  - Create OAuthError instances with descriptive messages
  - Classify network errors as retryable
  - Preserve original error context in originalError property
  - Include retry-after information for rate limit errors
  - _Requirements: 6.4, 9.1, 9.2, 9.4, 9.5_

- [x] 11.1 Write property test for error type mapping
  - **Property 13: Error type mapping**
  - **Validates: Requirements 6.4, 9.1**

- [x] 11.2 Write property test for network error classification
  - **Property 14: Network error classification**
  - **Validates: Requirements 9.2**

- [x] 11.3 Write property test for error context preservation
  - **Property 15: Error context preservation**
  - **Validates: Requirements 9.4**

- [x] 11.4 Write unit test for rate limit error handling
  - Test retry-after information extraction
  - _Requirements: 9.5_

- [x] 12. Create example web application
  - Create Express.js example with login, callback, and API routes
  - Demonstrate OAuth flow initialization
  - Show token storage setup
  - Include example Gemini API call
  - Add error handling examples
  - Add comments explaining security considerations
  - _Requirements: 7.1, 7.2, 7.5_

- [x] 13. Create example token store implementations
  - Create DatabaseTokenStore example with PostgreSQL
  - Create RedisTokenStore example
  - Include encryption implementation
  - Add setup instructions and schema
  - _Requirements: 7.4_

- [x] 14. Write comprehensive documentation
  - Create README with quick start guide
  - Document Google Cloud Console setup steps
  - Explain OAuth consent screen configuration
  - Document credential creation for different client types
  - Explain test user setup for development
  - Document app verification requirements for production
  - Include configuration examples for different deployment scenarios
  - Add API reference documentation
  - _Requirements: 7.3, 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 15. Create package configuration
  - Set up package.json with proper exports
  - Configure TypeScript declaration generation
  - Set up build scripts
  - Configure npm package metadata
  - Add license file
  - _Requirements: 6.5_

- [x] 16. Write integration tests
  - Test complete OAuth flow with mocked Google endpoints
  - Test token refresh flow
  - Test Gemini API call with authentication
  - Test error scenarios
  - Test token revocation flow

- [x] 17. Final checkpoint - Ensure all tests pass
  - Run all unit tests
  - Run all property-based tests
  - Run all integration tests
  - Fix any failing tests
  - Ensure all tests pass, ask the user if questions arise
