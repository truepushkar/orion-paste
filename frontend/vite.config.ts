import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The built client is served by Flask from frontend/dist, so the dev server
// proxies the API and the raw route through to the same Flask process.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:5000',
      '/raw': 'http://127.0.0.1:5000',
      '/p': 'http://127.0.0.1:5000',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
