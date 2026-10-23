import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import Login from './Login.jsx'

// 之後每個模組加落呢個表，手機底部分頁 / 闊畫面側邊欄會自動出現。
const MODULES = [
  { key: 'home', label: '首頁', icon: '⌂' },
]

export default function App() {
  const [session, setSession] = useState(undefined)
  const [tab, setTab] = useState('home')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <div className="center muted">載入中…</div>
  if (!session) return <Login />

  return (
    <div className="shell">
      <aside className="nav">
        <div className="brand">本家</div>
        {MODULES.map((m) => (
          <button key={m.key} className={'navbtn' + (tab === m.key ? ' on' : '')} onClick={() => setTab(m.key)}>
            <span className="ico">{m.icon}</span>
            <span>{m.label}</span>
          </button>
        ))}
        <button className="navbtn out" onClick={() => supabase.auth.signOut()}>
          <span className="ico">⎋</span>
          <span>登出</span>
        </button>
      </aside>
      <main className="main">
        <h1>首頁</h1>
        <p className="muted">已登入:{session.user.email}</p>
        <div className="card">網頁版骨架完成,功能模組稍後加入。</div>
      </main>
    </div>
  )
}
