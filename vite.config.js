import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages compatibility: relative asset paths + HashRouter (see App.jsx).
// https://vitejs.dev/guide/build.html#public-base-path
export default defineConfig({
  plugins: [react()],
  base: './',
})
