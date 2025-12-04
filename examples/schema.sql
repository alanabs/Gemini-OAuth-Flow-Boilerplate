-- PostgreSQL Schema for OAuth Token Storage
-- This schema supports the DatabaseTokenStore implementation

-- Create database (run as superuser)
-- CREATE DATABASE oauth_db;
-- \c oauth_db

-- Create oauth_tokens table
CREATE TABLE IF NOT EXISTS oauth_tokens (
  -- Primary key: Google user ID (sub claim from ID token)
  user_id VARCHAR(255) PRIMARY KEY,
  
  -- Encrypted tokens (AES-256-GCM encrypted, base64 encoded)
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  
  -- Token metadata
  expires_at TIMESTAMP NOT NULL,
  scope TEXT NOT NULL,
  token_type VARCHAR(50) NOT NULL DEFAULT 'Bearer',
  
  -- Audit timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires_at 
  ON oauth_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_updated_at 
  ON oauth_tokens(updated_at);

-- Add table and column comments for documentation
COMMENT ON TABLE oauth_tokens IS 
  'Stores encrypted OAuth 2.0 tokens for users. Tokens are encrypted using AES-256-GCM before storage.';

COMMENT ON COLUMN oauth_tokens.user_id IS 
  'Google user ID (sub claim from ID token). Unique identifier for the user.';

COMMENT ON COLUMN oauth_tokens.access_token IS 
  'Encrypted access token (AES-256-GCM). Used for API authentication. Typically expires in 1 hour.';

COMMENT ON COLUMN oauth_tokens.refresh_token IS 
  'Encrypted refresh token (AES-256-GCM). Used to obtain new access tokens. Long-lived credential.';

COMMENT ON COLUMN oauth_tokens.expires_at IS 
  'Timestamp when the access token expires. Used to determine when refresh is needed.';

COMMENT ON COLUMN oauth_tokens.scope IS 
  'OAuth scopes granted by the user. Space-separated list of scope URLs.';

COMMENT ON COLUMN oauth_tokens.token_type IS 
  'Token type, typically "Bearer" for OAuth 2.0.';

COMMENT ON COLUMN oauth_tokens.created_at IS 
  'Timestamp when the token record was first created.';

COMMENT ON COLUMN oauth_tokens.updated_at IS 
  'Timestamp when the token record was last updated (e.g., after token refresh).';

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on row updates
DROP TRIGGER IF EXISTS update_oauth_tokens_updated_at ON oauth_tokens;
CREATE TRIGGER update_oauth_tokens_updated_at
  BEFORE UPDATE ON oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired tokens
-- Removes tokens that expired more than 30 days ago
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM oauth_tokens
  WHERE expires_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log the cleanup
  RAISE NOTICE 'Cleaned up % expired token records', deleted_count;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Optional: Schedule automatic cleanup (requires pg_cron extension)
-- To enable pg_cron:
-- 1. Install: CREATE EXTENSION pg_cron;
-- 2. Add to postgresql.conf: shared_preload_libraries = 'pg_cron'
-- 3. Restart PostgreSQL
-- 4. Run the following command:

-- SELECT cron.schedule(
--   'cleanup-expired-tokens',
--   '0 2 * * *',  -- Run daily at 2 AM
--   'SELECT cleanup_expired_tokens()'
-- );

-- Grant permissions (adjust role name as needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON oauth_tokens TO your_app_user;

-- Example queries for monitoring and maintenance

-- View all tokens (without decrypting)
-- SELECT user_id, expires_at, scope, created_at, updated_at 
-- FROM oauth_tokens 
-- ORDER BY updated_at DESC;

-- Count total tokens
-- SELECT COUNT(*) as total_tokens FROM oauth_tokens;

-- Count expired tokens
-- SELECT COUNT(*) as expired_tokens 
-- FROM oauth_tokens 
-- WHERE expires_at < NOW();

-- Find tokens expiring soon (within 1 hour)
-- SELECT user_id, expires_at 
-- FROM oauth_tokens 
-- WHERE expires_at < NOW() + INTERVAL '1 hour' 
--   AND expires_at > NOW();

-- Table size
-- SELECT pg_size_pretty(pg_total_relation_size('oauth_tokens')) as table_size;

-- Index usage statistics
-- SELECT 
--   schemaname,
--   tablename,
--   indexname,
--   idx_scan as index_scans,
--   idx_tup_read as tuples_read,
--   idx_tup_fetch as tuples_fetched
-- FROM pg_stat_user_indexes
-- WHERE tablename = 'oauth_tokens';
