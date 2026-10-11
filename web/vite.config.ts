/// <reference types="vitest/config" />
import { federation } from '@module-federation/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Local dev proxies runtime config and deployed remotes from the sandbox shell, so the host can be
// developed against real remotes. Point a single remote at localhost via ?remote:<name>=<url>.
const SANDBOX = 'https://app.sandbox.nakomis.com';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'shell',
      // Remotes are registered at runtime from /config/remotes.json.
      remotes: {},
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true },
      },
      dts: false,
    }),
  ],
  build: { target: 'es2022' },
  server: {
    port: 5173,
    proxy: {
      '/config': { target: SANDBOX, changeOrigin: true },
      '/remotes': { target: SANDBOX, changeOrigin: true },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/vite-env.d.ts'],
      thresholds: { lines: 70 },
    },
  },
});
