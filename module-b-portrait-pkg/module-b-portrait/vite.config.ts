import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: '@coursework/shared-fixtures/questionnaire',
        replacement: resolve(__dirname, '../shared-fixtures/src/questionnaire.ts'),
      },
      {
        find: '@coursework/shared-fixtures',
        replacement: resolve(__dirname, '../shared-fixtures/src/index.ts'),
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
});
