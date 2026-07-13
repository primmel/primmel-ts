import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
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
