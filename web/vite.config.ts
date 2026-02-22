import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig(({ command }) => ({
  // Use base path only for production builds (GitHub Pages)
  base: command === 'build' ? '/VmmTrackerDataSender/' : '/',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2020',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        licenses: resolve(__dirname, 'licenses.html'),
        'privacy-policy': resolve(__dirname, 'privacy-policy.html'),
      },
    },
  },
  server: {
    port: 3000,
    open: true
  },
  test: {
    environment: 'node'
  }
}))
