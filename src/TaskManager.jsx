import { useEffect, useState } from 'react'
import Icon from './Icon.jsx'
import { EMOJIS, catList, tcat, tname, ticon, tcolor, tasksInCat, isCustomTask, getCfg } from './boardcfg.js'

// 任務庫:自己改分類(名 + 圖標)、改任務(名 + 圖標 + 歸邊類)、新增、刪除
export default function TaskManager({ start, focus, onSaved, onClose, onSaveTask, onSaveCat, onReorder }) {
  const [sorting, setSorting] = useState(false)
  const [form, setForm] = useState(start || null)
  const closeForm = () => (start ? onClose() : setForm(null))
  const [err, setErr] = useState('')

  useEffect(() => {
    if (focus) { const el = document.querySelector('.mcat[data-cat="' + focus + '"]'); if (el) el.scrollIntoView({ block: 'start' }) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const cats = catList()
  const cfg = getCfg()

  const move = (keys, i, d) => {
    const j = i + d
    if (j < 0 || j >= keys.length) return null
    const a = keys.slice()
    ;[a[i], a[j]] = [a[j], a[i]]
    return a
  }
  const moveTask = (cat, i, d) => { const a = move(tasksInCat(cat), i, d); if (a) onReorder('task', a) }
  const moveCat = (i, d) => { const a = move(cats.map((c) => c.key), i, d); if (a) onReorder('cat', a) }
  const openTask = (k) => setForm({ kind: 'task', key: k, name: tname(k), icon: ticon(k), cat: tcat(k) })
  const newTask = (cat) => setForm({ kind: 'task', key: 'x' + Date.now().toString(36), name: '', icon: '✨', cat, isNew: true })
  const openCat = (c) => setForm({ kind: 'cat', key: c.key, name: c.n, icon: c.e, custom: c.custom })
  const newCat = () => setForm({ kind: 'cat', key: 'g' + Date.now().toString(36), name: '', icon: '📁', custom: true, isNew: true })

  const save = async () => {
    if (!form.name.trim()) { setErr('要填名稱'); return }
    setErr('')
    if (form.kind === 'task') {
      const old = cfg.t[form.key]
      await onSaveTask(form.key, { name: form.name.trim(), icon: form.icon, cat: form.cat, pos: old && old.cat === form.cat ? old.pos : undefined })
    }
    else await onSaveCat(form.key, { name: form.name.trim(), icon: form.icon, pos: cfg.c[form.key] && cfg.c[form.key].pos })
    if (form.kind === 'task' && form.isNew && onSaved) onSaved(form.key)
    closeForm()
  }
  const remove = async () => {
    if (form.kind === 'task') {
      if (isCustomTask(form.key) && !window.confirm('刪除任務「' + form.name + '」?已經用咗嘅時段會顯示做「(已刪任務)」')) return
      await onSaveTask(form.key, null)
    } else {
      if (form.custom && !window.confirm('刪除分類「' + form.name + '」?入面嘅任務會移去第一個分類')) return
      await onSaveCat(form.key, null)
    }
    closeForm()
  }
  const hasOverride = form && !form.isNew && (form.kind === 'task' ? !!cfg.t[form.key] : !!cfg.c[form.key])
  const canRemove = form && !form.isNew && (form.kind === 'task' ? isCustomTask(form.key) || hasOverride : form.custom || hasOverride)
  const removeLabel = form && (form.kind === 'task' ? (isCustomTask(form.key) ? '刪除任務' : '還原預設') : (form.custom ? '刪除分類' : '還原預設'))

  return (
    <div className="backdrop mgrback" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet mgr">
        <div className="sheet-head">
          <h2>{form ? (form.kind === 'task' ? (form.isNew ? '新任務' : '改任務') : (form.isNew ? '新分類' : '改分類')) : '任務庫'}</h2>
          <button type="button" className="x" onClick={form ? closeForm : onClose} aria-label={form ? '返回' : '關閉'}><Icon n="x" /></button>
        </div>
        <div className="sheet-body">
          {!form && (
            <>
              <div className="mgrbar">
                <span className="muted">{sorting ? '用箭咀調位置,完成後撳右邊「完成」' : '撳分類標題改分類;撳任務改名、圖標、歸邊類'}</span>
                <button type="button" className={'rnbtn' + (sorting ? ' on' : '')} onClick={() => setSorting(!sorting)}>{sorting ? '完成' : '⇅ 排序'}</button>
              </div>
              {cats.map((c, ci) => (
                <div key={c.key} className="mcat" data-cat={c.key}>
                  <div className="mcatrow">
                    <button type="button" className="mcathead" onClick={() => !sorting && openCat(c)}>
                      <i>{c.e}</i><b>{c.n}</b>{!sorting && <span>✎ 改</span>}
                    </button>
                    {sorting && (
                      <span className="mv">
                        <button type="button" disabled={ci === 0} onClick={() => moveCat(ci, -1)}>▲</button>
                        <button type="button" disabled={ci >= cats.length - 1} onClick={() => moveCat(ci, 1)}>▼</button>
                      </span>
                    )}
                  </div>
                  <div className="tilegrid">
                    {tasksInCat(c.key).map((k, i, arr) => (
                      <div key={k} className="tilewrap">
                        <button type="button" className="tile" style={{ '--tc': tcolor(k) }} onClick={() => !sorting && openTask(k)}>
                          <i>{ticon(k)}</i><span>{tname(k)}</span>
                        </button>
                        {sorting && (
                          <span className="mv h">
                            <button type="button" disabled={i === 0} onClick={() => moveTask(c.key, i, -1)}>◀</button>
                            <button type="button" disabled={i === arr.length - 1} onClick={() => moveTask(c.key, i, 1)}>▶</button>
                          </span>
                        )}
                      </div>
                    ))}
                    {!sorting && <button type="button" className="tile addtile" onClick={() => newTask(c.key)}><i>＋</i><span>新任務</span></button>}
                  </div>
                </div>
              ))}
              {!sorting && <button type="button" className="newcat" onClick={newCat}>＋ 新分類</button>}
            </>
          )}

          {form && (
            <>
              <label className="fld">名稱
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={form.kind === 'task' ? '例如:覆診' : '例如:學習'} maxLength={20} autoFocus />
              </label>
              <div className="fld">圖標
                <div className="iconnow"><i>{form.icon}</i><input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value.trim() ? Array.from(e.target.value.trim()).slice(-2).join('') : '' })} placeholder="自己打 emoji" /></div>
                <div className="emojigrid">
                  {EMOJIS.map((em) => (
                    <button key={em} type="button" className={'em' + (form.icon === em ? ' on' : '')} onClick={() => setForm({ ...form, icon: em })}>{em}</button>
                  ))}
                </div>
              </div>
              {form.kind === 'task' && (
                <div className="fld">歸入分類
                  <div className="chips">
                    {cats.map((c) => (
                      <button key={c.key} type="button" className={'chip' + (form.cat === c.key ? ' on' : '')} onClick={() => setForm({ ...form, cat: c.key })}>{c.e} {c.n}</button>
                    ))}
                  </div>
                </div>
              )}
              {err && <div className="err">{err}</div>}
              <div className="actions" style={{ position: 'static' }}>
                {canRemove && <button type="button" className="danger" onClick={remove}>{removeLabel}</button>}
                <span className="sp" />
                <button type="button" className="ghost" onClick={closeForm}>取消</button>
                <button type="button" className="primary" onClick={save}>儲存</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

