# Contributing to Google OAuth Gemini Boilerplate

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to this project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Coding Standards](#coding-standards)
- [Documentation](#documentation)

## Code of Conduct

This project follows a code of conduct to ensure a welcoming environment for all contributors. Please be respectful and constructive in all interactions.

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Git
- Google Cloud account (for testing OAuth flows)

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:

```bash
git clone https://github.com/YOUR_USERNAME/google-oauth-gemini-boilerplate.git
cd google-oauth-gemini-boilerplate
```

3. Add the upstream repository:

```bash
git remote add upstream https://github.com/ORIGINAL_OWNER/google-oauth-gemini-boilerplate.git
```

## Development Setup

### Install Dependencies

```bash
npm install
```

### Set Up Environment Variables

Create a `.env` file for testing:

```bash
GOOGLE_CLIENT_ID=your-test-client-id
GOOGLE_CLIENT_SECRET=your-test-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
```

### Build the Project

```bash
npm run build
```

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test suites
npm run test:unit
npm run test:property
npm run test:integration
```

## Making Changes

### Create a Branch

Create a descriptive branch name:

```bash
git checkout -b feature/add-new-feature
# or
git checkout -b fix/fix-bug-description
```

### Branch Naming Convention

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions or modifications
- `chore/` - Maintenance tasks

### Commit Messages

Follow conventional commit format:

```
type(scope): subject

body (optional)

footer (optional)
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test changes
- `chore`: Maintenance tasks

**Examples:**

```bash
git commit -m "feat(oauth): add support for custom scopes"
git commit -m "fix(token-manager): handle expired refresh tokens correctly"
git commit -m "docs(readme): update installation instructions"
```

## Testing

### Test Requirements

All contributions must include appropriate tests:

1. **Unit Tests** - Test individual functions and classes
2. **Property-Based Tests** - Test properties across many inputs
3. **Integration Tests** - Test complete workflows (when applicable)

### Writing Tests

#### Unit Tests

Place unit tests in `tests/unit/`:

```typescript
import { describe, it, expect } from 'vitest';
import { MyFunction } from '../src/my-module';

describe('MyFunction', () => {
  it('should handle valid input', () => {
    const result = MyFunction('valid-input');
    expect(result).toBe('expected-output');
  });

  it('should throw error for invalid input', () => {
    expect(() => MyFunction('invalid')).toThrow();
  });
});
```

#### Property-Based Tests

Place property tests in `tests/property/`:

```typescript
import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { MyFunction } from '../src/my-module';

describe('MyFunction Properties', () => {
  it('should satisfy property X for all inputs', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = MyFunction(input);
        // Assert property holds
        return result.length >= input.length;
      }),
      { numRuns: 100 }
    );
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test tests/unit/my-module.test.ts

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

### Test Coverage

Aim for:
- 80%+ code coverage
- All public APIs tested
- Edge cases covered
- Error conditions tested

## Submitting Changes

### Before Submitting

1. **Run all tests**: `npm test`
2. **Build the project**: `npm run build`
3. **Update documentation** if needed
4. **Add tests** for new features
5. **Follow coding standards**

### Pull Request Process

1. **Update your branch** with latest upstream:

```bash
git fetch upstream
git rebase upstream/main
```

2. **Push to your fork**:

```bash
git push origin feature/your-feature-name
```

3. **Create Pull Request** on GitHub:
   - Use a clear, descriptive title
   - Reference any related issues
   - Describe what changed and why
   - Include screenshots for UI changes
   - List any breaking changes

4. **Pull Request Template**:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Property tests added/updated
- [ ] Integration tests added/updated
- [ ] All tests passing

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings generated
```

### Review Process

- Maintainers will review your PR
- Address any feedback or requested changes
- Once approved, your PR will be merged

## Coding Standards

### TypeScript Style

- Use TypeScript strict mode
- Provide type annotations for public APIs
- Avoid `any` type when possible
- Use interfaces for object shapes
- Use enums for fixed sets of values

### Code Style

```typescript
// Good
export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export class TokenManager {
  constructor(
    private clientId: string,
    private tokenStore: TokenStore
  ) {}

  async getValidToken(userId: string): Promise<string> {
    const tokens = await this.tokenStore.getTokens(userId);
    if (!tokens) {
      throw new OAuthError('TOKEN_EXPIRED', 'No tokens found');
    }
    return tokens.accessToken;
  }
}
```

### Naming Conventions

- **Classes**: PascalCase (`TokenManager`, `OAuthClient`)
- **Interfaces**: PascalCase (`TokenStore`, `UserInfo`)
- **Functions**: camelCase (`getValidToken`, `refreshAccessToken`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`, `DEFAULT_TIMEOUT`)
- **Private members**: prefix with underscore (`_encryptionKey`)

### Error Handling

- Use custom error classes (`OAuthError`)
- Provide descriptive error messages
- Include error context when helpful
- Don't expose sensitive data in errors

```typescript
// Good
throw new OAuthError(
  'INVALID_GRANT',
  'Refresh token expired. User must re-authenticate.',
  originalError
);

// Bad
throw new Error('Token error');
```

### Comments and Documentation

- Use JSDoc for public APIs
- Comment complex logic
- Explain "why" not "what"
- Keep comments up to date

```typescript
/**
 * Refreshes an expired access token using the refresh token.
 * 
 * @param userId - Unique user identifier
 * @param refreshToken - Valid refresh token
 * @returns Updated token data with new access token
 * @throws {OAuthError} If refresh fails or refresh token is invalid
 */
async refreshAccessToken(
  userId: string,
  refreshToken: string
): Promise<TokenData> {
  // Implementation
}
```

## Documentation

### When to Update Documentation

Update documentation when:
- Adding new features
- Changing public APIs
- Fixing bugs that affect usage
- Adding configuration options
- Changing behavior

### Documentation Files

- `README.md` - Main documentation
- `API_REFERENCE.md` - Detailed API documentation
- `TROUBLESHOOTING.md` - Common issues and solutions
- `examples/` - Usage examples
- Code comments - Inline documentation

### Documentation Style

- Use clear, concise language
- Include code examples
- Provide context and rationale
- Keep it up to date
- Use proper markdown formatting

## Project Structure

```
google-oauth-gemini-boilerplate/
├── src/                    # Source code
│   ├── oauth-client.ts    # Main OAuth client
│   ├── token-manager.ts   # Token management
│   ├── token-store.ts     # Token storage interface
│   ├── gemini-client.ts   # Gemini API client
│   ├── config.ts          # Configuration management
│   ├── pkce.ts            # PKCE utilities
│   ├── types.ts           # Type definitions
│   └── index.ts           # Public exports
├── tests/                  # Test files
│   ├── unit/              # Unit tests
│   ├── property/          # Property-based tests
│   └── integration/       # Integration tests
├── examples/              # Usage examples
│   ├── web-app.ts        # Web application example
│   ├── basic-usage.ts    # Basic usage example
│   └── ...
├── dist/                  # Compiled output
└── docs/                  # Additional documentation
```

## Getting Help

- **Issues**: Check existing issues or create a new one
- **Discussions**: Use GitHub Discussions for questions
- **Documentation**: Read the README and other docs

## Recognition

Contributors will be recognized in:
- CHANGELOG.md
- GitHub contributors page
- Release notes (for significant contributions)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

Thank you for contributing! 🎉
