import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Secrets live in the repo-root .env (one file for backend + frontend),
  // not in frontend/. Point Vite there so VITE_* vars are picked up. Only
  // VITE_-prefixed vars are ever injected into the client bundle, so the
  // service-role SUPABASE_KEY in the same file is NOT exposed to the browser.
  envDir: '..',
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
