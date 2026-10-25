import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import Login from './Login.jsx'
import Ideas from './Ideas.jsx'
import Supplements from './Supplements.jsx'
import { VersionTag, UpdatePrompt } from './Version.jsx'

// 之後每個模組加落呢個表，手機底部分頁 / 闊畫面側邊欄會自動出現。
const MODULES = [
  { key: 'ideas', label: '想法', icon: '💡' },
  { key: 'supp', label: '保健品', icon: '💊' },
]

export default function App() {
  const [session, setSession] = useState(undefined)
  const [tab, setTab] = useState('ideas')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <div className="center muted">載入中…</div>
  if (!session) return <><Login /><UpdatePrompt /></>

  return (
    <div className="shell">
      <UpdatePrompt />
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
        {tab === 'ideas' && <Ideas />}
        {tab === 'supp' && <Supplements />}
        <VersionTag />
      </main>
    </div>
  )
}
