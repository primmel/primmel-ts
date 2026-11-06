import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    // The browser bundle's node-builtin shims: vite's default stub is a
    // no-op exports object, and module scopes that touch node:path (the
    // locators plane) crashed the whole bundle at import. See
    // packages/primmel/src/browser-shims.ts.
    alias: [
      { find: 'node:path', replacement: resolve(__dirname, 'packages/primmel/src/browser-shims.ts') },
      { find: 'node:fs', replacement: resolve(__dirname, 'packages/primmel/src/browser-shims.ts') },
      { find: 'path', replacement: resolve(__dirname, 'packages/primmel/src/browser-shims.ts') },
      { find: 'fs', replacement: resolve(__dirname, 'packages/primmel/src/browser-shims.ts') },
    ],
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'packages/primmel/src/ser-des/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    outDir: resolve(__dirname, 'packages/primmel/dist-browser'),
    emptyOutDir: true,
    rollupOptions: {
      external: [],
    },
  },
});
