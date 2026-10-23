import { useEffect, useState } from 'react'

const CHECK_MS = 60 * 1000

// 版本號:建置日期 + 時間(香港時間)
export const BUILD = __BUILD__

export function VersionTag() {
  return <div className="ver">版本 {BUILD}</div>
}

// 每分鐘及切返嚟呢頁時檢查 version.json;有新版本就彈出提示
export function UpdatePrompt() {
  const [next, setNext] = useState('')

  useEffect(() => {
    let stop = false
    const check = async () => {
      try {
        const r = await fetch('./version.json?t=' + Date.now(), { cache: 'no-store' })
        if (!r.ok) return
        const { build } = await r.json()
        if (!stop && build && build !== BUILD) setNext(build)
      } catch { /* 開發模式或離線:略過 */ }
    }
    check()
    const id = setInterval(check, CHECK_MS)
    const onVis = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVis)
    return () => { stop = true; clearInterval(id); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  if (!next) return null
  const update = () => { window.location.href = window.location.pathname + '?v=' + encodeURIComponent(next) }

  return (
    <div className="update" role="alert">
      <div>
        <strong>有新版本</strong>
        <div className="muted">目前 {BUILD} → 最新 {next}</div>
      </div>
      <button className="primary" onClick={update}>立即更新</button>
      <button className="ghost" onClick={() => setNext('')}>稍後</button>
    </div>
  )
}
