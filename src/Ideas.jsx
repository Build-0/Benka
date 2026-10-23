import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase.js'

const fmt = (s) => new Date(s).toLocaleDateString('zh-HK', { year: 'numeric', month: '2-digit', day: '2-digit' })

export default function Ideas() {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [tag, setTag] = useState('')
  const [editing, setEditing] = useState(null) // null = 關閉;{} = 新增;row = 編輯

  const load = async () => {
    const { data, error } = await supabase
      .from('ideas')
      .select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) { setErr(error.message); setRows([]) } else { setErr(''); setRows(data) }
  }
  useEffect(() => { load() }, [])

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
          <div className="muted">{rows ? `共 ${rows.length} 個想法` : '載入中…'}</div>
        </div>
        <button className="primary add" onClick={() => setEditing({})}>＋ 新增</button>
      </div>

      {err && (
        <div className="card errbox">
          讀取失敗:{err}
          <div className="muted">如果提示 ideas 表不存在,請先喺 Supabase SQL Editor 執行 supabase/01_ideas.sql。</div>
        </div>
      )}

      <input className="search" type="search" placeholder="搜尋標題、內容、標籤…" value={q} onChange={(e) => setQ(e.target.value)} />

      {allTags.length > 0 && (
        <div className="chips">
          <button className={'chip' + (!tag ? ' on' : '')} onClick={() => setTag('')}>全部</button>
          {allTags.map((t) => (
            <button key={t} className={'chip' + (tag === t ? ' on' : '')} onClick={() => setTag(tag === t ? '' : t)}>{t}</button>
          ))}
        </div>
      )}

      {rows && shown.length === 0 && !err && (
        <div className="empty muted">{rows.length === 0 ? '未有想法,撳右上「新增」記低第一個。' : '搵唔到符合嘅想法。'}</div>
      )}

      <div className="grid">
        {shown.map((r) => (
          <article key={r.id} className="idea" onClick={() => setEditing(r)}>
            <div className="idea-top">
              <h3>{r.title}</h3>
              {r.pinned && <span className="pin" title="置頂">📌</span>}
            </div>
            {r.content && <p>{r.content}</p>}
            <div className="idea-foot">
              <div className="tags">{r.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>
              <span className="muted date">{fmt(r.created_at)}</span>
            </div>
          </article>
        ))}
      </div>

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

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
          <button type="button" className="x" onClick={onClose} aria-label="關閉">✕</button>
        </div>

        <input placeholder="標題" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={isNew} />
        <textarea placeholder="想法內容(可寫長文)…" rows={9} value={content} onChange={(e) => setContent(e.target.value)} />

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

        <label className="check"><input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> 📌 置頂</label>

        {err && <div className="err">{err}</div>}
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
