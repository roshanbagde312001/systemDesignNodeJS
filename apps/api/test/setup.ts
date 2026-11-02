// Test environment: must be set before any app module reads process.env.
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-secret-that-is-definitely-longer-than-32-chars';
process.env.LOGIN_RATE_LIMIT_PER_15_MIN = '5';
process.env.RATE_LIMIT_PER_MINUTE = '10000';
process.env.ADMIN_EMAIL = 'admin@test.dev';
process.env.ADMIN_PASSWORD = 'correct-horse-battery';
