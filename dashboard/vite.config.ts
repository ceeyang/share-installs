import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load ALL env vars (no prefix filter) so we can read PADDLE_* without VITE_ prefix.
  const env = loadEnv(mode, process.cwd(), '')

  // Build-time constants injected into import.meta.env.*
  // This lets frontend code use PADDLE_* directly without requiring VITE_ prefix,
  // keeping the root .env as the single source of truth for all services.
  const paddleDefines: Record<string, string> = {
    'import.meta.env.PADDLE_ENV':                     JSON.stringify(env.PADDLE_ENV || 'sandbox'),
    'import.meta.env.PADDLE_CLIENT_TOKEN':            JSON.stringify(env.PADDLE_CLIENT_TOKEN || ''),
    'import.meta.env.PADDLE_PRICE_PRO_MONTHLY':       JSON.stringify(env.PADDLE_PRICE_PRO_MONTHLY || ''),
    'import.meta.env.PADDLE_PRICE_PRO_YEARLY':        JSON.stringify(env.PADDLE_PRICE_PRO_YEARLY || ''),
    'import.meta.env.PADDLE_PRICE_UNLIMITED_MONTHLY': JSON.stringify(env.PADDLE_PRICE_UNLIMITED_MONTHLY || ''),
    'import.meta.env.PADDLE_PRICE_UNLIMITED_YEARLY':  JSON.stringify(env.PADDLE_PRICE_UNLIMITED_YEARLY || ''),
  }

  return {
    plugins: [vue(), tailwindcss()],
    define: paddleDefines,
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
          target: env.VITE_API_PROXY_TARGET || env.API_PROXY_TARGET || 'http://localhost:6066',
          changeOrigin: true,
        },
      },
    },
  }
})
