/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/chinese-chess/',
  publicDir: 'assets/web',
  build: { target: 'es2020' },
  test: { environment: 'node', include: ['src/**/*.test.ts'], passWithNoTests: true },
});
