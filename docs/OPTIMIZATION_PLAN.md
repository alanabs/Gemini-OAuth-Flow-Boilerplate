<analysis>
Here is my detailed review of the current codebase against the available implementation intent (README/API docs), technical behavior in source, and test suite patterns:

1. Code Organization & Structure
- The project is cleanly split by responsibility (`config`, `url-builder`, `token-exchange`, `token-manager`, `gemini-client`, `token-store`), which aligns with a composable OAuth architecture and makes the library approachable for extension.
- `GoogleOAuthClient` currently serves as a façade but still embeds revocation logic and a placeholder `getUserInfo` implementation returning mostly empty fields. This creates a mismatch between API surface and actual data quality.
- The `TokenStore` interface only supports `updateAccessToken`, but refresh responses may rotate refresh tokens/scopes. Current `TokenManager.refreshAccessToken` computes a potentially updated refresh token but persists only access token and expiry, causing data consistency risk.
- URL and token exchange logic are static utility classes; this simplifies usage but makes dependency injection and endpoint overriding harder for testing and future providers.

2. Code Quality & Best Practices
- Error handling is centralized well via `ErrorHandler.wrapError` and mapping helpers, but some paths still use generic `any` JSON parsing and skip structural validation of API responses (`token-exchange`, `token-manager`, `gemini-client`).
- `TokenExchange.extractUserInfoFromIDToken` decodes JWT payload but does not validate claims like `aud`, `iss`, `exp`, or nonce/state linkage. For production OAuth, this is a critical integrity gap.
- `ConfigManager.validateHttps` is good for redirect URI safety, but config validation does not enforce `clientSecret` requirements for confidential flows, nor does it validate scope formatting/duplication.
- `InMemoryTokenStore.getTokens` swallows all decryption/parse errors and returns `null`. This is operationally convenient but hides corruption/tampering signals that should be observable via logging hooks or typed errors.
- Public error type taxonomy is narrow (`NETWORK_ERROR` is reused for rate limiting and other backend failures), reducing caller ability to implement precise retry/backoff behavior.

3. UI/UX (Developer Experience)
- This is a backend library (no visual UI), so UX quality primarily means API ergonomics and diagnostics.
- The constructor usage shown in README (`new GoogleOAuthClient({ ..., tokenStore: new InMemoryTokenStore() })`) does not match implementation signature (`constructor(options, tokenStore)`), which can cause onboarding friction.
- `getUserInfo` implies rich profile return but currently emits placeholder blanks; this can lead to silent misuse in consuming apps.
- Error messages are generally readable, but actionable remediation guidance is inconsistent (e.g., token not found vs. guidance on re-auth flow).

4. Missing/Implicit Input Notes
- The supplied placeholders for `IMPLEMENTATION_PLAN`, `TECHNICAL_SPECIFICATION`, `PROJECT_REQUEST`, and `PROJECT_RULES` were not populated in the request body. This review therefore used repository artifacts (README, API docs, source, and tests) as the effective baseline.
</analysis>

# Optimization Plan

## Code Structure & Organization
- [ ] Step 1: Align public API shape with usage docs
  - **Task**: Choose one canonical constructor contract and apply it consistently: either accept `tokenStore` inside `ConfigOptions` or keep it as second arg and update all docs/examples/tests accordingly.
  - **Files**:
    - `src/oauth-client.ts`: Refactor constructor signature or inline compatibility shim.
    - `src/config.ts`: If needed, move `tokenStore` ownership solely into options.
    - `README.md`, `QUICK_START.md`, `API_REFERENCE.md`, `examples/*.ts`: Update usage snippets.
    - `tests/unit/oauth-client.test.ts`: Assert constructor behavior and backward compatibility.
  - **Step Dependencies**: None.
  - **Success Criteria**: Documented initialization pattern and actual runtime signature are identical; existing tests pass.

- [ ] Step 2: Split revocation/user-profile concerns from façade
  - **Task**: Extract token revocation and user-profile retrieval into dedicated service classes (e.g., `RevocationClient`, `UserInfoClient`) and keep `GoogleOAuthClient` as orchestration-only.
  - **Files**:
    - `src/oauth-client.ts`: Delegate instead of direct fetch logic.
    - `src/revocation-client.ts` (new): Encapsulate revoke endpoint logic + error wrapping.
    - `src/userinfo-client.ts` (new): Optional Google userinfo fetch and typed mapping.
    - `src/index.ts`: Export new components where appropriate.
  - **Step Dependencies**: Step 1 recommended first.
  - **Success Criteria**: `GoogleOAuthClient` contains no direct HTTP endpoint constants except orchestration dependencies.

