import { useState } from 'react'
import { supabase } from './supabase.js'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setErr('登入失敗:' + error.message)
    setBusy(false)
  }

  return (
    <div className="center">
      <form className="card login" onSubmit={submit}>
        <h1>本家</h1>
        <input type="email" placeholder="電郵" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        <input type="password" placeholder="密碼" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        {err && <div className="err">{err}</div>}
        <button className="primary" disabled={busy}>{busy ? '登入中…' : '登入'}</button>
      </form>
    </div>
  )
}
