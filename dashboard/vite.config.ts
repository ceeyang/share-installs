import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [vue(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    server: {
      port: 5173,
      proxy: {
        // Forward all /api/* requests to the backend so cookies stay same-origin.
        // Client baseURLs already include /api, so no path rewriting is needed.
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://localhost:6066',
          changeOrigin: true,
        },
      },
    },
  }
})
