# Token Store Quick Reference

This guide provides a quick overview of the available token store implementations.

## Available Implementations

### 1. InMemoryTokenStore (Built-in)

**Best for:** Development, testing, single-instance applications

**Pros:**
- ✅ No external dependencies
- ✅ Fast performance
- ✅ Simple setup
- ✅ Built-in encryption

**Cons:**
- ❌ Data lost on restart
- ❌ Not suitable for distributed systems
- ❌ Limited to single process

**Usage:**

```typescript
import { InMemoryTokenStore } from '../src/token-store';

const tokenStore = new InMemoryTokenStore(
  process.env.ENCRYPTION_KEY // Optional, generates random key if not provided
);
```

---

### 2. DatabaseTokenStore (PostgreSQL)

**Best for:** Traditional web applications, ACID compliance required

**Pros:**
- ✅ Persistent storage
- ✅ ACID transactions
- ✅ Supports distributed systems
- ✅ Rich querying capabilities
- ✅ Mature ecosystem

**Cons:**
- ❌ Requires PostgreSQL setup
- ❌ Slower than Redis
- ❌ More complex configuration

**Installation:**

```bash
npm install pg
npm install --save-dev @types/pg
```

**Database Setup:**

```bash
# Create database
createdb oauth_db

# Run schema
psql oauth_db < schema.sql
```

**Usage:**

```typescript
import { DatabaseTokenStore } from './examples/database-token-store';

const tokenStore = new DatabaseTokenStore(
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'oauth_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD!,
    max: 20, // Connection pool size
  },
  process.env.ENCRYPTION_KEY!
);

// Graceful shutdown
process.on('SIGTERM', async () => {
  await tokenStore.close();
});
```

**Environment Variables:**

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=oauth_db
DB_USER=postgres
DB_PASSWORD=your_password
ENCRYPTION_KEY=your_base64_key
```

---

### 3. RedisTokenStore

**Best for:** High-traffic applications, microservices, distributed systems

**Pros:**
- ✅ Persistent storage
- ✅ Very fast performance
- ✅ Supports distributed systems
- ✅ Automatic expiration
- ✅ Simple data model

**Cons:**
- ❌ Requires Redis setup
- ❌ Limited querying capabilities
- ❌ Memory-based (more expensive at scale)

**Installation:**

```bash
npm install redis
```

**Redis Setup:**

```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl start redis-server

# Docker
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

**Usage:**

```typescript
import { RedisTokenStore } from './examples/redis-token-store';

const tokenStore = new RedisTokenStore(
  {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    // Or use individual parameters:
    // host: 'localhost',
    // port: 6379,
    // password: 'your_password',
  },
  process.env.ENCRYPTION_KEY!,
  'myapp:oauth:' // Optional key prefix
);

// Connect before using
await tokenStore.connect();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await tokenStore.close();
});
```

**Environment Variables:**

```bash
REDIS_URL=redis://localhost:6379
# Or
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
ENCRYPTION_KEY=your_base64_key
```

---

## Comparison Table

| Feature | InMemory | PostgreSQL | Redis |
|---------|----------|------------|-------|
| **Persistence** | ❌ No | ✅ Yes | ✅ Yes |
| **Distributed** | ❌ No | ✅ Yes | ✅ Yes |
| **Performance** | ⚡⚡⚡ Fastest | 🐢 Moderate | ⚡⚡ Fast |
| **Setup Complexity** | 🟢 Simple | 🟡 Moderate | 🟡 Moderate |
| **Memory Usage** | Low | Low | High |
| **Querying** | Limited | Rich | Limited |
| **ACID Transactions** | N/A | ✅ Yes | ❌ No |
| **Auto Expiration** | ❌ No | ❌ No* | ✅ Yes |
| **Backup/Recovery** | ❌ No | ✅ Easy | ✅ Easy |
| **Cost** | Free | Low | Moderate |

*Can be implemented with scheduled jobs

---

## Decision Guide

### Choose InMemoryTokenStore if:
- You're developing or testing locally
- You have a single-instance application
- You don't need persistence
- You want the simplest setup

### Choose DatabaseTokenStore if:
- You need persistent storage
- You already use PostgreSQL
- You need ACID transactions
- You want rich querying capabilities
- You have moderate traffic

### Choose RedisTokenStore if:
- You need high performance
- You have distributed systems
- You already use Redis
- You want automatic expiration
- You have high traffic

---

## Migration Between Stores

You can migrate tokens between different store implementations:

```typescript
async function migrateTokens(
  sourceStore: TokenStore,
  targetStore: TokenStore,
  userIds: string[]
): Promise<void> {
  for (const userId of userIds) {
    const tokens = await sourceStore.getTokens(userId);
    if (tokens) {
      await targetStore.saveTokens(userId, tokens);
      console.log(`Migrated tokens for user: ${userId}`);
    }
  }
}

// Example: Migrate from InMemory to PostgreSQL
const inMemoryStore = new InMemoryTokenStore(encryptionKey);
const dbStore = new DatabaseTokenStore(dbConfig, encryptionKey);

await migrateTokens(inMemoryStore, dbStore, ['user1', 'user2', 'user3']);
```

---

## Custom Implementation

You can implement your own token store by implementing the `TokenStore` interface:

```typescript
import { TokenStore, TokenData } from '../src/types';

export class CustomTokenStore implements TokenStore {
  async saveTokens(userId: string, tokens: TokenData): Promise<void> {
    // Your implementation
  }

  async getTokens(userId: string): Promise<TokenData | null> {
    // Your implementation
  }

  async deleteTokens(userId: string): Promise<void> {
    // Your implementation
  }

  async updateAccessToken(
    userId: string,
    accessToken: string,
    expiresAt: number
  ): Promise<void> {
    // Your implementation
  }
}
```

**Popular alternatives:**
- MongoDB
- DynamoDB
- Firebase Firestore
- MySQL/MariaDB
- SQLite (for desktop apps)

---

## Security Considerations

All token stores should:

1. **Encrypt tokens at rest** using AES-256-GCM
2. **Use secure encryption keys** (32 bytes, randomly generated)
3. **Store keys separately** from token data
4. **Use secure connections** (SSL/TLS for databases)
5. **Implement access controls** (database permissions, network rules)
6. **Rotate keys periodically** (with migration strategy)
7. **Never log tokens** or encryption keys

---

## Performance Tips

### PostgreSQL
- Use connection pooling (max: 20-50)
- Create indexes on frequently queried columns
- Run VACUUM regularly
- Monitor slow queries

### Redis
- Set appropriate maxmemory
- Use LRU eviction policy
- Enable persistence (RDB + AOF)
- Monitor memory usage

### General
- Implement caching for frequently accessed tokens
- Use read replicas for high-traffic scenarios
- Monitor and alert on errors
- Implement retry logic with exponential backoff

---

## Additional Resources

- [TOKEN_STORE_SETUP.md](./TOKEN_STORE_SETUP.md) - Detailed setup instructions
- [schema.sql](./schema.sql) - PostgreSQL database schema
- [database-token-store.ts](./database-token-store.ts) - PostgreSQL implementation
- [redis-token-store.ts](./redis-token-store.ts) - Redis implementation

