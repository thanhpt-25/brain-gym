// Global Jest setup for e2e tests
// Sets environment variables needed by NestJS modules

process.env.LLM_KEY_ENCRYPTION_SECRET =
  process.env.LLM_KEY_ENCRYPTION_SECRET ||
  'testsecret_must_be_32_chars_long_exactly';
