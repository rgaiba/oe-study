import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the bundle works both at the github.io subpath URL
// (https://username.github.io/oe-study/) and at the custom-domain root
// (https://oe.rahulgaibamd.com). Asset URLs resolve relative to the document.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
  server: {
    port: 5174,
    open: false,
  },
})
