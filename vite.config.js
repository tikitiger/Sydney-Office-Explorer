import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: '/Sydney-Office-Explorer/',
  plugins: [react()],
  resolve: {
    alias: {
      app: path.resolve(__dirname, 'src'),
    },
  },
})
