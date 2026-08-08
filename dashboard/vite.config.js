import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: '/dashboard/' matches where src/index.js serves the built app
// from in production. The dev-server proxy means `npm run dev` here
// talks to the real backend on :3000 without needing CORS config —
// `/api/*` requests from the Vite dev server are forwarded there.
export default defineConfig({
  plugins: [react()],
  base: '/dashboard/',
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
