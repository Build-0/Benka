import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase.js'
import { cget, cset } from './cache.js'
import Icon from './Icon.jsx'

const PALETTE = ['#3f7fbf', '#2f9e9a', '#6a58a8', '#5a6fc0', '#4a8fa8', '#6b9bd1']
const NO_TAG = '#8da2b8'
const colorOf = (tag) => {
  if (!tag) return NO_TAG
  let h = 0
  for (const ch of tag) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}
const fmt = (s) => {
  const d = new Date(s)
  return `${d.getDate()}/${d.getMonth() + 1}`
}

export default function Ideas() {
  const [rows, setRows] = useState(() => cget('ideas'))
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [tag, setTag] = useState('')
  const [view, setView] = useState(() => cget('ideas-view') || 'grid')
  const [editing, setEditing] = useState(null) // null = 關閉;{} = 新增;row = 編輯

  const load = async () => {
    const { data, error } = await supabase
      .from('ideas')
      .select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) { setErr(error.message); setRows((r) => r || []) } else { setErr(''); setRows(data); cset('ideas', data) }
  }
  useEffect(() => { load() }, [])

  const pickView = (v) => { setView(v); cset('ideas-view', v) }

  const allTags = useMemo(() => {
    const n = {}
    ;(rows || []).forEach((r) => r.tags.forEach((t) => { n[t] = (n[t] || 0) + 1 }))
    return Object.entries(n).sort((a, b) => b[1] - a[1]).map(([t]) => t)
  }, [rows])

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase()
    return (rows || []).filter((r) => {
      if (tag && !r.tags.includes(tag)) return false
      if (!k) return true
      return (r.title + ' ' + (r.content || '') + ' ' + r.tags.join(' ')).toLowerCase().includes(k)
    })
  }, [rows, q, tag])

  return (
    <>
      <div className="head">
        <div>
          <h1>想法百寶箱</h1>
          <div className="muted">{rows ? `共 ${rows.length} 個想法${shown.length !== rows.length ? ` · 顯示 ${shown.length}` : ''}` : '載入中…'}</div>
        </div>
        <button className="primary add" onClick={() => setEditing({})}><Icon n="plus" />新增</button>
      </div>

      {err && (
        <div className="card errbox">
          讀取失敗:{err}
          {/relation|schema cache|does not exist/i.test(err) && (
            <div className="muted">ideas 表未建立,請先喺 Supabase SQL Editor 執行 supabase/01_ideas.sql。</div>
          )}
        </div>
      )}

      <div className="tools">
        <input className="search" type="search" placeholder="搜尋標題、內容、標籤…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="tog" role="group" aria-label="檢視方式">
          <button className={view === 'grid' ? 'on' : ''} onClick={() => pickView('grid')} aria-label="卡片檢視"><Icon n="layout-grid" /></button>
          <button className={view === 'list' ? 'on' : ''} onClick={() => pickView('list')} aria-label="列表檢視"><Icon n="list" /></button>
        </div>
      </div>

      {allTags.length > 0 && (
        <div className="chips">
          <button className={'chip' + (!tag ? ' on' : '')} onClick={() => setTag('')}>全部</button>
          {allTags.map((t) => (
            <button key={t} className={'chip' + (tag === t ? ' on' : '')} onClick={() => setTag(tag === t ? '' : t)}>{t}</button>
          ))}
        </div>
      )}

      {rows && shown.length === 0 && !err && (
        <div className="empty muted">{rows.length === 0 ? '未有想法,撳右下角「＋」記低第一個。' : '搵唔到符合嘅想法。'}</div>
      )}

      <div className={'grid' + (view === 'list' ? ' list' : '')}>
        {shown.map((r) => (
          <article key={r.id} className="idea" style={{ '--c': colorOf(r.tags[0]) }} onClick={() => setEditing(r)}>
            <div className="stripe" />
            <div className="ib">
              <h3>{r.title}</h3>
              {r.content && <p>{r.content}</p>}
              <div className="ft">
                <span className="tg">{r.tags[0] || ''}{r.tags.length > 1 ? ` +${r.tags.length - 1}` : ''}</span>
                <span>{fmt(r.created_at)}</span>
                {r.pinned && <Icon n="pin" className="pin" />}
              </div>
            </div>
          </article>
        ))}
      </div>

      <button className="fab" onClick={() => setEditing({})} aria-label="新增想法"><Icon n="plus" /></button>

      {editing && <Editor idea={editing} allTags={allTags} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
    </>
  )
}

