# Token Store Implementation Guide

This guide provides detailed instructions for implementing production-ready token storage using PostgreSQL or Redis.

## Table of Contents

- [Overview](#overview)
- [PostgreSQL Setup](#postgresql-setup)
- [Redis Setup](#redis-setup)
- [Security Best Practices](#security-best-practices)
- [Performance Considerations](#performance-considerations)
- [Troubleshooting](#troubleshooting)

## Overview

The boilerplate provides three token store implementations:

1. **InMemoryTokenStore** - For development and testing (data lost on restart)
2. **DatabaseTokenStore** - For production with PostgreSQL (persistent, ACID compliant)
3. **RedisTokenStore** - For production with Redis (high-performance, distributed)

### Choosing a Token Store

| Feature | In-Memory | PostgreSQL | Redis |
|---------|-----------|------------|-------|
| Persistence | ❌ No | ✅ Yes | ✅ Yes |
| Distributed | ❌ No | ✅ Yes | ✅ Yes |
| Performance | ⚡ Fastest | 🐢 Moderate | ⚡ Fast |
| Complexity | 🟢 Simple | 🟡 Moderate | 🟡 Moderate |
| Best For | Development | Traditional apps | High-traffic apps |

## PostgreSQL Setup

### Prerequisites

- PostgreSQL 12 or higher
- Node.js pg driver

### Step 1: Install Dependencies

```bash
npm install pg
npm install --save-dev @types/pg
```

### Step 2: Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE oauth_db;

# Connect to the database
\c oauth_db
```

### Step 3: Create Schema

Run the following SQL to create the required table:

```sql
-- Create oauth_tokens table
CREATE TABLE oauth_tokens (
  user_id VARCHAR(255) PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  scope TEXT NOT NULL,
  token_type VARCHAR(50) NOT NULL DEFAULT 'Bearer',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index on expires_at for cleanup queries
CREATE INDEX idx_oauth_tokens_expires_at ON oauth_tokens(expires_at);

-- Create index on updated_at for monitoring
CREATE INDEX idx_oauth_tokens_updated_at ON oauth_tokens(updated_at);

-- Add comment for documentation
COMMENT ON TABLE oauth_tokens IS 'Stores encrypted OAuth tokens for users';
COMMENT ON COLUMN oauth_tokens.access_token IS 'Encrypted access token (AES-256-GCM)';
COMMENT ON COLUMN oauth_tokens.refresh_token IS 'Encrypted refresh token (AES-256-GCM)';
```

### Step 4: Create Cleanup Function (Optional)

To automatically remove expired tokens:

```sql
-- Function to delete expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM oauth_tokens
  WHERE expires_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job (requires pg_cron extension)
-- Run cleanup daily at 2 AM
SELECT cron.schedule('cleanup-expired-tokens', '0 2 * * *', 'SELECT cleanup_expired_tokens()');
```

### Step 5: Configure Environment Variables

Add to your `.env` file:

```bash
# PostgreSQL Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=oauth_db
DB_USER=postgres
DB_PASSWORD=your_password

# Encryption key (32 bytes, base64 encoded)
ENCRYPTION_KEY=your_base64_encoded_key
```

Generate encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Step 6: Use in Your Application

```typescript
import { DatabaseTokenStore } from './examples/database-token-store';
import { GoogleOAuthClient } from './src/oauth-client';

// Initialize token store
const tokenStore = new DatabaseTokenStore(
  {
    host: process.env.DB_HOST!,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    max: 20, // Connection pool size
  },
  process.env.ENCRYPTION_KEY!
);

// Use with OAuth client
const client = new GoogleOAuthClient({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI!,
  scopes: ['https://www.googleapis.com/auth/generative-language'],
  tokenStore,
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await tokenStore.close();
  process.exit(0);
});
```

### PostgreSQL Backup and Recovery

**Backup:**

```bash
# Backup entire database
pg_dump -U postgres oauth_db > oauth_db_backup.sql

# Backup only oauth_tokens table
pg_dump -U postgres -t oauth_tokens oauth_db > oauth_tokens_backup.sql
```

**Restore:**

```bash
# Restore database
psql -U postgres oauth_db < oauth_db_backup.sql

# Restore table
psql -U postgres oauth_db < oauth_tokens_backup.sql
```

## Redis Setup

### Prerequisites

- Redis 6.0 or higher
- Node.js redis driver

### Step 1: Install Dependencies

```bash
npm install redis
```

### Step 2: Install Redis

**macOS (Homebrew):**

```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**

```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

**Docker:**

```bash
docker run -d \
  --name redis \
  -p 6379:6379 \
  redis:7-alpine
```

### Step 3: Configure Redis (Optional)

Edit `/etc/redis/redis.conf` or create a custom config:

```conf
# Bind to localhost (or specific IP)
bind 127.0.0.1

# Set password
requirepass your_strong_password

# Enable persistence
save 900 1
save 300 10
save 60 10000

# Set max memory and eviction policy
maxmemory 256mb
maxmemory-policy allkeys-lru

# Enable AOF for durability
appendonly yes
appendfsync everysec
```

Restart Redis after configuration changes:

```bash
sudo systemctl restart redis-server
```

### Step 4: Configure Environment Variables

Add to your `.env` file:

```bash
# Redis Configuration (Option 1: URL)
REDIS_URL=redis://localhost:6379

# Redis Configuration (Option 2: Individual parameters)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_DATABASE=0

# Encryption key (32 bytes, base64 encoded)
ENCRYPTION_KEY=your_base64_encoded_key
```

### Step 5: Use in Your Application

```typescript
import { RedisTokenStore } from './examples/redis-token-store';
import { GoogleOAuthClient } from './src/oauth-client';

// Initialize token store
const tokenStore = new RedisTokenStore(
  {
    url: process.env.REDIS_URL,
    // Or use individual parameters:
    // host: process.env.REDIS_HOST,
    // port: parseInt(process.env.REDIS_PORT || '6379'),
    // password: process.env.REDIS_PASSWORD,
  },
  process.env.ENCRYPTION_KEY!,
  'myapp:oauth:' // Custom key prefix
);

// Connect to Redis
await tokenStore.connect();

// Use with OAuth client
const client = new GoogleOAuthClient({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI!,
  scopes: ['https://www.googleapis.com/auth/generative-language'],
  tokenStore,
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await tokenStore.close();
  process.exit(0);
});
```

### Redis Monitoring

**Check Redis status:**

```bash
redis-cli ping
# Should return: PONG
```

**Monitor keys:**

```bash
redis-cli
> KEYS oauth:tokens:*
> TTL oauth:tokens:user123
> GET oauth:tokens:user123
```

**Monitor performance:**

```bash
redis-cli --stat
redis-cli --latency
```

### Redis Backup and Recovery

**Backup (RDB):**

```bash
# Trigger immediate backup
redis-cli BGSAVE

# Backup file location
cp /var/lib/redis/dump.rdb /backup/dump.rdb
```

**Backup (AOF):**

```bash
# Trigger AOF rewrite
redis-cli BGREWRITEAOF

# Backup AOF file
cp /var/lib/redis/appendonly.aof /backup/appendonly.aof
```

**Restore:**

```bash
# Stop Redis
sudo systemctl stop redis-server

# Copy backup file
cp /backup/dump.rdb /var/lib/redis/dump.rdb

# Start Redis
sudo systemctl start redis-server
```

## Security Best Practices

### Encryption Keys

1. **Generate Strong Keys**

```bash
# Generate 32-byte key for AES-256
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

2. **Store Keys Securely**

- Use environment variables (never commit to git)
- Use secret management services (AWS Secrets Manager, HashiCorp Vault)
- Rotate keys periodically

3. **Key Rotation**

```typescript
// Example key rotation strategy
async function rotateEncryptionKey(
  oldStore: TokenStore,
  newStore: TokenStore,
  userIds: string[]
) {
  for (const userId of userIds) {
    const tokens = await oldStore.getTokens(userId);
    if (tokens) {
      await newStore.saveTokens(userId, tokens);
    }
  }
}
```

### Database Security

**PostgreSQL:**

1. Use SSL/TLS connections
2. Restrict network access (firewall rules)
3. Use strong passwords
4. Enable audit logging
5. Regular security updates

```typescript
// Enable SSL in connection
const tokenStore = new DatabaseTokenStore(
  {
    host: process.env.DB_HOST!,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    ssl: {
      rejectUnauthorized: true,
      ca: fs.readFileSync('/path/to/ca-cert.pem').toString(),
    },
  },
  process.env.ENCRYPTION_KEY!
);
```

**Redis:**

1. Enable password authentication
2. Use TLS for connections
3. Bind to specific interfaces
4. Disable dangerous commands
5. Use Redis ACLs (Redis 6+)

```bash
# Redis ACL example
ACL SETUSER oauth_app on >strong_password ~oauth:tokens:* +get +set +del +exists
```

### Network Security

1. **Use Private Networks**
   - Keep databases in private subnets
   - Use VPC/VPN for access

2. **Firewall Rules**
   - Allow only necessary ports
   - Whitelist application servers

3. **Connection Encryption**
   - Always use TLS/SSL in production
   - Verify certificates

## Performance Considerations

### PostgreSQL Optimization

1. **Connection Pooling**

```typescript
const tokenStore = new DatabaseTokenStore(
  {
    // ... other config
    max: 20, // Maximum connections
    idleTimeoutMillis: 30000, // Close idle connections after 30s
    connectionTimeoutMillis: 2000, // Connection timeout
  },
  encryptionKey
);
```

2. **Indexes**

```sql
-- Already created in schema
CREATE INDEX idx_oauth_tokens_expires_at ON oauth_tokens(expires_at);
CREATE INDEX idx_oauth_tokens_updated_at ON oauth_tokens(updated_at);
```

3. **Query Optimization**

```sql
-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM oauth_tokens WHERE user_id = 'user123';

-- Update statistics
ANALYZE oauth_tokens;
```

4. **Regular Maintenance**

```sql
-- Vacuum to reclaim space
VACUUM ANALYZE oauth_tokens;

-- Reindex if needed
REINDEX TABLE oauth_tokens;
```

### Redis Optimization

1. **Memory Management**

```conf
# Set appropriate max memory
maxmemory 256mb

# Use LRU eviction
maxmemory-policy allkeys-lru
```

2. **Persistence Strategy**

```conf
# For durability: Enable both RDB and AOF
save 900 1
appendonly yes
appendfsync everysec

# For performance: RDB only
save 900 1
appendonly no
```

3. **Key Expiration**

Tokens automatically expire in Redis (set in `saveTokens` method).

4. **Connection Pooling**

Redis client handles connection pooling automatically.

### Monitoring

**PostgreSQL:**

```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity;

-- Slow queries
SELECT query, mean_exec_time 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- Table size
SELECT pg_size_pretty(pg_total_relation_size('oauth_tokens'));
```

**Redis:**

```bash
# Memory usage
redis-cli INFO memory

# Key statistics
redis-cli INFO keyspace

# Performance metrics
redis-cli INFO stats
```

## Troubleshooting

### PostgreSQL Issues

**Connection Refused:**

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check port
sudo netstat -plnt | grep 5432

# Check pg_hba.conf for access rules
sudo cat /etc/postgresql/*/main/pg_hba.conf
```

**Slow Queries:**

```sql
-- Enable slow query logging
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries > 1s
SELECT pg_reload_conf();

-- Check logs
tail -f /var/log/postgresql/postgresql-*.log
```

**Encryption Errors:**

- Verify encryption key is exactly 32 bytes
- Check key is base64 encoded correctly
- Ensure key hasn't changed (would make existing data unreadable)

### Redis Issues

**Connection Refused:**

```bash
# Check if Redis is running
sudo systemctl status redis-server

# Check port
sudo netstat -plnt | grep 6379

# Test connection
redis-cli ping
```

**Authentication Failed:**

```bash
# Connect with password
redis-cli -a your_password

# Or set password in environment
export REDISCLI_AUTH=your_password
redis-cli
```

**Memory Issues:**

```bash
# Check memory usage
redis-cli INFO memory

# Clear all keys (CAUTION: destructive)
redis-cli FLUSHDB

# Set max memory
redis-cli CONFIG SET maxmemory 256mb
```

**Data Loss:**

- Check persistence configuration (RDB/AOF)
- Verify backup files exist
- Check disk space
- Review Redis logs

### General Issues

**Tokens Not Persisting:**

1. Check database/Redis connection
2. Verify encryption key is correct
3. Check error logs
4. Test with simple save/get operation

**Performance Degradation:**

1. Monitor connection pool usage
2. Check for slow queries
3. Review indexes
4. Monitor memory usage
5. Check network latency

**Security Concerns:**

1. Rotate encryption keys
2. Update database passwords
3. Review access logs
4. Check for unauthorized access
5. Update dependencies

## Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)
- [Node.js pg Driver](https://node-postgres.com/)
- [Node.js redis Driver](https://github.com/redis/node-redis)
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)

