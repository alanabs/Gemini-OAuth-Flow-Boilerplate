# Google OAuth Gemini Boilerplate

A production-ready TypeScript library for implementing Google OAuth 2.0 authentication with Gemini API access. This boilerplate enables you to build applications that use the Gemini API with user credentials instead of API keys, providing per-user quota management and a better user experience.

## Features

- 🔐 **Complete OAuth 2.0 Flow**: Authorization, token exchange, and refresh
- 🔄 **Automatic Token Refresh**: Seamless token management with expiration handling
- 🛡️ **PKCE Support**: Enhanced security for public clients
- 🤖 **Gemini API Integration**: Ready-to-use client for generative AI calls
- 💾 **Flexible Token Storage**: Interface-based design for any storage backend
- 🔒 **Built-in Encryption**: AES-256-GCM token encryption
- 📝 **TypeScript First**: Full type safety and IntelliSense support
- ✅ **Thoroughly Tested**: Unit tests and property-based tests included
- 🚀 **Production Ready**: Error handling, retry logic, and security best practices

## Quick Start

**New to this library?** Check out the **[Quick Start Guide](./QUICK_START.md)** for a 5-minute setup tutorial!

### Installation

```bash
npm install google-oauth-gemini-boilerplate
```

### Basic Usage

```typescript
import { GoogleOAuthClient, InMemoryTokenStore } from 'google-oauth-gemini-boilerplate';

// Initialize the client
const client = new GoogleOAuthClient({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: 'https://yourapp.com/auth/callback',
  scopes: ['https://www.googleapis.com/auth/generative-language'],
  tokenStore: new InMemoryTokenStore(),
  usePKCE: true,
});

// Step 1: Redirect user to Google for authorization
const authUrl = await client.getAuthorizationUrl();
// Redirect user to authUrl

// Step 2: Handle the callback with authorization code
const userInfo = await client.handleCallback(code);
console.log('User authenticated:', userInfo.email);

// Step 3: Make Gemini API calls
const response = await client.callGemini(userInfo.sub, {
  contents: [{
    parts: [{ text: 'Explain quantum computing in simple terms' }]
  }]
});
console.log(response.candidates[0].content.parts[0].text);
```

For a complete step-by-step tutorial, see **[QUICK_START.md](./QUICK_START.md)**.


## Table of Contents

