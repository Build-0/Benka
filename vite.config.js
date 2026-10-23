import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 相對路徑：GitHub Pages 子路徑（/benka-web/）也能正常載入
export default defineConfig({
  plugins: [react()],
  base: './',
})
