import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import { cget, cset, cclear } from './cache.js'
import Login from './Login.jsx'
import Icon from './Icon.jsx'
import Ideas from './Ideas.jsx'
import Supplements from './Supplements.jsx'
import { VersionBadge, UpdatePrompt } from './Version.jsx'

// 之後每個模組加落呢個表，手機底部分頁 / 闊畫面側邊欄會自動出現。
const MODULES = [
  { key: 'ideas', label: '想法', icon: 'bulb' },
  { key: 'supp', label: '保健品', icon: 'pill' },
]

export default function App() {
  const [session, setSession] = useState(undefined)
  const [menu, setMenu] = useState(false)
  const [tab, setTab] = useState(() => {
    const t = cget('tab')
    return MODULES.some((m) => m.key === t) ? t : 'ideas'
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const go = (k) => { setTab(k); cset('tab', k); window.scrollTo(0, 0) }
  const logout = async () => { cclear(); setMenu(false); await supabase.auth.signOut() }

  if (session === undefined) return <div className="center muted">載入中…</div>
  if (!session) return <><Login /><div className="toprow fixed"><VersionBadge /></div><UpdatePrompt /></>

  return (
    <div className="shell">
      <UpdatePrompt />
      <nav className="nav">
        <div className="brand">本家</div>
        {MODULES.map((m) => (
          <button key={m.key} className={'navbtn' + (tab === m.key ? ' on' : '')} onClick={() => go(m.key)}>
            <Icon n={m.icon} />
            <span>{m.label}</span>
          </button>
        ))}
        <button className="navbtn out" onClick={() => setMenu(true)}>
          <Icon n="user" />
          <span>帳戶</span>
        </button>
      </nav>
      <main className="main">
        <div className="toprow">
          <VersionBadge />
          <button className="acct" onClick={() => setMenu(true)} aria-label="帳戶"><Icon n="user" /></button>
        </div>
        {tab === 'ideas' && <Ideas />}
        {tab === 'supp' && <Supplements />}
      </main>

      {menu && (
        <div className="backdrop upd" onMouseDown={(e) => e.target === e.currentTarget && setMenu(false)}>
          <div className="updbox">
            <div className="updico"><Icon n="user" /></div>
            <h2>帳戶</h2>
            <div className="email">{session.user.email}</div>
            <button className="danger" onClick={logout}>登出</button>
            <button className="ghost" onClick={() => setMenu(false)}>取消</button>
          </div>
        </div>
      )}
    </div>
  )
}
