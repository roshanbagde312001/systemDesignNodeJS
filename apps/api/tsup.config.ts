import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { server: 'src/server.ts', seed: 'src/seed/seed.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  clean: true,
  // Bundle the workspace packages (they ship TypeScript source); keep npm deps external.
  noExternal: [/^@sda\//],
});
