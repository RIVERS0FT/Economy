import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/economy/',
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    proxy: {
      '/economy-api/game': {
        target: 'http://127.0.0.1:3002',
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/economy-api\/game/, '/api/game'),
      },
      '/economy-api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/economy-api/, '/api'),
      },
    },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
