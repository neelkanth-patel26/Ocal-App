import { defineConfig } from 'vite';
import { createOcalProxyPlugin } from './src/server/proxy.js';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  plugins: [
    createOcalProxyPlugin()
  ],
  server: {
    port: 5173,
    host: true,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'esnext'
  }
});
