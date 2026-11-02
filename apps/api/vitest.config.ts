import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000, // first run downloads a MongoDB binary for mongodb-memory-server
    fileParallelism: false,
  },
});
