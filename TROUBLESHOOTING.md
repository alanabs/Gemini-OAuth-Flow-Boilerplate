# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with the Google OAuth Gemini Boilerplate.

## Table of Contents

- [Configuration Issues](#configuration-issues)
- [OAuth Flow Issues](#oauth-flow-issues)
- [Token Management Issues](#token-management-issues)
- [Gemini API Issues](#gemini-api-issues)
- [Token Storage Issues](#token-storage-issues)
- [Security Issues](#security-issues)
- [Performance Issues](#performance-issues)
- [Development Issues](#development-issues)

---

## Configuration Issues

### Error: "GOOGLE_CLIENT_ID environment variable is required"

**Cause**: Missing or invalid OAuth client ID configuration.

**Solution**:

1. Create a `.env` file in your project root:

```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback
```

2. Verify the client ID format ends with `.apps.googleusercontent.com`

3. Ensure the `.env` file is loaded:

```typescript
import dotenv from 'dotenv';
dotenv.config();
```

### Error: "Redirect URI must use HTTPS"

**Cause**: Using HTTP redirect URI in production mode.

**Solution**:

1. For development, use `http://localhost` (allowed exception)
2. For production, update to HTTPS:

```bash
GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/callback
```

3. Update the redirect URI in Google Cloud Console:
   - Go to APIs & Services → Credentials
   - Edit your OAuth client
   - Add the HTTPS redirect URI

### Error: "Invalid scope configuration"

**Cause**: Missing or incorrect Gemini API scope.

**Solution**:

Ensure the Gemini scope is included:

```typescript
const client = new GoogleOAuthClient({
  // ... other config
  scopes: ['https://www.googleapis.com/auth/generative-language'],
});
```

---

## OAuth Flow Issues

### Error: "Invalid state parameter - possible CSRF attack"

**Cause**: State parameter mismatch between authorization request and callback.

**Common Reasons**:
- Session storage not working
- Multiple browser tabs/windows
- Session expired during OAuth flow
- Cookies disabled

**Solution**:

1. **Check session configuration**:

```typescript
import session from 'express-session';

app.use(session({
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    maxAge: 3600000, // 1 hour
  }
}));
```

2. **Clear browser cookies** and try again

3. **Use a single browser tab** during OAuth flow

4. **Check session store** is working:

```typescript
app.get('/test-session', (req, res) => {
  req.session.test = 'working';
  res.send('Session test: ' + req.session.test);
});
```

### Error: "access_denied" - User denied authorization

**Cause**: User clicked "Cancel" or "Deny" on Google's consent screen.

**Solution**:

1. Handle the error gracefully:

```typescript
app.get('/auth/callback', async (req, res) => {
  const { error } = req.query;
  
  if (error === 'access_denied') {
    return res.redirect('/login?error=access_denied');
  }
  
  // ... continue with normal flow
});
```

2. Provide clear messaging to users about why authorization is needed

3. Allow users to retry authorization

### Error: "redirect_uri_mismatch"

**Cause**: Redirect URI in request doesn't match Google Cloud Console configuration.

**Solution**:

1. **Check exact match** (including trailing slashes, http vs https):

```bash
# In your code
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# In Google Cloud Console
http://localhost:3000/auth/callback
```

2. **Update Google Cloud Console**:
   - Go to APIs & Services → Credentials
   - Edit OAuth client
   - Add the exact redirect URI
   - Save changes

3. **Common mismatches**:
   - `http://localhost:3000/callback` vs `http://localhost:3000/auth/callback`
   - `http://localhost:3000` vs `http://localhost:3000/`
   - `http` vs `https`

### Error: "invalid_client"

**Cause**: Invalid client ID or client secret.

**Solution**:

1. Verify credentials in Google Cloud Console
2. Regenerate client secret if needed
3. Update environment variables
4. Restart your application

---

## Token Management Issues

### Error: "invalid_grant" - Refresh token expired

**Cause**: Refresh token is no longer valid.

**Common Reasons**:
- User revoked access
- Token expired (6 months of inactivity)
- User changed password
- Maximum refresh token limit reached

**Solution**:

1. **Require re-authentication**:

```typescript
try {
  const token = await tokenManager.getValidAccessToken(userId);
} catch (error) {
  if (error.type === 'INVALID_GRANT') {
    // Redirect to login
    return res.redirect('/auth/login');
  }
}
```

2. **Clear stored tokens**:

```typescript
await tokenStore.deleteTokens(userId);
```

3. **Inform user** they need to sign in again

### Error: "Token expired and no refresh token available"

**Cause**: Access token expired but no refresh token stored.

**Solution**:

1. **Ensure refresh token is requested**:

```typescript
// Include offline access
const authUrl = await client.getAuthorizationUrl();
// Refresh token is automatically requested
```

2. **Check token storage**:

```typescript
const tokens = await tokenStore.getTokens(userId);
console.log('Has refresh token:', !!tokens?.refreshToken);
```

3. **Require re-authentication** if no refresh token

### Tokens not persisting between restarts

**Cause**: Using InMemoryTokenStore in production.

**Solution**:

Use a persistent token store:

```typescript
// Instead of InMemoryTokenStore
import { DatabaseTokenStore } from './examples/database-token-store';

const tokenStore = new DatabaseTokenStore(dbConfig, encryptionKey);
```

See `examples/TOKEN_STORE_SETUP.md` for setup instructions.

---

## Gemini API Issues

### Error: "quota_exceeded"

**Cause**: User has exceeded their Gemini API quota.

**Solution**:

1. **Handle gracefully**:

```typescript
try {
  const response = await client.callGemini(userId, request);
} catch (error) {
  if (error.type === 'QUOTA_EXCEEDED') {
    return res.status(429).json({
      error: 'Quota exceeded',
      message: 'You have reached your API quota. Please try again later.',
      retryAfter: error.retryAfter || 3600,
    });
  }
}
```

2. **Inform users** about quota limits

3. **Implement rate limiting** to prevent abuse:

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each user to 100 requests per window
});

app.use('/api/generate', limiter);
```

4. **Monitor quota usage** per user

### Error: "401 Unauthorized" from Gemini API

**Cause**: Invalid or expired access token.

**Solution**:

The library automatically handles this by:
1. Detecting 401 error
2. Refreshing the access token
3. Retrying the request once

If the error persists:

1. **Check token validity**:

```typescript
const tokens = await tokenStore.getTokens(userId);
console.log('Token expires at:', new Date(tokens.expiresAt));
console.log('Is expired:', Date.now() > tokens.expiresAt);
```

2. **Verify scope** includes Gemini API:

```typescript
console.log('Token scope:', tokens.scope);
// Should include: https://www.googleapis.com/auth/generative-language
```

3. **Require re-authentication** if refresh fails

### Error: "API endpoint not found"

**Cause**: Incorrect Gemini API endpoint or model name.

**Solution**:

1. **Verify model name**:

```typescript
const response = await client.callGemini(userId, {
  model: 'gemini-1.5-pro', // Correct model name
  contents: [{ parts: [{ text: 'Hello' }] }],
});
```

2. **Check API is enabled** in Google Cloud Console:
   - Go to APIs & Services → Library
   - Search for "Generative Language API"
   - Ensure it's enabled

### Slow API responses

**Cause**: Large prompts, complex generation, or network latency.

**Solution**:

1. **Implement timeout**:

```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

try {
  const response = await client.callGemini(userId, request);
} finally {
  clearTimeout(timeout);
}
```

2. **Optimize prompts**:
   - Keep prompts concise
   - Reduce maxOutputTokens
   - Lower temperature for faster responses

3. **Add loading indicators** in UI

---

## Token Storage Issues

### PostgreSQL: "Connection refused"

**Cause**: PostgreSQL not running or incorrect connection settings.

**Solution**:

1. **Check PostgreSQL is running**:

```bash
sudo systemctl status postgresql
# or
pg_isready
```

2. **Verify connection settings**:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=oauth_db
DB_USER=postgres
DB_PASSWORD=your_password
```

3. **Test connection**:

```bash
psql -h localhost -U postgres -d oauth_db
```

4. **Check firewall rules** allow connections

### PostgreSQL: "Encryption/decryption failed"

**Cause**: Incorrect encryption key or corrupted data.

**Solution**:

1. **Verify encryption key**:

```bash
# Key must be exactly 32 bytes, base64 encoded
node -e "console.log(Buffer.from(process.env.ENCRYPTION_KEY, 'base64').length)"
# Should output: 32
```

2. **Don't change encryption key** after storing tokens (data becomes unreadable)

3. **If key changed**, clear all tokens and require re-authentication:

```sql
TRUNCATE TABLE oauth_tokens;
```

### Redis: "Connection refused"

**Cause**: Redis not running or incorrect connection settings.

**Solution**:

1. **Check Redis is running**:

```bash
redis-cli ping
# Should return: PONG
```

2. **Start Redis**:

```bash
# macOS
brew services start redis

# Linux
sudo systemctl start redis-server

# Docker
docker start redis
```

3. **Verify connection settings**:

```bash
REDIS_URL=redis://localhost:6379
# or
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Redis: "Authentication failed"

**Cause**: Redis requires password but none provided.

**Solution**:

1. **Add password to connection**:

```bash
REDIS_URL=redis://:your_password@localhost:6379
# or
REDIS_PASSWORD=your_password
```

2. **Or disable password** in Redis config (development only):

```bash
# Edit /etc/redis/redis.conf
# Comment out: requirepass your_password
```

---

## Security Issues

### Warning: "Tokens not encrypted"

**Cause**: Missing or invalid encryption key.

**Solution**:

1. **Generate encryption key**:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

2. **Add to environment**:

```bash
ENCRYPTION_KEY=your_generated_key
```

3. **Never commit encryption keys** to version control

### Error: "PKCE verification failed"

**Cause**: Code verifier doesn't match code challenge.

**Solution**:

1. **Store code verifier** during authorization:

```typescript
const { codeVerifier, codeChallenge } = await PKCEGenerator.generate();

// Store codeVerifier in session
req.session.codeVerifier = codeVerifier;

// Use codeChallenge in authorization URL
const authUrl = await client.getAuthorizationUrl(state, codeChallenge);
```

2. **Retrieve code verifier** in callback:

```typescript
const codeVerifier = req.session.codeVerifier;
const userInfo = await client.handleCallback(code, codeVerifier);
```

3. **Ensure session persistence** between requests

### Suspicious activity detected

**Indicators**:
- Unusual token refresh patterns
- Multiple failed authentication attempts
- Tokens accessed from unexpected locations

**Solution**:

1. **Implement monitoring**:

```typescript
// Log authentication events
logger.info('User authenticated', {
  userId,
  ip: req.ip,
  userAgent: req.headers['user-agent'],
});
```

2. **Add rate limiting**:

```typescript
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 attempts per 15 minutes
  message: 'Too many authentication attempts',
});

app.use('/auth', authLimiter);
```

3. **Implement alerts** for suspicious patterns

4. **Require re-authentication** for sensitive operations

---

## Performance Issues

### Slow token retrieval

**Cause**: Database queries not optimized or connection pool exhausted.

**Solution**:

1. **Check database indexes**:

```sql
-- PostgreSQL
\d oauth_tokens
-- Should show indexes on user_id, expires_at
```

2. **Optimize connection pool**:

```typescript
const tokenStore = new DatabaseTokenStore({
  // ... other config
  max: 20, // Increase pool size
  idleTimeoutMillis: 30000,
}, encryptionKey);
```

3. **Add caching layer**:

```typescript
// Cache tokens in memory for 5 minutes
const cache = new Map();

async function getCachedTokens(userId: string) {
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.tokens;
  }
  
  const tokens = await tokenStore.getTokens(userId);
  cache.set(userId, { tokens, expiresAt: Date.now() + 300000 });
  return tokens;
}
```

### High memory usage

**Cause**: Too many tokens cached in memory or connection leaks.

**Solution**:

1. **Monitor memory**:

```typescript
setInterval(() => {
  const usage = process.memoryUsage();
  console.log('Memory usage:', {
    rss: Math.round(usage.rss / 1024 / 1024) + 'MB',
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
  });
}, 60000);
```

2. **Implement cache eviction**:

```typescript
// Limit cache size
const MAX_CACHE_SIZE = 1000;

if (cache.size > MAX_CACHE_SIZE) {
  const oldestKey = cache.keys().next().value;
  cache.delete(oldestKey);
}
```

3. **Close connections properly**:

```typescript
process.on('SIGTERM', async () => {
  await tokenStore.close();
  process.exit(0);
});
```

### API calls timing out

**Cause**: Network issues, slow Gemini API, or large requests.

**Solution**:

1. **Implement timeout**:

```typescript
const TIMEOUT = 30000; // 30 seconds

const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('Request timeout')), TIMEOUT);
});

