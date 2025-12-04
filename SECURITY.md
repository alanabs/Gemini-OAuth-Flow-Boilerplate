# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of this project seriously. If you discover a security vulnerability, please follow these steps:

### 1. Do Not Disclose Publicly

Please do not open a public GitHub issue for security vulnerabilities. This helps protect users who haven't yet updated.

### 2. Report Privately

Send a detailed report to: [security@example.com] (replace with actual email)

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)
- Your contact information

### 3. Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity
  - Critical: 1-7 days
  - High: 7-14 days
  - Medium: 14-30 days
  - Low: 30-90 days

### 4. Disclosure Process

1. We'll acknowledge your report
2. We'll investigate and validate the issue
3. We'll develop and test a fix
4. We'll release a security patch
5. We'll publicly disclose the vulnerability (with credit to you, if desired)

## Security Best Practices

### For Users of This Library

#### 1. Token Storage

**Always encrypt tokens at rest:**

```typescript
// Good: Use encrypted token store
const tokenStore = new DatabaseTokenStore(dbConfig, encryptionKey);

// Bad: Never store tokens in plain text
// Don't do this in production!
```

**Generate strong encryption keys:**

```bash
# Generate a secure 32-byte key
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Store encryption keys securely:**

- Use environment variables (never commit to git)
- Use secret management services (AWS Secrets Manager, HashiCorp Vault)
- Rotate keys periodically
- Use different keys for different environments

#### 2. HTTPS/TLS

**Always use HTTPS in production:**

```typescript
// Good: HTTPS redirect URI
redirectUri: 'https://yourdomain.com/auth/callback'

// Bad: HTTP in production (only use for localhost development)
redirectUri: 'http://yourdomain.com/auth/callback'
```

**Enforce HTTPS:**

```typescript
// Express.js example
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !req.secure) {
    return res.redirect('https://' + req.headers.host + req.url);
  }
  next();
});
```

#### 3. PKCE (Proof Key for Code Exchange)

**Always use PKCE for public clients:**

```typescript
// Good: PKCE enabled for public clients
const client = new GoogleOAuthClient({
  // ... other config
  usePKCE: true, // Required for mobile/desktop/SPA
});
```

**Store code verifiers securely:**

```typescript
// Good: Store in secure session
req.session.codeVerifier = codeVerifier;

// Bad: Don't expose in URLs or client-side storage
```

#### 4. Session Management

**Use secure session configuration:**

```typescript
app.use(session({
  secret: process.env.SESSION_SECRET!, // Strong random secret
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,        // HTTPS only
    httpOnly: true,      // No JavaScript access
    sameSite: 'lax',     // CSRF protection
    maxAge: 3600000,     // 1 hour
  },
  store: new RedisStore({ client: redisClient }), // Persistent store
}));
```

#### 5. Input Validation

**Validate all inputs:**

```typescript
// Good: Validate and sanitize
app.post('/api/generate', (req, res) => {
  const { prompt } = req.body;
  
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Invalid prompt' });
  }
  
  if (prompt.length > 10000) {
    return res.status(400).json({ error: 'Prompt too long' });
  }
  
  // Continue with validated input
});
```

#### 6. Rate Limiting

**Implement rate limiting:**

```typescript
import rateLimit from 'express-rate-limit';

// Authentication rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many authentication attempts',
});

app.use('/auth', authLimiter);

// API rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // 100 requests per 15 minutes
});

app.use('/api', apiLimiter);
```

#### 7. Error Handling

**Never expose sensitive data in errors:**

```typescript
// Good: Generic error message
catch (error) {
  console.error('Internal error:', error); // Log details server-side
  res.status(500).json({ error: 'Internal server error' });
}

// Bad: Exposing sensitive information
catch (error) {
  res.status(500).json({ error: error.message, stack: error.stack });
}
```

#### 8. Logging

**Never log sensitive data:**

```typescript
// Good: Log without sensitive data
logger.info('User authenticated', {
  userId: userInfo.sub,
  timestamp: Date.now(),
});

