# Documentation Index

Complete guide to all documentation for the Google OAuth Gemini Boilerplate.

## Getting Started

Start here if you're new to the library:

1. **[Quick Start Guide](../QUICK_START.md)** ⚡
   - 5-minute setup tutorial
   - Basic implementation
   - First API call
   - **Start here!**

2. **[README](../README.md)** 📖
   - Overview and features
   - Installation instructions
   - Basic usage examples
   - Configuration guide

## Core Documentation

### Setup and Configuration

- **[Google Cloud Console Setup](../README.md#google-cloud-console-setup)**
  - Creating a project
  - Enabling APIs
  - OAuth consent screen
  - Creating credentials
  - Development vs Production

- **[Configuration Guide](../README.md#configuration)**
  - Environment variables
  - Configuration options
  - Different deployment scenarios
  - Web, desktop, and mobile apps

### API Documentation

- **[API Reference](../API_REFERENCE.md)** 📚
  - Complete API documentation
  - All classes and methods
  - Type definitions
  - Usage examples
  - Error handling

### Token Storage

- **[Token Storage Overview](../README.md#token-storage)**
  - InMemoryTokenStore (development)
  - Custom implementations
  - Security considerations

- **[Token Store Quick Reference](../examples/TOKEN_STORES.md)**
  - Comparison of implementations
  - PostgreSQL setup
  - Redis setup
  - Decision guide

- **[Token Store Setup Guide](../examples/TOKEN_STORE_SETUP.md)**
  - Detailed PostgreSQL setup
  - Detailed Redis setup
  - Security best practices
  - Performance optimization
  - Troubleshooting

## Examples

- **[Web Application Example](../examples/README.md)**
  - Complete Express.js app
  - OAuth flow implementation
  - API integration
  - Error handling
  - Security considerations

- **[Basic Usage Example](../examples/basic-usage.ts)**
  - Simple command-line example
  - Minimal setup

- **[Database Token Store](../examples/database-token-store.ts)**
  - PostgreSQL implementation
  - Encryption example

- **[Redis Token Store](../examples/redis-token-store.ts)**
  - Redis implementation
  - High-performance caching

## Security

- **[Security Policy](../SECURITY.md)** 🔒
  - Reporting vulnerabilities
  - Security best practices
  - Token storage security
  - HTTPS/TLS requirements
  - PKCE implementation
  - Session management
  - Security checklist

- **[Security Considerations](../README.md#security-considerations)**
  - Token storage
  - Transport security
  - PKCE
  - Token handling
  - Input validation

## Troubleshooting

- **[Troubleshooting Guide](../TROUBLESHOOTING.md)** 🔧
  - Configuration issues
  - OAuth flow issues
  - Token management issues
  - Gemini API issues
  - Token storage issues
  - Security issues
  - Performance issues
  - Development issues

## Development

- **[Contributing Guide](../CONTRIBUTING.md)** 🤝
  - Development setup
  - Making changes
  - Testing requirements
  - Submitting pull requests
  - Coding standards
  - Documentation requirements

- **[Testing Guide](../README.md#testing)**
  - Running tests
  - Unit tests
  - Property-based tests
  - Integration tests
  - Test structure

- **[Changelog](../CHANGELOG.md)**
  - Version history
  - Release notes
  - Breaking changes
  - Migration guides

## Deployment

- **[Deployment Guide](../README.md#deployment)**
  - Environment setup
  - Deployment checklist
  - Scaling considerations
  - Monitoring

## Reference

### By Topic

#### Authentication & Authorization
- [OAuth Flow](../README.md#google-cloud-console-setup)
- [PKCE Implementation](../SECURITY.md#3-pkce-proof-key-for-code-exchange)
- [Token Management](../API_REFERENCE.md#tokenmanager)
- [Session Management](../SECURITY.md#4-session-management)

#### API Integration
- [Gemini API Client](../API_REFERENCE.md#geminiclient)
- [Making API Calls](../API_REFERENCE.md#callgemini)
- [Error Handling](../API_REFERENCE.md#error-handling)
- [Quota Management](../TROUBLESHOOTING.md#error-quota_exceeded)

#### Storage
- [Token Store Interface](../API_REFERENCE.md#tokenstore-interface)
- [PostgreSQL Setup](../examples/TOKEN_STORE_SETUP.md#postgresql-setup)
- [Redis Setup](../examples/TOKEN_STORE_SETUP.md#redis-setup)
- [Encryption](../SECURITY.md#1-token-storage)

#### Configuration
- [Environment Variables](../README.md#environment-variables)
- [Configuration Options](../API_REFERENCE.md#oauthclientconfig)
- [ConfigManager](../API_REFERENCE.md#configmanager)

### By Use Case

#### Building a Web App
1. [Quick Start Guide](../QUICK_START.md)
2. [Web Application Example](../examples/README.md)
3. [Session Management](../SECURITY.md#4-session-management)
4. [Deployment Guide](../README.md#deployment)

#### Building a Desktop App
1. [Configuration for Desktop](../README.md#desktop-application-public-client)
2. [PKCE Implementation](../SECURITY.md#3-pkce-proof-key-for-code-exchange)
3. [Token Storage](../examples/TOKEN_STORES.md)

#### Building a Mobile App
1. [Configuration for Mobile](../README.md#mobile-application)
2. [PKCE Requirements](../SECURITY.md#3-pkce-proof-key-for-code-exchange)
3. [Security Best Practices](../SECURITY.md)

#### Production Deployment
1. [Deployment Checklist](../README.md#deployment-checklist)
2. [Security Checklist](../SECURITY.md#security-checklist)
3. [Token Store Setup](../examples/TOKEN_STORE_SETUP.md)
4. [Monitoring](../README.md#monitoring)

#### Troubleshooting
1. [Common Issues](../TROUBLESHOOTING.md)
2. [OAuth Flow Issues](../TROUBLESHOOTING.md#oauth-flow-issues)
3. [Token Issues](../TROUBLESHOOTING.md#token-management-issues)
4. [API Issues](../TROUBLESHOOTING.md#gemini-api-issues)

## Quick Links

### Most Common Tasks

- **First time setup**: [Quick Start Guide](../QUICK_START.md)
- **Google Cloud setup**: [Console Setup](../README.md#google-cloud-console-setup)
- **Add authentication**: [Web App Example](../examples/README.md)
- **Make API calls**: [callGemini()](../API_REFERENCE.md#callgemini)
- **Store tokens**: [Token Store Setup](../examples/TOKEN_STORE_SETUP.md)
- **Fix errors**: [Troubleshooting](../TROUBLESHOOTING.md)
- **Deploy to production**: [Deployment Guide](../README.md#deployment)

### External Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Gemini API Documentation](https://ai.google.dev/docs)
- [Google Cloud Console](https://console.cloud.google.com/)
- [OAuth 2.0 Security Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)

## Documentation Structure

```
google-oauth-gemini-boilerplate/
├── README.md                    # Main documentation
├── QUICK_START.md              # 5-minute tutorial
├── API_REFERENCE.md            # Complete API docs
├── TROUBLESHOOTING.md          # Common issues
├── SECURITY.md                 # Security guide
├── CONTRIBUTING.md             # Contribution guide
├── CHANGELOG.md                # Version history
├── LICENSE                     # MIT License
├── docs/
│   └── INDEX.md               # This file
└── examples/
    ├── README.md              # Web app example
    ├── TOKEN_STORES.md        # Token store comparison
    ├── TOKEN_STORE_SETUP.md   # Detailed setup
    ├── web-app.ts             # Complete example
    ├── basic-usage.ts         # Simple example
    ├── database-token-store.ts # PostgreSQL example
    └── redis-token-store.ts   # Redis example
```

## Getting Help

1. **Check documentation** - Start with this index
2. **Review examples** - See working code in [examples/](../examples/)
3. **Search issues** - Check [GitHub Issues](https://github.com/your-org/google-oauth-gemini-boilerplate/issues)
4. **Ask questions** - Open a new issue or discussion

## Contributing to Documentation

Found an error or want to improve the docs? See [CONTRIBUTING.md](../CONTRIBUTING.md#documentation) for guidelines on:

- Fixing typos and errors
- Adding examples
- Improving clarity
- Adding new guides

---

**Need help?** Start with the [Quick Start Guide](../QUICK_START.md) or check [Troubleshooting](../TROUBLESHOOTING.md)!
