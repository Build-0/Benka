import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 建置時間戳(香港時間 YYYY-MM-DD HH:mm),用作版本號顯示 + 偵測新版本
const p = Object.fromEntries(
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date()).map((x) => [x.type, x.value]),
)
const BUILD = `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`

// 另外輸出 version.json,讓已開啟嘅頁面偵測到新版本並彈出更新提示
const versionFile = {
  name: 'version-file',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD }) })
  },
}

// 相對路徑:GitHub Pages 子路徑(/Benka/)也能正常載入
export default defineConfig({
  plugins: [react(), versionFile],
  define: { __BUILD__: JSON.stringify(BUILD) },
  base: './',
})
