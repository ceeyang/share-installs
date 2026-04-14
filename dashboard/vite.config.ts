import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy API calls to the backend so cookies stay same-origin.
      // The browser sees everything as localhost:5173 → no cross-port cookie issues.
      //
      // OAuth flow:
      //   /auth/github           → backend → GitHub → backend callback (direct, port 6066)
      //                         → backend sets cookie, redirects to localhost:5173
      //   /dashboard/*           → backend (cookie forwarded by Vite)
      '/auth': {
        target: 'http://localhost:6066',
        changeOrigin: true,
      },
      '/dashboard': {
        target: 'http://localhost:6066',
        changeOrigin: true,
      },
    },
  },
})