const response = await Promise.race([
  client.callGemini(userId, request),
  timeoutPromise,
]);
```

2. **Reduce request size**:

```typescript
const request = {
  contents: [{ parts: [{ text: prompt }] }],
  generationConfig: {
    maxOutputTokens: 1024, // Reduce from default
  },
};
```

3. **Implement retry logic** with exponential backoff

---

## Development Issues

### Tests failing

**Common Causes**:
- Missing environment variables
- Incorrect test setup
- Async timing issues

**Solution**:

1. **Check test environment**:

```bash
# Create .env.test
GOOGLE_CLIENT_ID=test-client-id
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
```

2. **Run specific test**:

```bash
npm test tests/unit/oauth-client.test.ts
```

3. **Check async handling**:

```typescript
// Use async/await properly
it('should handle async operation', async () => {
  const result = await asyncFunction();
  expect(result).toBe('expected');
});
```

### TypeScript compilation errors

**Cause**: Type mismatches or missing type definitions.

**Solution**:

1. **Check TypeScript version**:

```bash
npm list typescript
```

2. **Install type definitions**:

```bash
npm install --save-dev @types/node
```

3. **Check tsconfig.json**:

```json
{
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

### Hot reload not working

**Cause**: Build output not being regenerated.

**Solution**:

1. **Use watch mode**:

```bash
npm run build -- --watch
```

2. **Or use ts-node** for development:

```bash
npm install --save-dev ts-node
npx ts-node src/index.ts
```

---

## Getting More Help

If you're still experiencing issues:

1. **Check existing issues** on GitHub
2. **Search documentation** for related topics
3. **Enable debug logging**:

```typescript
process.env.DEBUG = 'oauth:*';
```

4. **Create a minimal reproduction** of the issue
5. **Open a GitHub issue** with:
   - Clear description of the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (Node version, OS, etc.)
   - Relevant code snippets (without sensitive data)
   - Error messages and stack traces

## Additional Resources

- [README.md](./README.md) - Main documentation
- [API_REFERENCE.md](./API_REFERENCE.md) - Detailed API docs
- [examples/](./examples/) - Usage examples
- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Gemini API Documentation](https://ai.google.dev/docs)
