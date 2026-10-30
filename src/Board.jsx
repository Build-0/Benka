import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase.js'
import { cget, cset } from './cache.js'
import Icon from './Icon.jsx'
import Hero from './Hero.jsx'

const TRACKS = [
  { key: 'benny', name: 'Benny', color: '#2f4a6b' },
  { key: 'carol', name: 'Carol', color: '#6a58a8' },
  { key: 'popo', name: '婆婆', color: '#2f9e9a' },
  { key: 'helper', name: '工人', color: '#4a8fa8' },
  { key: 'renren', name: '仁仁', color: '#5a6fc0' },
  { key: 'dede', name: '德德', color: '#6b9bd1' },
]
const DAYS = [
  { key: 'wk', label: '平日' },
  { key: 'off', label: 'Benny 休假' },
  { key: 'sat', label: '週六' },
  { key: 'sun', label: '週日／公假' },
]
// d = 淺色底用深字
const TASKS = [
  { k: 'feed', l: '餵奶換片', c: '#3f7fbf' },
  { k: 'pump', l: '泵奶', c: '#6a58a8' },
  { k: 'wash', l: '洗奶樽', c: '#4a8fa8' },
  { k: 'routine', l: '起身流程', c: '#6b9bd1', d: 1 },
  { k: 'school', l: '學校接送', c: '#2f9e9a' },
  { k: 'cook', l: '煮飯家務', c: '#5a6fc0' },
  { k: 'work', l: '返工', c: '#2f4a6b' },
  { k: 'go', l: '通勤', c: '#8da2b8', d: 1 },
  { k: 'rest', l: '休息', c: '#b4c3d3', d: 1 },
  { k: 'nap', l: '午睡', c: '#7f8fd0' },
  { k: 'bath', l: '沖涼', c: '#3aa0c8' },
  { k: 'edu', l: '閱讀教育', c: '#2f9e7a' },
  { k: 'screen', l: '屏幕', c: '#a07fc0' },
  { k: 'play', l: '玩／活動', c: '#d9a441', d: 1 },
  { k: 'class', l: '課外班', c: '#c0709a' },
  { k: 'eat', l: '食飯', c: '#b08a5a' },
  { k: 'bed', l: '陪睡', c: '#5b6aa8' },
  { k: 'sleep', l: '睡眠', c: '#34456b' },
  { k: 'kid', l: '照顧', c: '#7aa7c7', d: 1 },
  { k: 'me', l: '★ 私人時間', c: '#f2774b' },
]
const TASK = Object.fromEntries(TASKS.map((t) => [t.k, t]))

