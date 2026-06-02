import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In development, proxy /api to the backend so the dev server and the
// containerized/nginx setup share the same relative API base path.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_BACKEND || 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
