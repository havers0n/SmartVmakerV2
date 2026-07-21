import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: { globals: true, environment: 'node', setupFiles: ['./src/test/setup.ts'], include: ['src/server/project-creation.integration.test.ts', 'src/app/api/actions/project-api.integration.test.ts'], fileParallelism: false },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
});
