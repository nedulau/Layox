/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/components/**/__tests__/*.{test,spec}.{ts,tsx}', 'src/hooks/**/__tests__/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage/ui',
      include: ['src/App.tsx', 'src/components/**/*.tsx', 'src/hooks/**/*.ts'],
      // V8 cannot remap the virtual PWA module import when collecting an uncovered file.
      exclude: ['src/**/__tests__/**', 'src/components/PwaUpdatePrompt.tsx'],
      thresholds: { statements: 10, branches: 8, functions: 7, lines: 10 },
    },
  },
});