function Editor({ idea, allTags, onClose, onSaved }) {
  const isNew = !idea.id
  const [title, setTitle] = useState(idea.title || '')
  const [content, setContent] = useState(idea.content || '')
  const [tags, setTags] = useState(idea.tags || [])
  const [tagInput, setTagInput] = useState('')
  const [pinned, setPinned] = useState(!!idea.pinned)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const close = () => closeRef.current()
    const onKey = (e) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    // 手機「返回」掣只關面板,唔會離開網站
    window.history.pushState({ e: 1 }, '')
    window.addEventListener('popstate', close)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('popstate', close)
      document.body.style.overflow = ''
      if (window.history.state && window.history.state.e) window.history.back()
    }
  }, [])

  const addTag = (raw) => {
    const t = raw.trim()
    if (t && !tags.includes(t)) setTags([...tags, t])
    setTagInput('')
  }

  const save = async (e) => {
    e.preventDefault()
    if (!title.trim()) { setErr('請輸入標題'); return }
    setBusy(true)
    setErr('')
    const finalTags = tagInput.trim() && !tags.includes(tagInput.trim()) ? [...tags, tagInput.trim()] : tags
    const body = { title: title.trim(), content: content.trim() || null, tags: finalTags, pinned }
    const { error } = isNew
      ? await supabase.from('ideas').insert(body)
      : await supabase.from('ideas').update({ ...body, updated_at: new Date().toISOString() }).eq('id', idea.id)
    setBusy(false)
    if (error) setErr(error.message)
    else onSaved()
  }

  const del = async () => {
    if (!window.confirm('確定刪除呢個想法?')) return
    setBusy(true)
    const { error } = await supabase.from('ideas').delete().eq('id', idea.id)
    setBusy(false)
    if (error) setErr(error.message)
    else onSaved()
  }

  const suggestions = allTags.filter((t) => !tags.includes(t)).slice(0, 12)

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="sheet" onSubmit={save}>
        <div className="sheet-head">
          <h2>{isNew ? '新增想法' : '編輯想法'}</h2>
          <button type="button" className="x" onClick={onClose} aria-label="關閉"><Icon n="x" /></button>
        </div>

        <div className="sheet-body">
          <input placeholder="標題" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={isNew} />
          <textarea placeholder="想法內容(可寫長文)…" rows={8} value={content} onChange={(e) => setContent(e.target.value)} />

          <div>
            <div className="tags edit">
              {tags.map((t) => (
                <span key={t} className="tag">{t}<button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={'移除 ' + t}>×</button></span>
              ))}
              <input
                className="taginput"
                placeholder="加標籤,按 Enter"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput) } }}
                onBlur={() => addTag(tagInput)}
              />
            </div>
            {suggestions.length > 0 && (
              <div className="chips small">
                {suggestions.map((t) => <button key={t} type="button" className="chip" onClick={() => addTag(t)}>＋ {t}</button>)}
              </div>
            )}
          </div>

          <label className="check"><input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> 置頂</label>
          {err && <div className="err">{err}</div>}
        </div>

        <div className="actions">
          {!isNew && <button type="button" className="danger" onClick={del} disabled={busy}>刪除</button>}
          <span className="sp" />
          <button type="button" className="ghost" onClick={onClose}>取消</button>
          <button className="primary" disabled={busy}>{busy ? '儲存中…' : '儲存'}</button>
        </div>
      </form>
    </div>
  )
}
