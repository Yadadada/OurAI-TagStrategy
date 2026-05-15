import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: '@coursework/shared-fixtures/questionnaire',
        replacement: resolve(__dirname, '../../shared-fixtures/src/questionnaire.ts'),
      },
      {
        find: '@coursework/shared-fixtures',
        replacement: resolve(__dirname, '../../shared-fixtures/src/index.ts'),
      },
      // Browser bundle stubs Node-only modules pulled in by the vendored personaCard.ts
      {
        find: 'express',
        replacement: resolve(__dirname, 'src/stubs/express-browser.ts'),
      },
    ],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3010',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist/web',
    emptyOutDir: true,
  },
  // Browser shim — vendored personaCard.ts reads process.env at module load
  // for production-side config (model id, review token, Qwen API key). None
  // of those run in the browser code path, but JS still evaluates the
  // top-level expression, so we hand it an empty object instead of letting
  // it ReferenceError on `process is not defined`.
  define: {
    'process.env': JSON.stringify({}),
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.platform': JSON.stringify('browser'),
  },
});
