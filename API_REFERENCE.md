# API Reference

Complete API documentation for the Google OAuth Gemini Boilerplate library.

## Table of Contents

- [GoogleOAuthClient](#googleoauthclient)
- [TokenStore Interface](#tokenstore-interface)
- [TokenManager](#tokenmanager)
- [GeminiClient](#geminiclient)
- [PKCEGenerator](#pkcegenerator)
- [ConfigManager](#configmanager)
- [Types and Interfaces](#types-and-interfaces)
- [Error Handling](#error-handling)

---

## GoogleOAuthClient

The main class for OAuth operations and Gemini API interactions.

### Constructor

```typescript
new GoogleOAuthClient(config: OAuthClientConfig)
```

Creates a new OAuth client instance.

**Parameters:**

- `config` (OAuthClientConfig): Configuration object

**Example:**

```typescript
import { GoogleOAuthClient, InMemoryTokenStore } from 'google-oauth-gemini-boilerplate';

const client = new GoogleOAuthClient({
  clientId: 'your-client-id.apps.googleusercontent.com',
  clientSecret: 'your-client-secret',
  redirectUri: 'https://yourapp.com/auth/callback',
  scopes: ['https://www.googleapis.com/auth/generative-language'],
  tokenStore: new InMemoryTokenStore(),
  usePKCE: true,
});
```

### Methods

#### getAuthorizationUrl()

```typescript
getAuthorizationUrl(state?: string): Promise<string>
```

Generates the Google authorization URL for user authentication.

**Parameters:**

- `state` (string, optional): CSRF protection token. If not provided, a random state is generated.

**Returns:** Promise<string> - Authorization URL

**Throws:** OAuthError if configuration is invalid

**Example:**

```typescript
// Generate URL with automatic state
const authUrl = await client.getAuthorizationUrl();
res.redirect(authUrl);

// Generate URL with custom state
const customState = generateSecureToken();
req.session.oauthState = customState;
const authUrl = await client.getAuthorizationUrl(customState);
res.redirect(authUrl);
```

**Generated URL Format:**

```
https://accounts.google.com/o/oauth2/v2/auth?
  response_type=code&
  client_id=YOUR_CLIENT_ID&
  redirect_uri=YOUR_REDIRECT_URI&
  scope=https://www.googleapis.com/auth/generative-language&
  state=RANDOM_STATE&
  code_challenge=PKCE_CHALLENGE&
  code_challenge_method=S256
```

---

#### handleCallback()

```typescript
handleCallback(code: string, codeVerifier?: string): Promise<UserInfo>
```

Exchanges the authorization code for access and refresh tokens.

**Parameters:**

- `code` (string): Authorization code from Google's callback
- `codeVerifier` (string, optional): PKCE code verifier (required if PKCE is enabled)

**Returns:** Promise<UserInfo> - User information object

**Throws:**
- OAuthError with type 'ACCESS_DENIED' if user denied authorization
- OAuthError with type 'INVALID_GRANT' if code is invalid or expired
- OAuthError with type 'NETWORK_ERROR' if request fails

**Example:**

```typescript
app.get('/auth/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    // Verify state (CSRF protection)
    if (state !== req.session.oauthState) {
      throw new Error('Invalid state parameter');
    }
    
    // Exchange code for tokens
    const codeVerifier = req.session.codeVerifier; // If using PKCE
    const userInfo = await client.handleCallback(code as string, codeVerifier);
    
    // Store user ID in session
    req.session.userId = userInfo.sub;
    
    res.redirect('/dashboard');
  } catch (error) {
    if (error.type === 'ACCESS_DENIED') {
      res.redirect('/login?error=access_denied');
    } else {
      res.status(500).send('Authentication failed');
    }
  }
});
```

**UserInfo Response:**

```typescript
{
  sub: "1234567890",
  email: "user@example.com",
  emailVerified: true,
  name: "John Doe",
  picture: "https://lh3.googleusercontent.com/...",
  givenName: "John",
  familyName: "Doe"
}
```

---

#### callGemini()

```typescript
callGemini(userId: string, request: GeminiRequest): Promise<GeminiResponse>
```

Makes an authenticated request to the Gemini API.

**Parameters:**

- `userId` (string): User's unique identifier (from userInfo.sub)
- `request` (GeminiRequest): Gemini API request configuration

**Returns:** Promise<GeminiResponse> - Generated content response

**Throws:**
- OAuthError with type 'TOKEN_EXPIRED' if token refresh fails
- OAuthError with type 'QUOTA_EXCEEDED' if user quota is exceeded
- OAuthError with type 'NETWORK_ERROR' if request fails

**Example:**

```typescript
app.post('/api/generate', async (req, res) => {
  try {
    const userId = req.session.userId;
    const { prompt } = req.body;
    
    const response = await client.callGemini(userId, {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      }
    });
    
    const generatedText = response.candidates[0].content.parts[0].text;
    res.json({ text: generatedText });
    
  } catch (error) {
    if (error.type === 'QUOTA_EXCEEDED') {
      res.status(429).json({ error: 'Quota exceeded' });
    } else if (error.type === 'TOKEN_EXPIRED') {
      res.status(401).json({ error: 'Please sign in again' });
    } else {
      res.status(500).json({ error: 'Generation failed' });
    }
  }
});
```

**Request Options:**

```typescript
interface GeminiRequest {
  model?: string;              // Default: 'gemini-1.5-pro'
  contents: Array<{
    parts: Array<{
      text: string;
    }>;
  }>;
  generationConfig?: {
    temperature?: number;      // 0.0 to 1.0 (default: 0.9)
    topK?: number;            // Top-k sampling (default: 40)
    topP?: number;            // Nucleus sampling (default: 0.95)
    maxOutputTokens?: number; // Max response length (default: 2048)
  };
}
```

---

#### signOut()

```typescript
signOut(userId: string): Promise<void>
```

Signs out a user by revoking their tokens and deleting them from storage.

**Parameters:**

- `userId` (string): User's unique identifier

**Returns:** Promise<void>

**Throws:** OAuthError if revocation fails (tokens are still deleted locally)

**Example:**

```typescript
app.post('/auth/logout', async (req, res) => {
  try {
    const userId = req.session.userId;
    
    // Revoke tokens and delete from storage
    await client.signOut(userId);
    
    // Clear session
    req.session.destroy();
    
    res.redirect('/');
  } catch (error) {
    // Token revocation failed, but local tokens are deleted
    console.error('Sign out error:', error);
    req.session.destroy();
    res.redirect('/');
  }
});
```

**Note:** Even if token revocation fails (network error, etc.), the tokens are still deleted from local storage. The user will need to re-authenticate on next use.

---

#### getUserInfo()

```typescript
getUserInfo(userId: string): Promise<UserInfo | null>
```

Retrieves stored user information.

**Parameters:**

- `userId` (string): User's unique identifier

**Returns:** Promise<UserInfo | null> - User info or null if not found

**Example:**

```typescript
app.get('/api/user', async (req, res) => {
  const userId = req.session.userId;
  
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const userInfo = await client.getUserInfo(userId);
  
  if (!userInfo) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json(userInfo);
});
```

---

## TokenStore Interface

Interface for implementing custom token storage backends.

### Interface Definition

```typescript
interface TokenStore {
  saveTokens(userId: string, tokens: TokenData): Promise<void>;
  getTokens(userId: string): Promise<TokenData | null>;
  deleteTokens(userId: string): Promise<void>;
  updateAccessToken(userId: string, accessToken: string, expiresAt: number): Promise<void>;
}
```

### Methods

#### saveTokens()

```typescript
saveTokens(userId: string, tokens: TokenData): Promise<void>
```

Saves or updates tokens for a user.

**Parameters:**

- `userId` (string): User's unique identifier
- `tokens` (TokenData): Token data to store

**Implementation Example:**

```typescript
async saveTokens(userId: string, tokens: TokenData): Promise<void> {
  // Encrypt tokens
  const encryptedAccess = this.encrypt(tokens.accessToken);
  const encryptedRefresh = this.encrypt(tokens.refreshToken);
  
  // Store in database
  await this.db.query(
    `INSERT INTO oauth_tokens (user_id, access_token, refresh_token, expires_at, scope)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE SET
       access_token = $2, refresh_token = $3, expires_at = $4, updated_at = NOW()`,
    [userId, encryptedAccess, encryptedRefresh, new Date(tokens.expiresAt), tokens.scope]
  );
}
```

---

#### getTokens()

```typescript
getTokens(userId: string): Promise<TokenData | null>
```

Retrieves tokens for a user.

**Parameters:**

- `userId` (string): User's unique identifier

**Returns:** Promise<TokenData | null> - Token data or null if not found

**Implementation Example:**

```typescript
async getTokens(userId: string): Promise<TokenData | null> {
  const result = await this.db.query(
    'SELECT * FROM oauth_tokens WHERE user_id = $1',
    [userId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    accessToken: this.decrypt(row.access_token),
    refreshToken: this.decrypt(row.refresh_token),
    expiresAt: row.expires_at.getTime(),
    scope: row.scope,
    tokenType: 'Bearer',
  };
}
```

---

#### deleteTokens()

```typescript
deleteTokens(userId: string): Promise<void>
```

Deletes tokens for a user.

**Parameters:**

- `userId` (string): User's unique identifier

**Implementation Example:**

```typescript
async deleteTokens(userId: string): Promise<void> {
  await this.db.query(
    'DELETE FROM oauth_tokens WHERE user_id = $1',
    [userId]
  );
}
```

---

#### updateAccessToken()

```typescript
updateAccessToken(userId: string, accessToken: string, expiresAt: number): Promise<void>
```

Updates only the access token (used after token refresh).

**Parameters:**

- `userId` (string): User's unique identifier
- `accessToken` (string): New access token
- `expiresAt` (number): Unix timestamp when token expires

**Implementation Example:**

```typescript
async updateAccessToken(userId: string, accessToken: string, expiresAt: number): Promise<void> {
  const encrypted = this.encrypt(accessToken);
  await this.db.query(
    'UPDATE oauth_tokens SET access_token = $1, expires_at = $2, updated_at = NOW() WHERE user_id = $3',
    [encrypted, new Date(expiresAt), userId]
  );
}
```

---

## TokenManager

Internal class for token lifecycle management (not typically used directly).

### Constructor

```typescript
new TokenManager(
  clientId: string,
  clientSecret: string | undefined,
  tokenStore: TokenStore
)
```

### Methods

#### getValidAccessToken()

```typescript
getValidAccessToken(userId: string): Promise<string>
```

Gets a valid access token, refreshing if necessary.

**Parameters:**

- `userId` (string): User's unique identifier

**Returns:** Promise<string> - Valid access token

**Throws:** OAuthError if token refresh fails

---

#### refreshAccessToken()

```typescript
refreshAccessToken(userId: string, refreshToken: string): Promise<TokenData>
```

Refreshes an expired access token.

**Parameters:**

- `userId` (string): User's unique identifier
- `refreshToken` (string): Valid refresh token

**Returns:** Promise<TokenData> - Updated token data

**Throws:** OAuthError if refresh fails

---

#### isTokenExpired()

```typescript
isTokenExpired(expiresAt: number): boolean
```

Checks if a token is expired or will expire soon (5-minute buffer).

**Parameters:**

- `expiresAt` (number): Unix timestamp when token expires

**Returns:** boolean - True if expired or expiring soon

---

## GeminiClient

Client for making authenticated Gemini API requests (not typically used directly).

### Constructor

```typescript
new GeminiClient(tokenManager: TokenManager)
```

### Methods

#### generateContent()

```typescript
generateContent(userId: string, request: GeminiRequest): Promise<GeminiResponse>
```

Makes an authenticated request to generate content.

**Parameters:**

- `userId` (string): User's unique identifier
- `request` (GeminiRequest): Generation request

**Returns:** Promise<GeminiResponse> - Generated content

**Throws:** OAuthError on failure

---

## PKCEGenerator

Utility class for generating PKCE parameters.

### Static Methods

#### generateCodeVerifier()

```typescript
static generateCodeVerifier(): string
```

Generates a cryptographically secure code verifier.

**Returns:** string - Base64url-encoded code verifier (43-128 characters)

**Example:**

```typescript
import { PKCEGenerator } from 'google-oauth-gemini-boilerplate';

const codeVerifier = PKCEGenerator.generateCodeVerifier();
// Store in session for later use
req.session.codeVerifier = codeVerifier;
```

---

#### generateCodeChallenge()

```typescript
static generateCodeChallenge(verifier: string): Promise<string>
```

Generates a code challenge from a code verifier using SHA-256.

**Parameters:**

- `verifier` (string): Code verifier

**Returns:** Promise<string> - Base64url-encoded code challenge

**Example:**

```typescript
const codeVerifier = PKCEGenerator.generateCodeVerifier();
const codeChallenge = await PKCEGenerator.generateCodeChallenge(codeVerifier);

// Use in authorization URL
const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?...&code_challenge=${codeChallenge}&code_challenge_method=S256`;
```

---

## ConfigManager

Utility class for loading and validating configuration.

### Static Methods

#### load()

```typescript
static load(options?: ConfigOptions): OAuthClientConfig
```

Loads configuration from environment variables and/or provided options.

**Parameters:**

- `options` (ConfigOptions, optional): Configuration overrides

**Returns:** OAuthClientConfig - Validated configuration

**Throws:** OAuthError if configuration is invalid

**Example:**

```typescript
import { ConfigManager, GoogleOAuthClient } from 'google-oauth-gemini-boilerplate';

// Load from environment variables
const config = ConfigManager.load();

// Or provide overrides
const config = ConfigManager.load({
  clientId: 'custom-client-id',
  redirectUri: 'https://custom.com/callback',
});

const client = new GoogleOAuthClient(config);
```

**Environment Variables:**

```bash
GOOGLE_CLIENT_ID=required
GOOGLE_CLIENT_SECRET=optional
GOOGLE_REDIRECT_URI=required
GEMINI_SCOPES=optional (defaults to generative-language)
```

---

#### validate()

```typescript
static validate(config: OAuthClientConfig): void
```

Validates a configuration object.

**Parameters:**

- `config` (OAuthClientConfig): Configuration to validate

**Throws:** OAuthError if configuration is invalid

**Validation Rules:**

- `clientId` is required
- `redirectUri` is required and must be valid URL
- `redirectUri` must use HTTPS in production (except localhost)
- `scopes` must include Gemini API scope
- `tokenStore` is required

---

## Types and Interfaces

### OAuthClientConfig

```typescript
interface OAuthClientConfig {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scopes: string[];
  tokenStore: TokenStore;
  usePKCE?: boolean;
}
```

### UserInfo

```typescript
interface UserInfo {
  sub: string;           // Google user ID (unique identifier)
  email: string;         // User's email address
  emailVerified: boolean; // Whether email is verified
  name: string;          // Full name
  picture: string;       // Profile picture URL
  givenName: string;     // First name
  familyName: string;    // Last name
}
```

### TokenData

```typescript
interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;     // Unix timestamp
  scope: string;
  tokenType: string;     // Usually 'Bearer'
}
```

### GeminiRequest

```typescript
interface GeminiRequest {
  model?: string;        // Default: 'gemini-1.5-pro'
  contents: Array<{
    parts: Array<{
      text: string;
    }>;
  }>;
  generationConfig?: {
    temperature?: number;      // 0.0 to 1.0
    topK?: number;
    topP?: number;
    maxOutputTokens?: number;
  };
}
```

### GeminiResponse

```typescript
interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
    finishReason: string;
  }>;
}
```

---

## Error Handling

### OAuthError

Custom error class for OAuth-related errors.

```typescript
class OAuthError extends Error {
  type: OAuthErrorType;
  originalError?: any;
  retryable: boolean;
}
```

### OAuthErrorType

```typescript
enum OAuthErrorType {
  INVALID_REQUEST = 'invalid_request',
  UNAUTHORIZED_CLIENT = 'unauthorized_client',
  ACCESS_DENIED = 'access_denied',
  INVALID_GRANT = 'invalid_grant',
  NETWORK_ERROR = 'network_error',
  TOKEN_EXPIRED = 'token_expired',
  QUOTA_EXCEEDED = 'quota_exceeded',
}
```

### Error Handling Example

```typescript
try {
  const response = await client.callGemini(userId, request);
} catch (error) {
  if (error instanceof OAuthError) {
    switch (error.type) {
      case 'ACCESS_DENIED':
        // User denied authorization
        res.redirect('/login?error=access_denied');
        break;
        
      case 'INVALID_GRANT':
        // Refresh token expired, require re-authentication
        await tokenStore.deleteTokens(userId);
        res.redirect('/login?error=session_expired');
        break;
        
      case 'TOKEN_EXPIRED':
        // Token refresh failed
        res.status(401).json({ error: 'Please sign in again' });
        break;
        
      case 'QUOTA_EXCEEDED':
        // User quota exceeded
        res.status(429).json({
          error: 'Quota exceeded',
          retryAfter: error.retryAfter || 3600,
        });
        break;
        
      case 'NETWORK_ERROR':
        // Temporary network issue
        if (error.retryable) {
          // Retry with exponential backoff
        } else {
          res.status(503).json({ error: 'Service unavailable' });
        }
        break;
        
      default:
        res.status(500).json({ error: 'Internal error' });
    }
  } else {
    // Unexpected error
    console.error('Unexpected error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
}
```

### Error Properties

- `type` (OAuthErrorType): Error type for programmatic handling
- `message` (string): Human-readable error message
- `originalError` (any): Original error object (if available)
- `retryable` (boolean): Whether the operation can be retried
- `retryAfter` (number, optional): Seconds to wait before retry (for rate limits)

---

## Complete Usage Example

```typescript
import express from 'express';
import session from 'express-session';
import {
  GoogleOAuthClient,
  InMemoryTokenStore,
  OAuthError,
} from 'google-oauth-gemini-boilerplate';

const app = express();

// Initialize OAuth client
const client = new GoogleOAuthClient({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: 'http://localhost:3000/auth/callback',
  scopes: ['https://www.googleapis.com/auth/generative-language'],
  tokenStore: new InMemoryTokenStore(),
  usePKCE: true,
});

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
}));

// Login route
app.get('/auth/login', async (req, res) => {
  const authUrl = await client.getAuthorizationUrl();
  res.redirect(authUrl);
});

// Callback route
app.get('/auth/callback', async (req, res) => {
  try {
    const { code } = req.query;
    const userInfo = await client.handleCallback(code as string);
    req.session.userId = userInfo.sub;
    res.redirect('/dashboard');
  } catch (error) {
    if (error instanceof OAuthError && error.type === 'ACCESS_DENIED') {
      res.redirect('/login?error=access_denied');
    } else {
      res.status(500).send('Authentication failed');
    }
  }
});

// API route
app.post('/api/generate', express.json(), async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const response = await client.callGemini(userId, {
      contents: [{ parts: [{ text: req.body.prompt }] }],
    });
    
    res.json({
      text: response.candidates[0].content.parts[0].text,
    });
  } catch (error) {
    if (error instanceof OAuthError) {
      if (error.type === 'QUOTA_EXCEEDED') {
        res.status(429).json({ error: 'Quota exceeded' });
      } else if (error.type === 'TOKEN_EXPIRED') {
        res.status(401).json({ error: 'Please sign in again' });
      } else {
        res.status(500).json({ error: 'Generation failed' });
      }
    } else {
      res.status(500).json({ error: 'Internal error' });
    }
  }
});

// Logout route
app.post('/auth/logout', async (req, res) => {
  const userId = req.session.userId;
  if (userId) {
    await client.signOut(userId);
  }
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

---

## Additional Resources

- [README.md](./README.md) - Main documentation
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues
- [examples/](./examples/) - Usage examples
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Gemini API Documentation](https://ai.google.dev/docs)


## Constructor options

`GoogleOAuthClient` accepts either:
- `new GoogleOAuthClient({ ...options, tokenStore })`
- `new GoogleOAuthClient(options, tokenStore)` (backward compatible)

## `getUserInfo(userId)` behavior

`getUserInfo` now fetches profile data from Google's OpenID userinfo endpoint using a valid access token. It returns `null` only when no tokens are stored for that user.
