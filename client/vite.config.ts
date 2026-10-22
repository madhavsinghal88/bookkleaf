import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development, /api requests are proxied to the Express server so the
// client never needs to know the API's origin and we avoid CORS issues.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
