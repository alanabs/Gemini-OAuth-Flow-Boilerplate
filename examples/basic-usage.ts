/**
 * Basic usage example for GoogleOAuthClient
 * 
 * This is a minimal example showing the core API.
 * For a complete web application example with Express.js, see web-app.ts
 * 
 * Requirements: 7.2
 */

import { GoogleOAuthClient, InMemoryTokenStore } from '../src';

async function main() {
  // ============================================================================
  // 1. INITIALIZE THE CLIENT
  // ============================================================================
  
  /**
   * Create a token store for persisting user tokens
   * In production, use a database-backed implementation
   */
  const tokenStore = new InMemoryTokenStore();
  
  /**
   * Initialize the OAuth client with your Google Cloud credentials
   * Get these from: https://console.cloud.google.com/
   */
  const client = new GoogleOAuthClient(
    {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: 'http://localhost:3000/auth/callback',
      scopes: ['https://www.googleapis.com/auth/generative-language'],
      usePKCE: true, // Enable PKCE for enhanced security
    },
    tokenStore
  );

  // ============================================================================
  // 2. GENERATE AUTHORIZATION URL
  // ============================================================================
  
  /**
   * Generate the URL where users will authorize your app
   * The state parameter provides CSRF protection
   * The codeVerifier is used for PKCE flow
   */
  const authResult = await client.getAuthorizationUrl();
  
  console.log('='.repeat(70));
  console.log('STEP 1: User Authorization');
  console.log('='.repeat(70));
  console.log('Visit this URL to authorize:');
  console.log(authResult.url);
  console.log('\nState (for CSRF protection):', authResult.state);
  console.log('Code Verifier (save for callback):', authResult.codeVerifier);
  console.log('='.repeat(70));

  // ============================================================================
  // 3. HANDLE OAUTH CALLBACK
  // ============================================================================
  
  /**
   * After user authorizes, Google redirects to your callback URL with a code
   * Exchange this code for access and refresh tokens
   * 
   * In a real application, this happens in your callback route handler
   * See web-app.ts for a complete Express.js implementation
   */
  
  // Example (uncomment when you have a real authorization code):
  /*
  const code = 'authorization-code-from-callback';
  const userInfo = await client.handleCallback(code, authResult.codeVerifier);
  
  console.log('\n' + '='.repeat(70));
  console.log('STEP 2: User Authenticated');
  console.log('='.repeat(70));
  console.log('User ID:', userInfo.sub);
  console.log('Email:', userInfo.email);
  console.log('Name:', userInfo.name);
  console.log('='.repeat(70));
  */

  // ============================================================================
  // 4. MAKE GEMINI API CALLS
  // ============================================================================
  
  /**
   * Make authenticated API calls to Gemini
   * The client automatically handles token refresh if needed
   */
  
  // Example (uncomment after authentication):
  /*
  console.log('\n' + '='.repeat(70));
  console.log('STEP 3: Calling Gemini API');
  console.log('='.repeat(70));
  
  const response = await client.callGemini(userInfo.sub, {
    contents: [{
      parts: [{ text: 'Write a haiku about coding' }]
    }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    }
  });
  
  const generatedText = response.candidates[0].content.parts[0].text;
  console.log('Gemini response:');
  console.log(generatedText);
  console.log('='.repeat(70));
  */

  // ============================================================================
  // 5. SIGN OUT
  // ============================================================================
  
  /**
   * When user signs out, revoke tokens at Google and delete from storage
   * This ensures tokens cannot be used after logout
   */
  
  // Example (uncomment after authentication):
  /*
  console.log('\n' + '='.repeat(70));
  console.log('STEP 4: Signing Out');
  console.log('='.repeat(70));
  
  await client.signOut(userInfo.sub);
  console.log('✓ Tokens revoked at Google');
  console.log('✓ Tokens deleted from storage');
  console.log('✓ User signed out successfully');
  console.log('='.repeat(70));
  */

  // ============================================================================
  // NEXT STEPS
  // ============================================================================
  
  console.log('\n' + '='.repeat(70));
  console.log('Next Steps:');
  console.log('='.repeat(70));
  console.log('1. Set up Google Cloud Console credentials');
  console.log('2. See web-app.ts for a complete Express.js example');
  console.log('3. See README.md for detailed setup instructions');
  console.log('='.repeat(70));
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}
