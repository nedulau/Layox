/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'src/domain/**/*.ts',
        'src/infra/**/*.ts',
        'src/store/**/*.ts',
        'src/services/**/*.ts',
        'src/utils/**/*.ts',
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/**/__tests__/**',
      ],
      thresholds: {
        statements: 75,
        branches: 65,
        lines: 75,
        'src/domain/projectSchema.ts': { lines: 90, branches: 90 },
        'src/utils/projectArchive.ts': { lines: 90, branches: 90 },
        'src/utils/recoveryRepository.ts': { lines: 90, branches: 90 },
        'src/services/saveCoordinator.ts': { lines: 90, branches: 90 },
      },
    },
  },
});
