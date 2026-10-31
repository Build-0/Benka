import { useEffect, useState } from 'react'
import Icon from './Icon.jsx'
import { EMOJIS, catList, tcat, tname, ticon, tcolor, pickableTasks, isCustomTask, getCfg } from './boardcfg.js'

// 任務庫:自己改分類(名 + 圖標)、改任務(名 + 圖標 + 歸邊類)、新增、刪除
export default function TaskManager({ start, onClose, onSaveTask, onSaveCat }) {
  const [form, setForm] = useState(start || null)
  const [err, setErr] = useState('')

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const cats = catList()
  const tasks = pickableTasks()
  const cfg = getCfg()

  const openTask = (k) => setForm({ kind: 'task', key: k, name: tname(k), icon: ticon(k), cat: tcat(k) })
  const newTask = (cat) => setForm({ kind: 'task', key: 'x' + Date.now().toString(36), name: '', icon: '✨', cat, isNew: true })
  const openCat = (c) => setForm({ kind: 'cat', key: c.key, name: c.n, icon: c.e, custom: c.custom })
  const newCat = () => setForm({ kind: 'cat', key: 'g' + Date.now().toString(36), name: '', icon: '📁', custom: true, isNew: true })

  const save = async () => {
    if (!form.name.trim()) { setErr('要填名稱'); return }
    setErr('')
    if (form.kind === 'task') await onSaveTask(form.key, { name: form.name.trim(), icon: form.icon, cat: form.cat })
    else await onSaveCat(form.key, { name: form.name.trim(), icon: form.icon })
    setForm(null)
  }
  const remove = async () => {
    if (form.kind === 'task') {
      if (isCustomTask(form.key) && !window.confirm('刪除任務「' + form.name + '」?已經用咗嘅時段會顯示做「(已刪任務)」')) return
      await onSaveTask(form.key, null)
    } else {
      if (form.custom && !window.confirm('刪除分類「' + form.name + '」?入面嘅任務會移去「其他」')) return
      await onSaveCat(form.key, null)
    }
    setForm(null)
  }
  const hasOverride = form && !form.isNew && (form.kind === 'task' ? !!cfg.t[form.key] : !!cfg.c[form.key])
  const canRemove = form && !form.isNew && (form.kind === 'task' ? isCustomTask(form.key) || hasOverride : form.custom || hasOverride)
  const removeLabel = form && (form.kind === 'task' ? (isCustomTask(form.key) ? '刪除任務' : '還原預設') : (form.custom ? '刪除分類' : '還原預設'))

  return (
    <div className="backdrop mgrback" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet mgr">
        <div className="sheet-head">
          <h2>{form ? (form.kind === 'task' ? (form.isNew ? '新任務' : '改任務') : (form.isNew ? '新分類' : '改分類')) : '任務庫'}</h2>
          <button type="button" className="x" onClick={form ? () => setForm(null) : onClose} aria-label={form ? '返回' : '關閉'}><Icon n="x" /></button>
        </div>
        <div className="sheet-body">
          {!form && (
            <>
              <div className="muted" style={{ fontSize: 13 }}>撳分類標題改分類;撳任務改名、圖標、歸邊類。</div>
              {cats.map((c) => (
                <div key={c.key} className="mcat">
                  <button type="button" className="mcathead" onClick={() => openCat(c)}>
                    <i>{c.e}</i><b>{c.n}</b><span>✎ 改</span>
                  </button>
                  <div className="tilegrid">
                    {tasks.filter((k) => tcat(k) === c.key).map((k) => (
                      <button key={k} type="button" className="tile" style={{ '--tc': tcolor(k) }} onClick={() => openTask(k)}>
                        <i>{ticon(k)}</i><span>{tname(k)}</span>
                      </button>
                    ))}
                    <button type="button" className="tile addtile" onClick={() => newTask(c.key)}><i>＋</i><span>新任務</span></button>
                  </div>
                </div>
              ))}
              <button type="button" className="newcat" onClick={newCat}>＋ 新分類</button>
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
                <button type="button" className="ghost" onClick={() => setForm(null)}>取消</button>
                <button type="button" className="primary" onClick={save}>儲存</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

