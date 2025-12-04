# Google OAuth + Gemini API Example

This example demonstrates how to build a complete web application using the `google-oauth-gemini-boilerplate` library.

## Features

- ✅ Complete OAuth 2.0 flow with PKCE
- ✅ Secure token storage with AES-256-GCM encryption
- ✅ Authenticated Gemini API calls
- ✅ Automatic token refresh
- ✅ Comprehensive error handling
- ✅ CSRF protection
- ✅ Secure session management

## Prerequisites

1. **Node.js** (v18 or higher)
2. **Google Cloud Project** with OAuth credentials
3. **Gemini API** enabled

## Google Cloud Console Setup

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter a project name and click "Create"

### Step 2: Enable Gemini API

1. In your project, go to "APIs & Services" → "Library"
2. Search for "Generative Language API"
3. Click on it and click "Enable"

### Step 3: Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Choose "External" (or "Internal" if using Google Workspace)
3. Fill in the required fields:
   - **App name**: Your application name
   - **User support email**: Your email
   - **Developer contact email**: Your email
4. Click "Save and Continue"
5. On the "Scopes" page, click "Add or Remove Scopes"
6. Add the scope: `https://www.googleapis.com/auth/generative-language`
7. Click "Save and Continue"
8. On the "Test users" page, add your Google account email for testing
9. Click "Save and Continue"

### Step 4: Create OAuth Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Choose "Web application"
4. Configure:
   - **Name**: Your app name
   - **Authorized redirect URIs**: Add `http://localhost:3000/auth/callback`
5. Click "Create"
6. Copy the **Client ID** and **Client Secret**

## Installation

1. **Install dependencies**:

```bash
cd examples
npm install
```

2. **Create environment file**:

Create a `.env` file in the `examples` directory:

```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# Security Configuration
# Generate encryption key: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
ENCRYPTION_KEY=your-base64-encoded-32-byte-key

# Generate session secret: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
SESSION_SECRET=your-session-secret

# Server Configuration
PORT=3000
NODE_ENV=development
```

3. **Generate encryption keys**:

```bash
# Generate encryption key
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('base64'))"

# Generate session secret
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
```

Copy the output to your `.env` file.

## Running the Example

### Development Mode

```bash
npm run dev
```

The server will start at `http://localhost:3000`

### Production Mode

```bash
npm run build
npm start
```

## Usage

1. **Open your browser** and navigate to `http://localhost:3000`
2. **Click "Sign in with Google"** to start the OAuth flow
3. **Authorize the application** on Google's consent screen
4. **Try the Gemini API** by entering a prompt and clicking "Generate"
5. **Sign out** when done to revoke tokens

## Security Considerations

### ⚠️ Important Security Notes

1. **HTTPS in Production**
   - Always use HTTPS for redirect URIs in production
   - Set `NODE_ENV=production` to enable secure cookies
   - Update redirect URI in Google Cloud Console

2. **Environment Variables**
   - Never commit `.env` files to version control
   - Add `.env` to your `.gitignore`
   - Use secure key management in production (AWS Secrets Manager, etc.)

3. **Token Storage**
   - This example uses in-memory storage (data lost on restart)
   - For production, use database-backed storage
   - See `database-token-store.ts` for PostgreSQL implementation
   - See `redis-token-store.ts` for Redis implementation
   - See `TOKEN_STORE_SETUP.md` for detailed setup instructions

4. **Session Management**
   - Use a production-ready session store (Redis, PostgreSQL)
   - Configure appropriate session timeouts
   - Implement session rotation on privilege changes

5. **Rate Limiting**
   - Implement rate limiting to prevent abuse
   - Use libraries like `express-rate-limit`
   - Monitor quota usage per user

6. **Input Validation**
   - Always validate and sanitize user inputs
   - Implement content security policies
   - Use parameterized queries for databases

## Error Handling

The example includes comprehensive error handling:

### OAuth Errors

- **access_denied**: User denied authorization
- **invalid_grant**: Refresh token expired, re-authentication required
- **invalid_request**: Configuration or request error

### API Errors

- **401 Unauthorized**: Token expired (automatically refreshed)
- **429 Quota Exceeded**: User quota limit reached
- **503 Network Error**: Temporary connectivity issue (retryable)

### Example Error Response

```json
{
  "error": "quota_exceeded",
  "message": "User has exceeded their Gemini API quota",
  "retryAfter": 3600
}
```

## API Endpoints

### Authentication

- `GET /auth/login` - Initiate OAuth flow
- `GET /auth/callback` - OAuth callback handler
- `GET /auth/logout` - Sign out and revoke tokens

### API

- `POST /api/generate` - Generate content with Gemini API
  - Body: `{ "prompt": "Your prompt here" }`
  - Requires authentication

- `GET /api/user` - Get current user information
  - Requires authentication

### Utility

- `GET /health` - Health check endpoint
- `GET /` - Home page with login status

## Customization

### Using a Database Token Store

Replace the in-memory token store with a database implementation:

**PostgreSQL:**

```typescript
import { DatabaseTokenStore } from './database-token-store';

const tokenStore = new DatabaseTokenStore(
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'oauth_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    max: 20, // Connection pool size
  },
  process.env.ENCRYPTION_KEY!
);
```

**Redis:**

```typescript
import { RedisTokenStore } from './redis-token-store';

const tokenStore = new RedisTokenStore(
  {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  process.env.ENCRYPTION_KEY!
);

// Connect before using
await tokenStore.connect();
```

See `TOKEN_STORE_SETUP.md` for complete setup instructions including database schema and configuration.

### Customizing Gemini Parameters

Modify the generation config in the `/api/generate` endpoint:

```typescript
const request: GeminiRequest = {
  contents: [{ parts: [{ text: prompt }] }],
  generationConfig: {
    temperature: 0.9,      // Higher = more creative
    topK: 40,              // Top-k sampling
    topP: 0.95,            // Nucleus sampling
    maxOutputTokens: 2048, // Maximum response length
  },
};
```

### Adding More Routes

Add custom routes for your application:

```typescript
app.get('/api/custom', requireAuth, async (req, res, next) => {
  try {
    // Your custom logic here
    const userId = req.session.userId!;
    // ...
  } catch (error) {
    next(error);
  }
});
```

## Troubleshooting

### "GOOGLE_CLIENT_ID environment variable is required"

Make sure your `.env` file exists and contains valid credentials.

### "Invalid state parameter - possible CSRF attack"

This can happen if:
- Session storage is not working properly
- You're testing with multiple browser tabs
- Session expired during OAuth flow

Solution: Clear cookies and try again.

### "Token revocation failed"

This is usually not critical. The token is still deleted from local storage.

### "Quota exceeded"

Each user has a free tier quota. Wait for the quota to reset or upgrade to a paid plan.

## Production Deployment

### Environment Configuration

Update your `.env` for production:

```bash
NODE_ENV=production
GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/callback
```

### Google Cloud Console

1. Update authorized redirect URIs to use HTTPS
2. Submit app for verification if needed
3. Remove test user restrictions

### Security Checklist

- [ ] Use HTTPS for all endpoints
- [ ] Enable secure cookies (`secure: true`)
- [ ] Use production session store (Redis/PostgreSQL)
- [ ] Implement rate limiting
- [ ] Set up monitoring and alerts
- [ ] Use environment-specific encryption keys
- [ ] Enable CORS with appropriate origins
- [ ] Implement logging (without sensitive data)
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Regular security audits

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Gemini API Documentation](https://ai.google.dev/docs)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

## License

MIT