const hm = (i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`
const endHm = (i) => (i >= 48 ? '24:00' : hm(i))
const label = (task) => task.split('+').map((c) => (TASK[c] ? TASK[c].l : c)).join(' ＋ ')
const style = (task) => {
  const t = TASK[task.split('+')[0]]
  return t ? { background: t.c, color: t.d ? '#1c2b3f' : '#fff' } : {}
}
const defaultDay = () => {
  const w = new Date().getDay()
  return w === 0 ? 'sun' : w === 6 ? 'sat' : 'wk'
}
const nowSlot = () => { const d = new Date(); return d.getHours() * 2 + (d.getMinutes() >= 30 ? 1 : 0) }

// 連續相同任務(包括空白)合併成一段
const segsOf = (arr) => {
  const out = []
  for (let i = 0; i < 48; i++) {
    const t = arr[i] || ''
    const last = out[out.length - 1]
    if (last && last.task === t) last.to = i + 1
    else out.push({ from: i, to: i + 1, task: t })
  }
  return out
}

export default function Board() {
  const [day, setDay] = useState(() => cget('board-day') || defaultDay())
  const [view, setView] = useState(() => cget('board-view') || 'now')
  const [rows, setRows] = useState(() => cget('board')) // 全部日子嘅格
  const [err, setErr] = useState('')
  const [edit, setEdit] = useState(null)
  const [now, setNow] = useState(nowSlot())

  useEffect(() => {
    const t = setInterval(() => setNow(nowSlot()), 30000)
    return () => clearInterval(t)
  }, [])

  const load = async () => {
    const { data, error } = await supabase.from('board_slots').select('day_type, track, slot, task').limit(2000)
    if (error) { setErr(error.message); setRows((r) => r || []) } else { setErr(''); setRows(data); cset('board', data) }
  }
  useEffect(() => { load() }, [])

  // grid[track][slot] = task,只取當前日子類型
  const grid = useMemo(() => {
    const g = Object.fromEntries(TRACKS.map((t) => [t.key, Array(48).fill('')]))
    ;(rows || []).forEach((r) => { if (r.day_type === day && g[r.track]) g[r.track][r.slot] = r.task })
    return g
  }, [rows, day])

  const pickDay = (k) => { setDay(k); cset('board-day', k) }
  const pickView = (k) => { setView(k); cset('board-view', k) }

  // Benny 最長連續空檔(06:00–22:00 之間冇安排嘅時段)
  const free = useMemo(() => {
    let best = null
    let i = 12
    while (i < 44) {
      if (grid.benny[i]) { i++; continue }
      let j = i
      while (j + 1 < 44 && !grid.benny[j + 1]) j++
      if (!best || j - i > best.to - best.from - 1) best = { from: i, to: j + 1 }
      i = j + 1
    }
    return best
  }, [grid])
  const freeMin = free ? (free.to - free.from) * 30 : 0

  const saveRange = async ({ track, from, to, task }) => {
    const base = supabase.from('board_slots').delete().eq('day_type', day).eq('track', track).gte('slot', from).lt('slot', to)
    const { error: e1 } = await base
    if (e1) return e1.message
    if (task) {
      const ins = []
      for (let s = from; s < to; s++) ins.push({ day_type: day, track, slot: s, task })
      const { error: e2 } = await supabase.from('board_slots').insert(ins)
      if (e2) return e2.message
    }
    await load()
    return ''
  }

  const empty = rows && rows.length === 0 && !err

  return (
    <>
      <Hero
        title="24 小時看板"
        icon="calendar-time"
        sub={DAYS.find((d) => d.key === day).label + ' · 家庭分工'}
        stats={rows ? [
          { n: hm(now), label: '而家' },
          { n: free ? `${Math.floor(freeMin / 60)}h${freeMin % 60 ? freeMin % 60 + 'm' : ''}` : '—', label: 'Benny 最長空檔' },
        ] : []}
      />

      {err && (
        <div className="card errbox">
          讀取失敗:{err}
          {/relation|schema cache|does not exist/i.test(err) && <div className="muted">board_slots 表未建立,請先喺 Supabase SQL Editor 執行 supabase/02_board.sql。</div>}
        </div>
      )}
      {empty && <div className="card errbox">未有看板資料,請先執行 supabase/02_board.sql。</div>}

      <div className="chips">
        {DAYS.map((d) => (
          <button key={d.key} className={'chip' + (day === d.key ? ' on' : '')} onClick={() => pickDay(d.key)}>{d.label}</button>
        ))}
      </div>

      <div className="seg" role="tablist">
        <button role="tab" aria-selected={view === 'now'} className={'sg' + (view === 'now' ? ' on' : '')} style={{ '--c': '#f2774b' }} onClick={() => pickView('now')}>而家</button>
        <button role="tab" aria-selected={view === 'day'} className={'sg' + (view === 'day' ? ' on' : '')} style={{ '--c': '#2f4a6b' }} onClick={() => pickView('day')}>全日</button>
      </div>

      {free && (
        <div className={'freebar' + (freeMin >= 90 ? ' ok' : '')}>
          <Icon n="sun" />
          <span>Benny 最長連續空檔 <b>{hm(free.from)}–{endHm(free.to)}</b>({freeMin} 分鐘){freeMin >= 90 ? ',夠做★私人時間' : ',未夠 90 分鐘'}</span>
        </div>
      )}

      {rows && view === 'now' && <NowView grid={grid} now={now} onEdit={(track, i) => setEdit({ track, slot: i })} />}
      {rows && view === 'day' && <DayView grid={grid} now={now} onEdit={(track, s) => setEdit({ track, ...s })} />}

      {edit && (
        <SlotEditor
          init={edit}
          grid={grid}
          onClose={() => setEdit(null)}
          onSave={async (v) => { const m = await saveRange(v); if (!m) setEdit(null); return m }}
        />
      )}
    </>
  )
}

function NowView({ grid, now, onEdit }) {
  return (
    <div className="nowgrid">
      {TRACKS.map((t) => {
        const arr = grid[t.key]
        const cur = arr[now] || ''
        let to = now + 1
        while (to < 48 && (arr[to] || '') === cur) to++
        const next = to < 48 ? arr[to] || '' : ''
        return (
          <button key={t.key} className="nowcard" style={{ '--c': t.color }} onClick={() => onEdit(t.key, now)}>
            <div className="nowname"><i />{t.name}</div>
            <div className="nowtask" style={cur ? style(cur) : undefined}>{cur ? label(cur) : '自由／冇安排'}</div>
            <div className="nownext">
              {to < 48 ? <>至 {hm(to)} · 之後 {next ? label(next) : '冇安排'}</> : <>至全日完結</>}
            </div>
          </button>
        )
      })}
    </div>
  )
}

function DayView({ grid, now, onEdit }) {
  const wrap = useRef(null)
  useEffect(() => {
    // 開頁自動捲到「而家」前一個鐘
    if (wrap.current) wrap.current.scrollTop = Math.max(0, (now - 2) * 30)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="bdwrap" ref={wrap}>
      <div className="bdgrid">
        <div className="bdh bdt" style={{ gridRow: 1, gridColumn: 1 }} />
        {TRACKS.map((t, c) => (
          <div key={t.key} className="bdh" style={{ gridRow: 1, gridColumn: c + 2, '--c': t.color }}>{t.name}</div>
        ))}
        {Array.from({ length: 48 }, (_, i) => (
          <div key={i} className={'bdt' + (i % 2 ? ' half' : '')} style={{ gridRow: i + 2, gridColumn: 1 }}>{i % 2 ? '' : hm(i)}</div>
        ))}
        {TRACKS.map((t, c) =>
          segsOf(grid[t.key]).map((s) => (
            <button
              key={t.key + s.from}
              className={'bdseg' + (s.task ? '' : ' blank')}
              style={{ gridRow: `${s.from + 2} / ${s.to + 2}`, gridColumn: c + 2, ...(s.task ? style(s.task) : {}) }}
              onClick={() => onEdit(t.key, s)}
            >
              {s.task ? label(s.task) : ''}
            </button>
          ))
        )}
        <div className="bdnow" style={{ gridRow: now + 2, gridColumn: '1 / -1' }} />
      </div>
    </div>
  )
}

function SlotEditor({ init, grid, onClose, onSave }) {
  const tr = TRACKS.find((t) => t.key === init.track)
  const cur = grid[init.track]
  // 由撳落嗰格擴展成同任務嘅連續一段
  const seg = init.from !== undefined ? init : segsOf(cur).find((s) => init.slot >= s.from && init.slot < s.to)
  const [from, setFrom] = useState(seg.from)
  const [to, setTo] = useState(seg.to)
  const [picked, setPicked] = useState(seg.task ? seg.task.split('+') : [])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const close = () => closeRef.current()
    const onKey = (e) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    window.history.pushState({ e: 1 }, '')
    window.addEventListener('popstate', close)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('popstate', close)
      document.body.style.overflow = ''
      if (window.history.state && window.history.state.e) window.history.back()
    }
  }, [])

  const toggle = (k) => {
    if (picked.includes(k)) setPicked(picked.filter((x) => x !== k))
    else setPicked([...picked, k].slice(-2)) // 最多同時兩件事
  }
  const save = async (clearIt) => {
    if (to <= from) { setErr('「至」要遲過「由」'); return }
    setBusy(true); setErr('')
    const m = await onSave({ track: init.track, from, to, task: clearIt ? '' : picked.join('+') })
    setBusy(false)
    if (m) setErr(m)
  }

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" style={{ '--c': tr.color }}>
        <div className="sheet-head">
          <h2>{tr.name} · 改時段</h2>
          <button type="button" className="x" onClick={onClose} aria-label="關閉"><Icon n="x" /></button>
        </div>
        <div className="sheet-body">
          <div className="timepick">
            <label>由<select value={from} onChange={(e) => setFrom(+e.target.value)}>
              {Array.from({ length: 48 }, (_, i) => <option key={i} value={i}>{hm(i)}</option>)}
            </select></label>
            <label>至<select value={to} onChange={(e) => setTo(+e.target.value)}>
              {Array.from({ length: 48 }, (_, i) => i + 1).map((i) => <option key={i} value={i}>{endHm(i)}</option>)}
            </select></label>
          </div>
          <div className="muted" style={{ fontSize: 13 }}>揀任務(最多兩個,一齊做嘅事)</div>
          <div className="taskpick">
            {TASKS.map((t) => (
              <button
                key={t.k}
                type="button"
                className={'tp' + (picked.includes(t.k) ? ' on' : '')}
                style={{ '--tc': t.c }}
                onClick={() => toggle(t.k)}
              >{t.l}</button>
            ))}
          </div>
          {err && <div className="err">{err}</div>}
        </div>
        <div className="actions">
          <button type="button" className="danger" onClick={() => save(true)} disabled={busy}>清空</button>
          <span className="sp" />
          <button type="button" className="ghost" onClick={onClose}>取消</button>
          <button type="button" className="primary" onClick={() => save(false)} disabled={busy || picked.length === 0}>{busy ? '儲存中…' : '儲存'}</button>
        </div>
      </div>
    </div>
  )
}
