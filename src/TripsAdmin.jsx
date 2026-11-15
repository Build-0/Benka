import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import Hero from './Hero.jsx'
import { validateTrip, makeSlug } from './tripValidate.js'
import { TRIP_PROMPT } from './tripPrompt.js'
import './tripadmin.css'

const BASE = window.location.origin + window.location.pathname.replace(/[^/]*$/, '')
const shareUrl = (slug) => BASE + 't/' + slug + '/'
const previewUrl = (slug) => BASE + '#/t/' + slug
const SYNC_URL = 'https://fdnflasdjcnqldtyqkha.supabase.co/functions/v1/trip-sync'
const ACTION = { verified: '已完成並確認', dispatched: '已觸發部署', pending: '等緊確認', error: '出錯', in_sync: '已同步', skipped: '合併處理', rate_limited: '超過頻率上限', info: '資訊' }

// 行程管理(只有登入嘅主人用):貼 ChatGPT 嘅行程 JSON → 檢查 → 存草稿 / 發布 → 複製分享連結
export default function TripsAdmin() {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [text, setText] = useState('')
  const [res, setRes] = useState(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [sync, setSync] = useState(null) // { inSync, configured } | { error }
  const [logs, setLogs] = useState([])
  const [watch, setWatch] = useState(0) // 同步追蹤到幾時(ms 時間戳)

  const load = async () => {
    const { data, error } = await supabase.from('trips').select('slug,title,published,updated_at').order('updated_at', { ascending: false })
    if (error) setErr(error.message); else { setErr(''); setRows(data) }
  }
  useEffect(() => { load() }, [])

  // 分享預覽同步狀態:線上版本 hash 同最新行程資料 hash 一致 = 已同步(由 Edge Function trip-sync 判斷);紀錄只有你登入先睇到
  const loadSync = async () => {
    try {
      const r = await fetch(SYNC_URL + '?status=1')
      setSync(await r.json())
    } catch (e) { setSync({ error: e.message }) }
    const { data } = await supabase.from('deploy_log').select('created_at,action,detail').order('id', { ascending: false }).limit(6)
    setLogs(data || [])
  }
  useEffect(() => { loadSync() }, [])
  useEffect(() => {
    if (!watch || Date.now() > watch) return
    const t = setInterval(() => { loadSync(); if (Date.now() > watch) clearInterval(t) }, 10000)
    return () => clearInterval(t)
  }, [watch])
  const resync = async () => {
    try { await fetch(SYNC_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'admin:retry' }) }); setNote('已要求同步,通常 1–2 分鐘完成') } catch { setNote('未能連接同步服務') }
    setWatch(Date.now() + 5 * 60 * 1000)
    setTimeout(() => setNote(''), 4000)
    setTimeout(loadSync, 3000)
  }

  const copy = async (s, msg) => {
    try { await navigator.clipboard.writeText(s); setNote(msg || '已複製') } catch { setNote('複製唔到,請手動選取') }
    setTimeout(() => setNote(''), 2500)
  }

  const check = () => setRes(validateTrip(text))

  const save = async (publish) => {
    if (!res?.ok) return
    setBusy(true); setErr('')
    const slug = res.trip.slug || makeSlug(res.trip.title)
    const exists = (rows || []).some((r) => r.slug === slug)
    if (exists && !window.confirm(`已有行程「${slug}」,會用新內容覆蓋。確定?`)) { setBusy(false); return }
    const { error } = await supabase.from('trips').upsert(
      { slug, title: res.trip.title, data: res.trip.data, published: publish, updated_at: new Date().toISOString() },
      { onConflict: 'slug' },
    )
    setBusy(false)
    if (error) { setErr('儲存失敗:' + error.message); return }
    setText(''); setRes(null)
    setNote(publish ? `已發布 ${slug}` : `已存為草稿 ${slug}`)
    setTimeout(() => setNote(''), 4000)
    load()
    if (publish) { setWatch(Date.now() + 5 * 60 * 1000); setTimeout(loadSync, 4000) }
  }

  const toggle = async (r) => {
    const { error } = await supabase.from('trips').update({ published: !r.published, updated_at: new Date().toISOString() }).eq('slug', r.slug)
    if (error) setErr(error.message); else load()
  }

  const del = async (r) => {
    if (!window.confirm(`刪除行程「${r.title}」?刪除後唔可以復原。`)) return
    const { error } = await supabase.from('trips').delete().eq('slug', r.slug)
    if (error) setErr(error.message); else load()
  }

  return (
    <div className="tadm">
      <Hero title="行程" sub="旅遊行程分享頁" icon="plane" stats={[{ n: rows ? rows.filter((r) => r.published).length : '–', label: '已發布' }, { n: rows ? rows.filter((r) => !r.published).length : '–', label: '草稿' }]} />
      {err && <div className="tadm-err">{err}</div>}
      {note && <div className="tadm-note">{note}</div>}

      <section className="tadm-sec">
        <h2>我嘅行程</h2>
        {rows === null && <p className="muted">載入中…</p>}
        {rows && !rows.length && <p className="muted">仲未有行程。喺下面貼入 ChatGPT 產生嘅 JSON。</p>}
        {(rows || []).map((r) => (
          <div key={r.slug} className="tadm-row">
            <div className="tadm-t">
              <b>{r.title}</b>
              <span className={'tadm-chip' + (r.published ? ' on' : '')}>{r.published ? '已發布' : '草稿'}</span>
              <small>{r.slug} · {new Date(r.updated_at).toLocaleDateString('zh-HK')}</small>
            </div>
            <div className="tadm-b">
              <a href={previewUrl(r.slug)} target="_blank" rel="noopener noreferrer">預覽</a>
              <button type="button" onClick={() => copy(shareUrl(r.slug), '已複製分享連結')} disabled={!r.published}>複製分享連結</button>
              <button type="button" onClick={() => toggle(r)}>{r.published ? '取消發布' : '發布'}</button>
              <button type="button" className="del" onClick={() => del(r)}>刪除</button>
            </div>
          </div>
        ))}
        <p className="tadm-hint">行程內容即時更新。WhatsApp 預覽卡(封面、標題)同本站相片副本會自動重建,通常 1–2 分鐘。</p>
        <div className="tadm-sync">
          <div className="tadm-sync-h">
            <b>分享預覽</b>
            {!sync && <span className="tadm-chip">檢查中…</span>}
            {sync && sync.error && <span className="tadm-chip bad">未能檢查</span>}
            {sync && !sync.error && (sync.inSync ? <span className="tadm-chip on">已同步 ✓</span> : <span className="tadm-chip warn">同步中 / 未同步</span>)}
            <button type="button" onClick={resync}>重新同步</button>
          </div>
          {sync && sync.configured === false && <p className="tadm-bad">部署憑證(GH_TOKEN)未設定,預覽卡暫時唔會自動更新。</p>}
          {logs.length > 0 && (
            <details>
              <summary>同步紀錄({ACTION[logs[0].action] || logs[0].action})</summary>
              <ul>{logs.map((l, i) => <li key={i} className={l.action === 'error' ? 'bad' : ''}><span>{new Date(l.created_at).toLocaleString('zh-HK', { hour12: false })}</span> {ACTION[l.action] || l.action}:{l.detail}</li>)}</ul>
            </details>
          )}
        </div>
      </section>

      <section className="tadm-sec">
        <h2>匯入行程</h2>
        <p className="tadm-hint">1. 撳「複製 ChatGPT 指示」,貼去 ChatGPT,後面寫你嘅旅行需求。<br />2. 將 ChatGPT 輸出嘅 JSON 貼落下面,撳「檢查」。<br />3. 無錯誤就可以存草稿(預覽確認)或直接發布。</p>
        <button type="button" className="tadm-btn ghost" onClick={() => copy(TRIP_PROMPT, '已複製指示,去 ChatGPT 貼上')}>複製 ChatGPT 指示</button>
        <textarea value={text} onChange={(e) => { setText(e.target.value); setRes(null) }} placeholder='貼上行程 JSON,例如 { "slug": "…", "title": "…", "days": [ … ] }' rows={8} spellCheck={false} />
        <div className="tadm-actions">
          <button type="button" className="tadm-btn" onClick={check} disabled={!text.trim()}>檢查</button>
          <button type="button" className="tadm-btn" onClick={() => save(false)} disabled={!res?.ok || busy}>存為草稿</button>
          <button type="button" className="tadm-btn primary" onClick={() => save(true)} disabled={!res?.ok || busy}>存並發布</button>
        </div>
        {res && (
          <div className="tadm-res">
            {res.ok ? <p className="ok">格式通過 ✓ {res.trip.slug ? '' : '(會自動產生 slug)'}</p> : <p className="bad">有 {res.errors.length} 項錯誤,要先修正:</p>}
            {res.errors.length > 0 && <ul className="bad">{res.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
            {res.warnings.length > 0 && <><p className="warn">建議留意:</p><ul className="warn">{res.warnings.map((e, i) => <li key={i}>{e}</li>)}</ul></>}
          </div>
        )}
      </section>
    </div>
  )
}
