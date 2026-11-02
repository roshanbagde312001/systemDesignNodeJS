import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        // Split heavy vendor libraries into long-cacheable chunks so the first page loads fast.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react';
          if (id.includes('@mui') || id.includes('@emotion')) return 'mui';
          if (id.includes('@xyflow') || /[\\/]d3-/.test(id)) return 'flow';
          if (/react-markdown|remark|rehype|micromark|mdast|hast|unified|prism-react-renderer/.test(id)) return 'markdown';
          return undefined;
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
