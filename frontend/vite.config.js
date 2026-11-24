import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Listen on all interfaces so the dev server is reachable from outside the container.
    host: true,
    port: 3000,
    strictPort: true,
    proxy: {
      // Forward /api calls to the backend service. "backend" is the Compose service
      // name, resolved by Docker's built-in DNS in the frontend-net network.
      '/api': process.env.API_URL || 'http://backend:3000',
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Bootstrap 5.3 still uses Sass @import and older built-ins; hide those warnings.
        quietDeps: true,
        silenceDeprecations: ['import'],
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
