/**
 * Example Express.js Web Application
 * 
 * This example demonstrates:
 * - Complete OAuth flow initialization
 * - Token storage setup with encryption
 * - Authenticated Gemini API calls
 * - Comprehensive error handling
 * - Security best practices
 * 
 * SECURITY CONSIDERATIONS:
 * 1. Always use HTTPS in production (redirect URIs must be HTTPS)
 * 2. Store encryption keys in environment variables, never in code
 * 3. Use secure session management (httpOnly, secure, sameSite cookies)
 * 4. Validate and sanitize all user inputs
 * 5. Implement CSRF protection using state parameter
 * 6. Never log tokens or sensitive data
 * 7. Use rate limiting to prevent abuse
 * 8. Keep dependencies updated for security patches
 * 
 * Requirements: 7.1, 7.2, 7.5
 */

import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import crypto from 'crypto';
import {
  GoogleOAuthClient,
  InMemoryTokenStore,
  OAuthError,
  OAuthErrorType,
  GeminiRequest,
} from '../src/index';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Load configuration from environment variables
 * 
 * SECURITY: Never hardcode credentials in source code
 * Use .env files (excluded from git) or environment-specific configuration
 */
const config = {
  // OAuth Configuration
  clientId: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/callback',
  
  // Encryption key for token storage (32 bytes, base64 encoded)
  // Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  encryptionKey: process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('base64'),
  
  // Session secret for cookie signing
  // Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  sessionSecret: process.env.SESSION_SECRET || crypto.randomBytes(64).toString('hex'),
  
  // Server configuration
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
};

// Validate required configuration
if (!config.clientId) {
  throw new Error('GOOGLE_CLIENT_ID environment variable is required');
}

// ============================================================================
// TOKEN STORAGE SETUP
// ============================================================================

/**
 * Initialize token store with encryption
 * 
 * SECURITY: Tokens are encrypted at rest using AES-256-GCM
 * In production, consider using a database-backed store (PostgreSQL, Redis)
 * See examples/database-token-store.ts for implementation
 */
const tokenStore = new InMemoryTokenStore(config.encryptionKey);

// ============================================================================
// OAUTH CLIENT INITIALIZATION
// ============================================================================

/**
 * Initialize Google OAuth client
 * 
 * The client handles:
 * - Authorization URL generation with PKCE
 * - Token exchange and refresh
 * - Authenticated Gemini API calls
 */
const oauthClient = new GoogleOAuthClient(
  {
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
    scopes: ['https://www.googleapis.com/auth/generative-language'],
    usePKCE: true, // Enable PKCE for enhanced security
  },
  tokenStore
);

// ============================================================================
// EXPRESS APP SETUP
// ============================================================================

const app = express();

// Parse JSON request bodies
app.use(express.json());

// Parse URL-encoded request bodies
app.use(express.urlencoded({ extended: true }));

/**
 * Session configuration
 * 
 * SECURITY CONSIDERATIONS:
 * - httpOnly: Prevents JavaScript access to cookies (XSS protection)
 * - secure: Only send cookies over HTTPS (set to true in production)
 * - sameSite: Prevents CSRF attacks
 * - maxAge: Session expires after 24 hours
 */
app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: config.nodeEnv === 'production', // HTTPS only in production
      sameSite: 'lax', // CSRF protection
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Extend session type to include our custom properties
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    state?: string;
    codeVerifier?: string;
  }
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Authentication middleware
 * Ensures user is logged in before accessing protected routes
 */
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Please log in to access this resource',
    });
  }
  next();
}

/**
 * Error handling middleware
 * Provides consistent error responses and logging
 * 
 * SECURITY: Never expose sensitive error details to clients in production
 */
function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  // Log error for debugging (but never log tokens or sensitive data)
  console.error('Error:', {
    message: err.message,
    type: err instanceof OAuthError ? err.type : 'unknown',
    path: req.path,
    method: req.method,
  });

  // Handle OAuth-specific errors
  if (err instanceof OAuthError) {
    const statusCode = getStatusCodeForErrorType(err.type);
    
    return res.status(statusCode).json({
      error: err.type,
      message: err.message,
      // Include retry-after for rate limit errors
      ...(err.type === OAuthErrorType.QUOTA_EXCEEDED && {
        retryAfter: 3600, // Suggest retry after 1 hour
      }),
    });
  }

  // Generic error response
  res.status(500).json({
    error: 'internal_error',
    message: config.nodeEnv === 'production' 
      ? 'An unexpected error occurred' 
      : err.message,
  });
}