- [Google Cloud Console Setup](#google-cloud-console-setup)
- [Configuration](#configuration)
- [Token Storage](#token-storage)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Security Considerations](#security-considerations)
- [Testing](#testing)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

## Google Cloud Console Setup

Before using this library, you need to set up OAuth credentials in Google Cloud Console.

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Enter a project name and click **Create**
4. Wait for the project to be created and select it

### Step 2: Enable the Generative Language API

1. In your project, go to **APIs & Services** → **Library**
2. Search for "Generative Language API"
3. Click on it and press **Enable**
4. Wait for the API to be enabled

### Step 3: Configure OAuth Consent Screen

The consent screen is what users see when they authorize your application.

1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **User Type**:
   - **Internal**: Only for Google Workspace users in your organization
   - **External**: For any Google account user (requires verification for production)
3. Click **Create**

#### Fill in App Information:

- **App name**: Your application name (shown to users)
- **User support email**: Your support email
- **App logo**: Optional, but recommended (120x120px)
- **Application home page**: Your app's homepage URL
- **Application privacy policy**: Required for production
- **Application terms of service**: Optional but recommended

#### Add Scopes:

1. Click **Add or Remove Scopes**
2. Filter for "generative" or manually add:
   - `https://www.googleapis.com/auth/generative-language`
3. Click **Update** and then **Save and Continue**

#### Add Test Users (Development Only):

1. Click **Add Users**
2. Enter email addresses of users who can test your app
3. Click **Add** and then **Save and Continue**

**Note**: Apps in "Testing" mode are limited to 100 test users. For production, you'll need to publish and verify your app.


### Step 4: Create OAuth Credentials

Choose the credential type based on your application:

#### For Web Applications:

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Application type**: **Web application**
4. Enter a **Name** for your credentials
5. Add **Authorized JavaScript origins** (optional):
   - `https://yourdomain.com`
   - `http://localhost:3000` (for development)
6. Add **Authorized redirect URIs**:
   - `https://yourdomain.com/auth/callback`
   - `http://localhost:3000/auth/callback` (for development)
7. Click **Create**
8. **Save your Client ID and Client Secret** - you'll need these!

#### For Desktop Applications:

1. Select **Application type**: **Desktop app**
2. Enter a **Name**
3. Click **Create**
4. Desktop apps use `http://localhost` redirect URIs automatically
5. Enable PKCE in your configuration (recommended for desktop apps)

#### For Mobile Applications (iOS/Android):

1. Select **Application type**: **iOS** or **Android**
2. Follow platform-specific setup:
   - **iOS**: Provide bundle ID
   - **Android**: Provide package name and SHA-1 certificate fingerprint
3. Mobile apps should always use PKCE

### Step 5: Development vs Production

#### Development Mode:

- Keep your app in "Testing" status
- Add test users in the OAuth consent screen
- Only test users can authorize your app
- No verification required
- Use `http://localhost` redirect URIs

#### Production Mode:

- Click **Publish App** in OAuth consent screen
- If requesting sensitive or restricted scopes, submit for verification:
  1. Go to **OAuth consent screen**
  2. Click **Prepare for verification**
  3. Complete the verification questionnaire
  4. Provide privacy policy and terms of service
  5. Submit for review (can take several weeks)
- Use only HTTPS redirect URIs
- Implement proper error handling and security measures

### Verification Requirements

Your app needs verification if:
- It's published (not in Testing mode)
- It requests sensitive or restricted scopes
- It will be used by more than 100 users

The Generative Language API scope is considered **sensitive**, so production apps will require verification.

**Verification Process**:
1. Prepare documentation about your app's use of the scope
2. Provide privacy policy and terms of service URLs
3. Submit a demo video showing the OAuth flow
4. Respond to any questions from Google's review team
5. Wait for approval (typically 2-6 weeks)


## Configuration

### Environment Variables

Create a `.env` file in your project root:

```bash
# Required
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_REDIRECT_URI=https://yourapp.com/auth/callback

# Optional (required for confidential clients)
GOOGLE_CLIENT_SECRET=your-client-secret

# Optional (defaults to generative-language scope)
GEMINI_SCOPES=https://www.googleapis.com/auth/generative-language

# Required for token encryption
ENCRYPTION_KEY=your-base64-encoded-32-byte-key
```

### Configuration Options

```typescript
interface OAuthClientConfig {
  clientId: string;              // Your Google OAuth client ID
  clientSecret?: string;         // Client secret (optional for public clients)
  redirectUri: string;           // Where Google redirects after authorization
  scopes: string[];              // OAuth scopes to request
  tokenStore: TokenStore;        // Token storage implementation
  usePKCE?: boolean;            // Enable PKCE (default: true for public clients)
}
```

### Configuration Examples

#### Web Application (Confidential Client):

```typescript
import { GoogleOAuthClient, InMemoryTokenStore } from 'google-oauth-gemini-boilerplate';

const client = new GoogleOAuthClient({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!, // Required for web apps
  redirectUri: 'https://myapp.com/auth/callback',
  scopes: ['https://www.googleapis.com/auth/generative-language'],
  tokenStore: new InMemoryTokenStore(),
  usePKCE: false, // Optional for confidential clients
});
```

#### Desktop Application (Public Client):

```typescript
const client = new GoogleOAuthClient({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  // No client secret for desktop apps
  redirectUri: 'http://localhost:8080/callback',
  scopes: ['https://www.googleapis.com/auth/generative-language'],
  tokenStore: new InMemoryTokenStore(),
  usePKCE: true, // Required for public clients
});
```

#### Mobile Application:

```typescript
const client = new GoogleOAuthClient({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  redirectUri: 'com.myapp:/oauth2callback', // Custom URL scheme
  scopes: ['https://www.googleapis.com/auth/generative-language'],
  tokenStore: new SecureTokenStore(), // Use platform-specific secure storage
  usePKCE: true, // Required for mobile apps
});
```

#### Using ConfigManager:

```typescript
import { ConfigManager, GoogleOAuthClient } from 'google-oauth-gemini-boilerplate';

// Load from environment variables
const config = ConfigManager.load();
const client = new GoogleOAuthClient(config);

// Or provide overrides
const config = ConfigManager.load({
  clientId: 'custom-client-id',
  redirectUri: 'https://custom-redirect.com/callback',
});
```


## Token Storage

The library provides a flexible `TokenStore` interface that you can implement with any storage backend.

### Built-in: InMemoryTokenStore

For development and testing only. Tokens are lost when the application restarts.

```typescript
import { InMemoryTokenStore } from 'google-oauth-gemini-boilerplate';

const tokenStore = new InMemoryTokenStore();
```

### Custom Implementation: Database

For production, implement persistent storage. See `examples/database-token-store.ts`:

```typescript
import { TokenStore, TokenData } from 'google-oauth-gemini-boilerplate';
import { Pool } from 'pg';

class DatabaseTokenStore implements TokenStore {
  constructor(private db: Pool, private encryptionKey: Buffer) {}

  async saveTokens(userId: string, tokens: TokenData): Promise<void> {
    const encryptedAccess = this.encrypt(tokens.accessToken);
    const encryptedRefresh = this.encrypt(tokens.refreshToken);
    
    await this.db.query(
      `INSERT INTO oauth_tokens (user_id, access_token, refresh_token, expires_at, scope)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET
         access_token = $2, refresh_token = $3, expires_at = $4`,
      [userId, encryptedAccess, encryptedRefresh, new Date(tokens.expiresAt), tokens.scope]
    );
  }

  async getTokens(userId: string): Promise<TokenData | null> {
    const result = await this.db.query(
      'SELECT * FROM oauth_tokens WHERE user_id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      accessToken: this.decrypt(row.access_token),
      refreshToken: this.decrypt(row.refresh_token),
      expiresAt: row.expires_at.getTime(),
      scope: row.scope,
      tokenType: 'Bearer',
    };
  }

  async deleteTokens(userId: string): Promise<void> {
    await this.db.query('DELETE FROM oauth_tokens WHERE user_id = $1', [userId]);
  }

  async updateAccessToken(userId: string, accessToken: string, expiresAt: number): Promise<void> {
    const encrypted = this.encrypt(accessToken);
    await this.db.query(
      'UPDATE oauth_tokens SET access_token = $1, expires_at = $2 WHERE user_id = $3',
      [encrypted, new Date(expiresAt), userId]
    );
  }

  private encrypt(text: string): string {
    // Implementation in examples/database-token-store.ts
  }

  private decrypt(encrypted: string): string {
    // Implementation in examples/database-token-store.ts
  }
}
```

### Custom Implementation: Redis

For distributed systems with session caching. See `examples/redis-token-store.ts`:

```typescript
import { TokenStore, TokenData } from 'google-oauth-gemini-boilerplate';
import { createClient } from 'redis';

class RedisTokenStore implements TokenStore {
  constructor(private redis: RedisClient, private encryptionKey: Buffer) {}

  async saveTokens(userId: string, tokens: TokenData): Promise<void> {
    const encrypted = this.encrypt(JSON.stringify(tokens));
    await this.redis.set(`tokens:${userId}`, encrypted);
  }

  // ... other methods
}
```

See `examples/TOKEN_STORES.md` for complete implementations and setup instructions.


## API Reference

### GoogleOAuthClient

The main class for OAuth operations and Gemini API calls.

#### Constructor

```typescript
new GoogleOAuthClient(config: OAuthClientConfig)
```

#### Methods

##### `getAuthorizationUrl(state?: string): Promise<string>`

Generates the authorization URL to redirect users to Google's consent screen.

**Parameters:**
- `state` (optional): CSRF protection token. If not provided, a random state is generated.

**Returns:** Authorization URL string

**Example:**
```typescript
const authUrl = await client.getAuthorizationUrl('random-state-token');
// Redirect user to authUrl
```

##### `handleCallback(code: string, codeVerifier?: string): Promise<UserInfo>`

Exchanges the authorization code for tokens and returns user information.

**Parameters:**
- `code`: Authorization code from Google's callback
- `codeVerifier` (optional): PKCE code verifier (required if PKCE is enabled)

**Returns:** `UserInfo` object with user details

**Throws:** `OAuthError` if exchange fails

**Example:**
```typescript
try {
  const userInfo = await client.handleCallback(code, codeVerifier);
  console.log('User ID:', userInfo.sub);
  console.log('Email:', userInfo.email);
} catch (error) {
  if (error.type === 'ACCESS_DENIED') {
    console.log('User denied authorization');
  }
}
```

##### `callGemini(userId: string, request: GeminiRequest): Promise<GeminiResponse>`

Makes an authenticated request to the Gemini API.

**Parameters:**
- `userId`: User's unique identifier (from `userInfo.sub`)
- `request`: Gemini API request object

**Returns:** `GeminiResponse` with generated content

**Throws:** `OAuthError` if API call fails

**Example:**
```typescript
const response = await client.callGemini(userId, {
  contents: [{
    parts: [{ text: 'Write a haiku about coding' }]
  }],
  generationConfig: {
    temperature: 0.7,
    maxOutputTokens: 100,
  }
});

console.log(response.candidates[0].content.parts[0].text);
```

##### `signOut(userId: string): Promise<void>`

Signs out a user by revoking their tokens and deleting them from storage.

**Parameters:**
- `userId`: User's unique identifier

**Example:**
```typescript
await client.signOut(userId);
console.log('User signed out successfully');
```

##### `getUserInfo(userId: string): Promise<UserInfo | null>`

Retrieves stored user information.

**Parameters:**
- `userId`: User's unique identifier

**Returns:** `UserInfo` object or `null` if not found

**Example:**
```typescript
const userInfo = await client.getUserInfo(userId);
if (userInfo) {
  console.log('User email:', userInfo.email);
}
```


### Types and Interfaces

#### UserInfo

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

#### GeminiRequest

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

#### GeminiResponse

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

#### TokenData

```typescript
interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;     // Unix timestamp
  scope: string;
  tokenType: string;     // Usually 'Bearer'
}
```

#### OAuthError

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

class OAuthError extends Error {
  type: OAuthErrorType;
  originalError?: any;
  retryable: boolean;
}
```

### Utility Classes

#### PKCEGenerator

```typescript
class PKCEGenerator {
  static generateCodeVerifier(): string;
  static generateCodeChallenge(verifier: string): Promise<string>;
}
```

#### ConfigManager

```typescript
class ConfigManager {
  static load(options?: ConfigOptions): OAuthClientConfig;
  static validate(config: OAuthClientConfig): void;
}
```


## Examples

### Complete Web Application

See `examples/web-app.ts` for a full Express.js implementation:

```typescript
import express from 'express';
import session from 'express-session';
import { GoogleOAuthClient, InMemoryTokenStore } from 'google-oauth-gemini-boilerplate';

const app = express();
const client = new GoogleOAuthClient({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: 'http://localhost:3000/auth/callback',
  scopes: ['https://www.googleapis.com/auth/generative-language'],
  tokenStore: new InMemoryTokenStore(),
});

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
    res.status(400).send('Authentication failed');
  }
});

// API route
app.post('/api/generate', async (req, res) => {
  try {
    const userId = req.session.userId;
    const response = await client.callGemini(userId, {
      contents: [{ parts: [{ text: req.body.prompt }] }]
    });
    res.json(response);
  } catch (error) {
    if (error.type === 'QUOTA_EXCEEDED') {
      res.status(429).json({ error: 'Quota exceeded' });
    } else {
      res.status(500).json({ error: 'Generation failed' });
    }
  }
});

app.listen(3000);
```

### Basic Usage Example

See `examples/basic-usage.ts` for a simple command-line example.

### Token Store Examples

- `examples/database-token-store.ts` - PostgreSQL implementation
- `examples/redis-token-store.ts` - Redis implementation
- `examples/TOKEN_STORES.md` - Detailed documentation
- `examples/TOKEN_STORE_SETUP.md` - Setup instructions


## Security Considerations

### Token Storage

- **Always encrypt tokens at rest** using AES-256-GCM or equivalent
- Store encryption keys separately from token data (environment variables, key management service)
- Use parameterized queries to prevent SQL injection
- Restrict access to token storage with proper authentication and authorization
- Never log tokens or include them in error messages

### Transport Security

- **Use HTTPS/TLS 1.2 or higher** for all OAuth and API communications
- Enable certificate validation (no self-signed certificates in production)
- Use HTTPS redirect URIs in production (localhost HTTP allowed for development)

### PKCE (Proof Key for Code Exchange)

- **Always use PKCE for public clients** (mobile, desktop, single-page apps)
- Code verifiers must be generated using cryptographically secure random generators
- Code verifiers must be 43-128 characters long
- Code challenges must use SHA-256 hashing
- Store code verifiers securely and associate them with authorization requests

### Token Handling

- Access tokens must not be logged or exposed in error messages
- Treat refresh tokens as highly sensitive credentials
- Transmit tokens only over HTTPS
- Check token expiration before each use with a 5-minute buffer
- Implement token rotation for enhanced security

### Input Validation

- Validate all configuration parameters before use
- Validate redirect URIs against a whitelist
- Validate state parameters to prevent CSRF attacks
- Use authorization codes only once

### Best Practices

1. **Use environment variables** for sensitive configuration
2. **Implement rate limiting** to prevent abuse
3. **Monitor for suspicious activity** (unusual token refresh patterns)
4. **Set up alerts** for quota exceeded errors
5. **Regularly rotate encryption keys**
6. **Keep dependencies updated** for security patches
7. **Use secure session management** in web applications
8. **Implement proper error handling** without exposing sensitive details


## Testing

This library includes comprehensive test coverage with unit tests and property-based tests.

### Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run property-based tests only
npm run test:property

# Run tests in watch mode
npm run test:watch
```

### Test Structure

```
tests/
├── unit/                      # Unit tests for specific behaviors
│   ├── config.test.ts
│   ├── oauth-client.test.ts
│   ├── token-manager.test.ts
│   └── ...
├── property/                  # Property-based tests
│   ├── config.property.test.ts
│   ├── pkce.property.test.ts
│   ├── token-store.property.test.ts
│   └── ...
└── integration/               # End-to-end integration tests
    └── oauth-flow.integration.test.ts
```

### Property-Based Testing

This library uses [fast-check](https://github.com/dubzzz/fast-check) for property-based testing, which verifies that properties hold across many randomly generated inputs.

Each property test runs a minimum of 100 iterations to ensure adequate coverage of edge cases.


## Deployment

### Environment Setup

Create a `.env` file with required variables:

```bash
# Production environment
NODE_ENV=production

# Google OAuth credentials
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/callback

# Token encryption
ENCRYPTION_KEY=your-base64-encoded-32-byte-key

# Optional: Database connection (if using DatabaseTokenStore)
DATABASE_URL=postgresql://user:password@localhost:5432/myapp

# Optional: Redis connection (if using RedisTokenStore)
REDIS_URL=redis://localhost:6379
```

### Generating Encryption Key

```bash
# Generate a secure 32-byte key
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Deployment Checklist

- [ ] Set up Google Cloud project and enable Generative Language API
- [ ] Configure OAuth consent screen with production URLs
- [ ] Create OAuth credentials for your application type
- [ ] Set all required environment variables
- [ ] Use HTTPS for all redirect URIs
- [ ] Implement persistent token storage (database or Redis)
- [ ] Set up encryption key management
- [ ] Configure proper error logging and monitoring
- [ ] Test OAuth flow in production environment
- [ ] Submit app for verification if needed (for >100 users)
- [ ] Set up rate limiting and quota monitoring
- [ ] Implement backup and recovery for token storage
- [ ] Configure SSL/TLS certificates
- [ ] Set up health checks and uptime monitoring

### Scaling Considerations

- Use Redis or distributed cache for token storage in multi-instance deployments
- Implement connection pooling for database token stores
- Monitor token refresh rates to detect issues
- Set up alerts for quota exceeded errors
- Consider implementing a queue for API requests during high load
- Use load balancers with session affinity if using in-memory sessions

### Monitoring

Recommended metrics to track:

- OAuth flow success/failure rates
- Token refresh frequency and success rates
- API call latency and error rates
- Quota usage per user
- Authentication errors by type

## Documentation

📚 **[Complete Documentation Index](./docs/INDEX.md)** - Navigate all documentation

### Core Documentation

- **[Quick Start Guide](./QUICK_START.md)** ⚡ - Get started in 5 minutes
- **[README.md](./README.md)** - This file, main documentation and overview
- **[API Reference](./API_REFERENCE.md)** - Complete API documentation with examples
- **[Troubleshooting](./TROUBLESHOOTING.md)** - Common issues and solutions

### Examples and Guides

- **[Web Application Example](./examples/README.md)** - Complete Express.js implementation
- **[Token Store Comparison](./examples/TOKEN_STORES.md)** - Choose the right storage
- **[Token Store Setup](./examples/TOKEN_STORE_SETUP.md)** - PostgreSQL and Redis setup

### Security and Development

- **[Security Policy](./SECURITY.md)** - Security best practices and vulnerability reporting
- **[Contributing Guide](./CONTRIBUTING.md)** - Guidelines for contributors
- **[Changelog](./CHANGELOG.md)** - Version history and release notes

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on:

- Setting up your development environment
- Running tests
- Submitting pull requests
- Coding standards
- Documentation requirements

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/your-org/google-oauth-gemini-boilerplate/issues)
- **Documentation**: See the [Documentation](#documentation) section above
- **Examples**: Check the [examples/](./examples/) directory

## Acknowledgments

Built with:
- [TypeScript](https://www.typescriptlang.org/)
- [Vitest](https://vitest.dev/) for testing
- [fast-check](https://github.com/dubzzz/fast-check) for property-based testing

Special thanks to all contributors who help improve this project!
- Token storage performance