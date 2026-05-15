import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['contracts/**/*.test.ts', 'tests/**/*.test.ts'],
  },
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
});
