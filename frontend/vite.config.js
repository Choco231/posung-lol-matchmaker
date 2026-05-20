import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: ['mandate-move-stiffly.ngrok-free.dev', 'localhost'], // ngrok 접속 허용
    proxy: {
      '/api': process.env.USE_DOCKER === 'true' ? 'http://backend:8000' : 'http://127.0.0.1:8000'
    }
  }
})
