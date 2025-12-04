# Quick Start Guide

Get up and running with Google OAuth Gemini Boilerplate in 5 minutes.

## Prerequisites

- Node.js 18+
- Google Cloud account
- 10 minutes for Google Cloud setup

## Step 1: Install

```bash
npm install google-oauth-gemini-boilerplate
```

## Step 2: Google Cloud Setup (First Time Only)

### 2.1 Create Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable "Generative Language API"

### 2.2 Configure OAuth

1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** user type
3. Fill in app name and support email
4. Add scope: `https://www.googleapis.com/auth/generative-language`
5. Add your email as a test user

### 2.3 Create Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Choose **Web application**
4. Add redirect URI: `http://localhost:3000/auth/callback`
5. Save your **Client ID** and **Client Secret**

## Step 3: Configure Environment

Create `.env` file:

```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
```

## Step 4: Basic Implementation

### 4.1 Initialize Client

```typescript
import { GoogleOAuthClient, InMemoryTokenStore } from 'google-oauth-gemini-boilerplate';

const client = new GoogleOAuthClient({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI!,
  scopes: ['https://www.googleapis.com/auth/generative-language'],
  tokenStore: new InMemoryTokenStore(),
});
```

### 4.2 Add Authentication Routes

```typescript
import express from 'express';
import session from 'express-session';

const app = express();

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
    res.status(400).send('Authentication failed');
  }
});
```

### 4.3 Use Gemini API

```typescript
app.post('/api/generate', express.json(), async (req, res) => {
  try {
    const userId = req.session.userId;
    const { prompt } = req.body;
    
    const response = await client.callGemini(userId, {
      contents: [{ parts: [{ text: prompt }] }],
    });
    
    res.json({
      text: response.candidates[0].content.parts[0].text,
    });
  } catch (error) {
    res.status(500).json({ error: 'Generation failed' });
  }
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

## Step 5: Test It Out

1. Start your server:
```bash
node app.js
```

2. Visit: `http://localhost:3000/auth/login`

3. Sign in with your Google account

4. Make API calls:
```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Explain quantum computing"}'
```

## Next Steps

### Production Setup

For production, you'll need:

1. **Persistent Token Storage**
   - Use PostgreSQL or Redis instead of InMemoryTokenStore
   - See [examples/TOKEN_STORE_SETUP.md](./examples/TOKEN_STORE_SETUP.md)

2. **HTTPS**
   - Update redirect URI to use HTTPS
   - Configure SSL certificates

3. **Security**
   - Enable rate limiting
   - Implement proper error handling
   - See [SECURITY.md](./SECURITY.md)

4. **Google Verification**
   - Submit app for verification (for >100 users)
   - See [README.md](./README.md#verification-requirements)

### Learn More

- **[README.md](./README.md)** - Complete documentation
- **[API_REFERENCE.md](./API_REFERENCE.md)** - Detailed API docs
- **[examples/](./examples/)** - More examples
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Common issues

## Common Issues

### "redirect_uri_mismatch"

Make sure the redirect URI in your code exactly matches the one in Google Cloud Console (including http/https and trailing slashes).

### "access_denied"

User clicked "Cancel" on the consent screen. Handle this gracefully in your callback route.

### "Invalid state parameter"

Session storage isn't working. Make sure you've configured session middleware correctly.

### Tokens not persisting

You're using InMemoryTokenStore. For production, use DatabaseTokenStore or RedisTokenStore.

## Getting Help

- Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- Review [examples/](./examples/)
- Open an issue on GitHub

## Complete Example

See [examples/web-app.ts](./examples/web-app.ts) for a complete working example with:
- Full OAuth flow
- Error handling
- Session management
- API integration
- Sign out functionality

---

**Ready to build?** Start with the [examples/](./examples/) directory for complete working code!
