import { defineConfig } from 'vite'

export default defineConfig({
  base: '/VmmTrackerDataSender/',
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2020'
  },
  server: {
    port: 3000,
    open: true
  }
})
