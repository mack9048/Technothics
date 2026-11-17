import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In dev, /api is proxied to the local PHP server (php -S 127.0.0.1:8000 -t public public/index.php)
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
});