/**
 * Map OAuth error types to HTTP status codes
 */
function getStatusCodeForErrorType(errorType: OAuthErrorType): number {
  switch (errorType) {
    case OAuthErrorType.INVALID_REQUEST:
      return 400;
    case OAuthErrorType.UNAUTHORIZED_CLIENT:
      return 401;
    case OAuthErrorType.ACCESS_DENIED:
      return 403;
    case OAuthErrorType.INVALID_GRANT:
      return 401;
    case OAuthErrorType.TOKEN_EXPIRED:
      return 401;
    case OAuthErrorType.QUOTA_EXCEEDED:
      return 429;
    case OAuthErrorType.NETWORK_ERROR:
      return 503;
    default:
      return 500;
  }
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * Home page
 * Shows login status and available actions
 */
app.get('/', (req: Request, res: Response) => {
  const isLoggedIn = !!req.session.userId;
  
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Google OAuth + Gemini Example</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
          .button { display: inline-block; padding: 10px 20px; margin: 10px 5px; background: #4285f4; color: white; text-decoration: none; border-radius: 4px; }
          .button:hover { background: #357ae8; }
          .status { padding: 15px; background: #f0f0f0; border-radius: 4px; margin: 20px 0; }
          .form { margin: 20px 0; }
          textarea { width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; }
          button { padding: 10px 20px; background: #4285f4; color: white; border: none; border-radius: 4px; cursor: pointer; }
          button:hover { background: #357ae8; }
          .response { background: #f9f9f9; padding: 15px; border-radius: 4px; margin: 20px 0; white-space: pre-wrap; }
        </style>
      </head>
      <body>
        <h1>Google OAuth + Gemini API Example</h1>
        
        <div class="status">
          <strong>Status:</strong> ${isLoggedIn ? '✓ Logged in' : '✗ Not logged in'}
          ${isLoggedIn ? `<br><strong>User ID:</strong> ${req.session.userId}` : ''}
        </div>

        ${!isLoggedIn ? `
          <a href="/auth/login" class="button">Sign in with Google</a>
          <p>Click above to authenticate with your Google account and access the Gemini API.</p>
        ` : `
          <div class="form">
            <h2>Try Gemini API</h2>
            <form action="/api/generate" method="POST">
              <textarea name="prompt" rows="4" placeholder="Enter your prompt here..." required></textarea>
              <br>
              <button type="submit">Generate</button>
            </form>
          </div>
          
          <a href="/auth/logout" class="button">Sign out</a>
        `}

        <h2>About This Example</h2>
        <p>This example demonstrates:</p>
        <ul>
          <li>Complete OAuth 2.0 flow with PKCE</li>
          <li>Secure token storage with encryption</li>
          <li>Authenticated Gemini API calls</li>
          <li>Automatic token refresh</li>
          <li>Comprehensive error handling</li>
        </ul>
      </body>
    </html>
  `);
});

/**
 * Initiate OAuth login flow
 * 
 * SECURITY: Uses state parameter for CSRF protection
 * The state is stored in session and validated in callback
 */
app.get('/auth/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Generate authorization URL with PKCE
    const result = await oauthClient.getAuthorizationUrl();
    
    // Store state and code verifier in session for validation
    // SECURITY: State parameter prevents CSRF attacks
    req.session.state = result.state;
    req.session.codeVerifier = result.codeVerifier;
    
    // Redirect user to Google's consent screen
    res.redirect(result.url);
  } catch (error) {
    next(error);
  }
});

/**
 * OAuth callback handler
 * 
 * This route is called by Google after user authorizes the app
 * Exchanges authorization code for tokens
 * 
 * SECURITY: Validates state parameter to prevent CSRF attacks
 */
app.get('/auth/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, state, error, error_description } = req.query;

    // Handle user denial or errors from Google
    if (error) {
      return res.status(403).send(`
        <!DOCTYPE html>
        <html>
          <head><title>Authorization Failed</title></head>
          <body>
            <h1>Authorization Failed</h1>
            <p><strong>Error:</strong> ${error}</p>
            <p><strong>Description:</strong> ${error_description || 'User denied access'}</p>
            <p><a href="/">Return to home</a></p>
          </body>
        </html>
      `);
    }

    // Validate required parameters
    if (!code || typeof code !== 'string') {
      throw new OAuthError(
        OAuthErrorType.INVALID_REQUEST,
        'Missing authorization code'
      );
    }

    // SECURITY: Validate state parameter to prevent CSRF attacks
    if (state !== req.session.state) {
      throw new OAuthError(
        OAuthErrorType.INVALID_REQUEST,
        'Invalid state parameter - possible CSRF attack'
      );
    }

    // Exchange authorization code for tokens
    const userInfo = await oauthClient.handleCallback(
      code,
      req.session.codeVerifier
    );

    // Store user ID in session
    req.session.userId = userInfo.sub;

    // Clear temporary OAuth data from session
    delete req.session.state;
    delete req.session.codeVerifier;

    // Redirect to home page
    res.redirect('/');
  } catch (error) {
    next(error);
  }
});

/**
 * Logout handler
 * Revokes tokens and clears session
 */
app.get('/auth/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId;

    if (userId) {
      // Revoke tokens at Google and delete from store
      await oauthClient.signOut(userId);
    }

    // Destroy session
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction error:', err);
      }
      res.redirect('/');
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Gemini API endpoint
 * Makes authenticated API calls on behalf of the user
 * 
 * SECURITY: Requires authentication via middleware
 * Handles token refresh automatically
 */
app.post('/api/generate', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prompt } = req.body;

    // Validate input
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        error: 'invalid_request',
        message: 'Prompt is required and must be a string',
      });
    }

    // Construct Gemini API request
    const request: GeminiRequest = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    };

    // Make authenticated API call
    // The client handles token refresh automatically if needed
    const response = await oauthClient.callGemini(req.session.userId!, request);

    // Extract generated text from response
    const generatedText = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Return response as HTML for form submission
    if (req.headers.accept?.includes('text/html')) {
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Gemini Response</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
              .response { background: #f9f9f9; padding: 15px; border-radius: 4px; margin: 20px 0; white-space: pre-wrap; }
              .button { display: inline-block; padding: 10px 20px; margin: 10px 5px; background: #4285f4; color: white; text-decoration: none; border-radius: 4px; }
            </style>
          </head>
          <body>
            <h1>Gemini Response</h1>
            <div class="response">${generatedText}</div>
            <a href="/" class="button">Back to Home</a>
          </body>
        </html>
      `);
    }

    // Return JSON for API clients
    res.json({
      success: true,
      text: generatedText,
      fullResponse: response,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * User info endpoint
 * Returns information about the currently authenticated user
 */
app.get('/api/user', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userInfo = await oauthClient.getUserInfo(req.session.userId!);
    
    if (!userInfo) {
      return res.status(404).json({
        error: 'not_found',
        message: 'User information not found',
      });
    }

    res.json(userInfo);
  } catch (error) {
    next(error);
  }
});

/**
 * Health check endpoint
 * Useful for monitoring and load balancers
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// Apply error handling middleware
app.use(errorHandler);

// ============================================================================
// SERVER STARTUP
// ============================================================================

/**
 * Start the Express server
 */
function startServer() {
  app.listen(config.port, () => {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║  Google OAuth + Gemini API Example Server                     ║
╚════════════════════════════════════════════════════════════════╝

Server running at: http://localhost:${config.port}
Environment: ${config.nodeEnv}

OAuth Configuration:
  Client ID: ${config.clientId.substring(0, 20)}...
  Redirect URI: ${config.redirectUri}
  PKCE: Enabled

Security Features:
  ✓ Token encryption (AES-256-GCM)
  ✓ HTTPS enforcement (production)
  ✓ CSRF protection (state parameter)
  ✓ Secure session cookies
  ✓ Automatic token refresh

Next Steps:
  1. Visit http://localhost:${config.port}
  2. Click "Sign in with Google"
  3. Authorize the application
  4. Try the Gemini API!

Press Ctrl+C to stop the server
    `);
  });
}

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}

// Export for testing
export { app, oauthClient, tokenStore };
