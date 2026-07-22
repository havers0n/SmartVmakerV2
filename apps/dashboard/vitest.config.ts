import { defineConfig, configDefaults } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    // Discovery DB integration owns a serial runner; running it in the default
    // parallel suite races its lease/budget fixtures.
    exclude: [...configDefaults.exclude, 'e2e/**', 'tests/**', 'src/server/discovery-runs-*.integration.test.ts', 'src/features/content-formats/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.test.ts',
        '**/*.config.ts',
        '.next/',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