// Bad: Logging tokens or secrets
logger.info('Token received', { token: accessToken }); // DON'T DO THIS!
```

#### 9. Dependencies

**Keep dependencies updated:**

```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Update dependencies
npm update
```

**Use lock files:**

- Commit `package-lock.json` or `yarn.lock`
- Use exact versions for critical dependencies

#### 10. Environment Variables

**Secure environment variable management:**

```bash
# .env file (never commit!)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
ENCRYPTION_KEY=...
SESSION_SECRET=...
```

**Add to .gitignore:**

```gitignore
.env
.env.local
.env.*.local
```

### For Contributors

#### 1. Code Review

All code changes must:
- Pass security review
- Include tests
- Follow secure coding practices
- Not introduce new vulnerabilities

#### 2. Dependency Management

- Minimize dependencies
- Vet new dependencies for security
- Keep dependencies updated
- Use `npm audit` before releases

#### 3. Testing

Include security tests:
- Input validation tests
- Authentication/authorization tests
- Encryption/decryption tests
- Error handling tests

#### 4. Documentation

Document security considerations:
- Configuration requirements
- Deployment best practices
- Known limitations
- Security implications of features

## Known Security Considerations

### 1. Token Storage

**Risk**: Tokens stored in plain text can be compromised.

**Mitigation**: 
- Always use encryption (AES-256-GCM)
- Store encryption keys separately
- Use secure key management

### 2. Session Hijacking

**Risk**: Session tokens can be stolen via XSS or network sniffing.

**Mitigation**:
- Use httpOnly cookies
- Enable secure flag (HTTPS only)
- Implement CSRF protection
- Use short session timeouts

### 3. Token Leakage

**Risk**: Tokens exposed in logs, errors, or URLs.

**Mitigation**:
- Never log tokens
- Don't include tokens in error messages
- Don't pass tokens in URLs
- Use POST for sensitive operations

### 4. Refresh Token Theft

**Risk**: Long-lived refresh tokens can be stolen and used indefinitely.

**Mitigation**:
- Encrypt refresh tokens at rest
- Implement token rotation
- Monitor for suspicious refresh patterns
- Revoke tokens on sign out

### 5. CSRF Attacks

**Risk**: Attackers can trick users into performing unwanted actions.

**Mitigation**:
- Validate state parameter in OAuth flow
- Use SameSite cookies
- Implement CSRF tokens for state-changing operations

### 6. Man-in-the-Middle Attacks

**Risk**: Attackers can intercept OAuth flow or API calls.

**Mitigation**:
- Always use HTTPS/TLS
- Validate SSL certificates
- Use PKCE for public clients

### 7. Quota Exhaustion

**Risk**: Attackers can exhaust user quotas through abuse.

**Mitigation**:
- Implement rate limiting
- Monitor usage patterns
- Set per-user quotas
- Implement abuse detection

## Security Checklist

Before deploying to production:

- [ ] All tokens encrypted at rest
- [ ] Strong encryption keys generated and stored securely
- [ ] HTTPS enabled for all endpoints
- [ ] PKCE enabled for public clients
- [ ] Secure session configuration
- [ ] Rate limiting implemented
- [ ] Input validation on all endpoints
- [ ] Error handling doesn't expose sensitive data
- [ ] Logging doesn't include tokens or secrets
- [ ] Dependencies updated and audited
- [ ] Environment variables secured
- [ ] .env files not committed to git
- [ ] Security headers configured
- [ ] CORS properly configured
- [ ] Database connections use SSL/TLS
- [ ] Monitoring and alerting set up

## Security Headers

Recommended security headers for web applications:

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));
```

## Incident Response

If you discover a security incident:

1. **Contain**: Immediately revoke compromised tokens
2. **Assess**: Determine scope and impact
3. **Notify**: Inform affected users
4. **Remediate**: Fix the vulnerability
5. **Review**: Conduct post-incident review
6. **Improve**: Update security measures

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OAuth 2.0 Security Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)
- [Google OAuth 2.0 Security](https://developers.google.com/identity/protocols/oauth2/security-best-practices)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

## Contact

For security concerns: [security@example.com] (replace with actual email)

For general questions: [GitHub Issues](https://github.com/your-org/google-oauth-gemini-boilerplate/issues)
