import { defineConfig } from 'vite'

export default defineConfig(({ command }) => ({
  // Use base path only for production builds (GitHub Pages)
  base: command === 'build' ? '/VmmTrackerDataSender/' : '/',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2020'
  },
  server: {
    port: 3000,
    open: true
  },
  test: {
    environment: 'node'
  }
}))
