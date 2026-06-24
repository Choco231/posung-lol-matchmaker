import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: ['posung-lol-match.win', 'www.posung-lol-match.win', 'localhost', '52.78.57.73'],
    proxy: {
      '/api': {
        target: process.env.USE_DOCKER === 'true' ? 'http://backend:8000' : 'http://127.0.0.1:8000',
        changeOrigin: true,
        ws: true
      }
    }
  }
})
