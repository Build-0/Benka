import { useEffect, useState } from 'react'

const CHECK_MS = 15 * 1000

// 版本號:建置日期 + 時間(香港時間)
export const BUILD = __BUILD__

// 右上角常駐版本標籤,任何頁面都見到
export function VersionBadge() {
  return <div className="verbadge" title="目前版本(建置時間)">版本 {BUILD}</div>
}

// 每 15 秒、切返嚟呢頁、網絡恢復時檢查 version.json;有新版本就置中彈出
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
    window.addEventListener('online', check)
    window.addEventListener('focus', check)
    return () => {
      stop = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('online', check)
      window.removeEventListener('focus', check)
    }
  }, [])

  if (!next) return null
  const update = () => { window.location.href = window.location.pathname + '?v=' + encodeURIComponent(next) }

  return (
    <div className="backdrop upd" role="alertdialog" aria-modal="true">
      <div className="updbox">
        <div className="updico">⟳</div>
        <h2>有新版本</h2>
        <div className="vrow"><span className="muted">目前</span><b>{BUILD}</b></div>
        <div className="vrow"><span className="muted">最新</span><b className="new">{next}</b></div>
        <button className="primary" onClick={update}>立即更新</button>
        <button className="ghost" onClick={() => setNext('')}>稍後</button>
      </div>
    </div>
  )
}
