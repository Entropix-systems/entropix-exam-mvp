import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(
    mode,
    fileURLToPath(new URL('../..', import.meta.url)),
    '',
  )
  const apiTarget = new URL(
    env.API_BASE_URL || `http://localhost:${env.API_PORT || '3000'}`,
  ).origin

  return {
    plugins: [react()],
    server: {
      port: Number(env.WEB_PORT || '5173'),
      proxy: {
        '/api': { target: apiTarget },
      },
    },
  }
})