## Correctness & Security
- [ ] Step 3: Persist full refreshed token state safely
  - **Task**: Extend token store contract to support full token replacement (`updateTokens` or reuse `saveTokens`) so refresh token rotations and scope/token_type changes are persisted.
  - **Files**:
    - `src/types.ts`: Add/update persistence interface contract.
    - `src/token-manager.ts`: Persist full `TokenData` result after refresh.
    - `src/token-store.ts`: Implement the new contract in memory store.
    - `examples/*token-store*.ts`: Sync custom store examples.
    - `tests/unit/token-manager.test.ts`, `tests/property/token-store.property.test.ts`: Add rotation persistence assertions.
  - **Step Dependencies**: None.
  - **Success Criteria**: Refresh flow never drops rotated refresh token or changed scope metadata.

- [ ] Step 4: Add token response and Gemini response runtime validation
  - **Task**: Introduce narrow validation guards for external API payloads before using fields (`expires_in`, `access_token`, candidate arrays, etc.).
  - **Files**:
    - `src/token-exchange.ts`: Validate token endpoint response shape.
    - `src/token-manager.ts`: Validate refresh response shape.
    - `src/gemini-client.ts`: Validate Gemini response structure before return.
    - `src/error-handler.ts`: Add helper for malformed upstream payload classification.
    - `tests/unit/token-exchange.test.ts`, `tests/unit/gemini-client.test.ts`: Add malformed payload tests.
  - **Step Dependencies**: None.
  - **Success Criteria**: Malformed upstream JSON produces deterministic typed `OAuthError` with actionable message.

- [ ] Step 5: Harden ID token validation beyond base64 decode
  - **Task**: Validate critical JWT claims (`aud`, `iss`, `exp`, `iat`) and optionally nonce support; fail closed on invalid claims.
  - **Files**:
    - `src/token-exchange.ts`: Add claim validation logic.
    - `src/types.ts`: Add internal type for validated ID token claims if needed.
    - `tests/unit/token-exchange.test.ts`, `tests/property/error-handler.property.test.ts`: Add claim failure cases.
    - `API_REFERENCE.md`/`SECURITY.md`: Document validation guarantees and assumptions.
  - **Step Dependencies**: Step 4 recommended.
  - **Success Criteria**: Invalid issuer/audience/expired ID token is rejected before tokens are persisted.

## Developer Experience & Reliability
- [ ] Step 6: Improve error taxonomy and remediation guidance
  - **Task**: Introduce finer-grained error types (e.g., `RATE_LIMITED`, `UPSTREAM_MALFORMED_RESPONSE`, `TOKEN_NOT_FOUND`) and standardize remediation hints in messages.
  - **Files**:
    - `src/types.ts`: Expand `OAuthErrorType`.
    - `src/error-handler.ts`: Map and create new error variants.
    - `src/token-manager.ts`, `src/gemini-client.ts`, `src/token-exchange.ts`, `src/oauth-client.ts`: Adopt refined errors.
    - `tests/unit/error-handler.test.ts`: Update expectations.
  - **Step Dependencies**: Steps 4–5 optional but synergistic.
  - **Success Criteria**: Consumers can branch retry/re-auth logic without brittle message parsing.

- [ ] Step 7: Make `getUserInfo` behavior explicit and accurate
  - **Task**: Either (A) rename method to clarify it is token-store-derived minimal identity, or (B) implement actual userinfo endpoint retrieval with caching policy.
  - **Files**:
    - `src/oauth-client.ts`: Adjust API and docs in JSDoc.
    - `src/userinfo-client.ts` (if Step 2 executed): Add endpoint integration.
    - `README.md`, `API_REFERENCE.md`: Document exact guarantees.
    - `tests/unit/oauth-client.test.ts`: Assert chosen behavior.
  - **Step Dependencies**: Step 2 helpful.
  - **Success Criteria**: No method returns placeholder profile fields without explicit contract language.

- [ ] Step 8: Add focused integration checks for OAuth edge cases
  - **Task**: Expand integration tests for refresh token rotation, revoked refresh token handling, and Gemini 401->refresh retry path.
  - **Files**:
    - `tests/integration/oauth-flow.integration.test.ts`: Add scenario matrix.
    - `tests/unit/token-manager.test.ts`, `tests/unit/gemini-client.test.ts`: Add targeted retries/rotation tests.
    - `TROUBLESHOOTING.md`: Add guidance for new failure modes.
  - **Step Dependencies**: Steps 3, 6.
  - **Success Criteria**: Test suite catches regression in token lifecycle and retry behavior.

## Logical Next Step
- [ ] Execute Step 1 first, because API contract consistency removes ambiguity for all subsequent refactors and documentation updates.
