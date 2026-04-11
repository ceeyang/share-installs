/**
 * Jest global setup: inject test environment variables before any module is loaded.
 * This prevents the config module from throwing due to missing DATABASE_URL.
 */

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/share_installs_test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.MULTI_TENANT = 'false';
