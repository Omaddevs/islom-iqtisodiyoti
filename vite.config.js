import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Backend (Next.js + WebSocket) manzili — backend/.env dagi PORT bilan bir xil
const BACKEND = process.env.BACKEND_URL || 'http://localhost:4020'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 2026,
    strictPort: true,
    open: true,
    // /api va /ws bir xil origin orqali — httpOnly cookie va WebSocket CORS'siz ishlaydi
    proxy: {
      '/api': { target: BACKEND, changeOrigin: false },
      '/ws': { target: BACKEND.replace(/^http/, 'ws'), ws: true, changeOrigin: false },
    },
  },
})
