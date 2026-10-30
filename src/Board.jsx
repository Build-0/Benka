import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase.js'
import { cget, cset } from './cache.js'
import Icon from './Icon.jsx'
import Hero from './Hero.jsx'

const TRACKS = [
  { key: 'benny', name: 'Benny', color: '#2f4a6b' },
  { key: 'carol', name: 'Carol', color: '#8a9db3' },
  { key: 'popo', name: '婆婆', color: '#8a9db3' },
  { key: 'helper', name: '工人', color: '#8a9db3' },
  { key: 'renren', name: '仁仁', color: '#8a9db3' },
  { key: 'dede', name: '德德', color: '#8a9db3' },
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
const style = (task, track) => {
  const first = task.split('+')[0]
  if (first === 'sleep') return { background: '#eef2f7', color: '#8da2b8' }
  if (task.split('+').includes('me')) return { background: '#f2774b', color: '#fff' }
  if (track === 'benny') return { background: '#2f4a6b', color: '#fff' }
  return { background: '#e3eaf2', color: '#3b4f66' }
}
const defaultDay = () => {
  const w = new Date().getDay()
  return w === 0 ? 'sun' : w === 6 ? 'sat' : 'wk'
}

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

const WAKE_FROM = 12 // 06:00
const WAKE_TO = 44 // 22:00
const isFree = (t) => !t || t.split('+').includes('me')
// Benny 清醒時段(06:00–22:00)內連續空檔(冇安排,或已標★私人時間)
const freeWins = (arr) => {
  const out = []
  let i = WAKE_FROM
  while (i < WAKE_TO) {
    if (!isFree(arr[i])) { i++; continue }
    let j = i
    while (j + 1 < WAKE_TO && isFree(arr[j + 1])) j++
    out.push({ from: i, to: j + 1 })
    i = j + 1
  }
  return out
}
const dur = (slots) => { const m = slots * 30; return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? (m % 60) + 'm' : ''}` : `${m}分` }
// 邊個喺邊個時段有可能接手(粗略:婆婆週末 11:00 後、工人 07–11 / 14–20、週日休息)
const AVAIL = (p, day, i) => {
  if (p === 'carol') return i >= 12
  if (p === 'popo') return day === 'sat' || day === 'sun' ? i >= 22 && i < 44 : i >= 18 && i < 46
  if (p === 'helper') return day !== 'sun' && ((i >= 14 && i < 22) || (i >= 28 && i < 40))
  return false
}
const MOVABLE = new Set(['feed', 'bed', 'edu', 'cook', 'wash', 'school', 'class', 'play', 'kid', 'bath'])
const pname = (k) => TRACKS.find((t) => t.key === k).name

export default function Board() {
  const [day, setDay] = useState(() => cget('board-day') || defaultDay())
  const [view, setView] = useState(() => (cget('board-view') === 'day' ? 'day' : 'list'))
  const [rows, setRows] = useState(() => cget('board')) // 全部日子嘅格
  const [err, setErr] = useState('')
  const [edit, setEdit] = useState(null)

  const load = async () => {
    const { data, error } = await supabase.from('board_slots').select('day_type, track, slot, task').limit(2000)
    if (error) { setErr(error.message); setRows((r) => r || []) } else { setErr(''); setRows(data); cset('board', data) }
  }
  useEffect(() => { load() }, [])

  // 全部日子嘅格:grids[day][track][slot]
  const grids = useMemo(() => {
    const all = {}
    DAYS.forEach((d) => { all[d.key] = Object.fromEntries(TRACKS.map((t) => [t.key, Array(48).fill('')])) })
    ;(rows || []).forEach((r) => { if (all[r.day_type] && all[r.day_type][r.track]) all[r.day_type][r.track][r.slot] = r.task })
    return all
  }, [rows])
  const grid = grids[day]

  const pickDay = (k) => { setDay(k); cset('board-day', k) }
  const pickView = (k) => { setView(k); cset('board-view', k) }

  const wins = useMemo(() => freeWins(grid.benny), [grid])
  const total = wins.reduce((a, w) => a + w.to - w.from, 0)
  const longest = Math.max(0, ...wins.map((w) => w.to - w.from))
  const summary = useMemo(() => DAYS.map((d) => {
    const ws = freeWins(grids[d.key].benny)
    return { key: d.key, total: ws.reduce((a, w) => a + w.to - w.from, 0) }
  }), [grids])
  const bestDay = summary.reduce((a, s) => (s.total > a.total ? s : a), summary[0]).key

  // 調配提示:Benny 做緊、但嗰個時間其他人有空嘅事,交出後自由時間會變幾長
  const swaps = useMemo(() => {
    const out = []
    segsOf(grid.benny).forEach((s) => {
      if (!s.task || !s.task.split('+').every((p) => MOVABLE.has(p))) return
      const who = ['carol', 'popo', 'helper'].filter((p) => {
        for (let i = s.from; i < s.to; i++) if (grid[p][i] || !AVAIL(p, day, i)) return false
        return true
      })
      if (!who.length) return
      const tmp = grid.benny.slice()
      for (let i = s.from; i < s.to; i++) tmp[i] = ''
      const w = freeWins(tmp).find((x) => s.from >= x.from && s.from < x.to)
      if (!w || w.to - w.from <= s.to - s.from) return
      out.push({ ...s, who, win: w, slots: w.to - w.from })
    })
    return out.sort((a, b) => b.slots - a.slots).slice(0, 6)
  }, [grid, day])

  const reassign = async (sw, to) => {
    if (!window.confirm(`將「${label(sw.task)} ${hm(sw.from)}–${endHm(sw.to)}」由 Benny 改派畀${pname(to)}?`)) return
    const { error: e1 } = await supabase.from('board_slots').delete().eq('day_type', day).eq('track', 'benny').gte('slot', sw.from).lt('slot', sw.to)
    if (e1) { setErr(e1.message); return }
    const ins = []
    for (let s = sw.from; s < sw.to; s++) ins.push({ day_type: day, track: to, slot: s, task: sw.task })
    const { error: e2 } = await supabase.from('board_slots').insert(ins)
    if (e2) { setErr(e2.message); return }
    await load()
  }

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
        compact
        title="24 小時看板"
        icon="calendar-time"
        sub={DAYS.find((d) => d.key === day).label + ' · 家庭分工'}
        stats={rows ? [
          { n: total ? dur(total) : '—', label: '自由時間' },
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
          <button key={d.key} className={'chip daychip' + (day === d.key ? ' on' : '') + (d.key === bestDay ? ' best' : '')} onClick={() => pickDay(d.key)}>{d.label}<small>{dur(summary.find((s) => s.key === d.key).total)}{d.key === bestDay ? ' ★' : ''}</small></button>
        ))}
      </div>

      <div className="seg" role="tablist">
        <button role="tab" aria-selected={view === 'list'} className={'sg' + (view === 'list' ? ' on' : '')} style={{ '--c': '#2f4a6b' }} onClick={() => pickView('list')}>時間表</button>
                <button role="tab" aria-selected={view === 'day'} className={'sg' + (view === 'day' ? ' on' : '')} style={{ '--c': '#2f4a6b' }} onClick={() => pickView('day')}>總表</button>
      </div>

      {rows && (
        <section className="freecard">
          <div className="fc-top">
            <div><div className="fc-n">{total ? dur(total) : '冇'}</div><div className="fc-l">我嘅自由時間</div></div>
            <div className="fc-r">最長連續 <b>{dur(longest)}</b><span>目標 90–120 分鐘</span></div>
          </div>
          <div className="fc-wins">
            {wins.map((w) => (
              <button key={w.from} className={'fw' + (w.to - w.from >= 3 ? ' ok' : '')} onClick={() => setEdit({ track: 'benny', from: w.from, to: w.to, task: '' })}>
                {hm(w.from)}–{endHm(w.to)}<small>{dur(w.to - w.from)}</small>
              </button>
            ))}
            {wins.length === 0 && <span className="muted">呢日冇空檔</span>}
          </div>
        </section>
      )}

      {rows && view === 'list' && swaps.length > 0 && (
        <section className="swaps">
          <div className="agh">調配提示</div>
          <div className="muted swnote">呢啲係你而家要做、但嗰個時間其他人有空嘅事。交出去,你嘅自由時間就連成更長一段。</div>
          {swaps.map((sw) => (
            <div key={sw.from + sw.task} className="sw">
              <div className="sw-h"><b>{hm(sw.from)}–{endHm(sw.to)} {label(sw.task)}</b><span>交出後自由 {hm(sw.win.from)}–{endHm(sw.win.to)}<em>{dur(sw.slots)}</em></span></div>
              <div className="sw-b">{sw.who.map((p) => <button key={p} onClick={() => reassign(sw, p)}>交畀{pname(p)}</button>)}</div>
            </div>
          ))}
        </section>
      )}

      {rows && view === 'list' && <ListView grid={grid} wins={wins} onEdit={(track, s) => setEdit({ track, ...s })} />}
            {rows && view === 'day' && <DayView grid={grid} onEdit={(track, s) => setEdit({ track, ...s })} />}

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

const PARTS = [
  { from: 0, to: 12, name: '凌晨 00:00–06:00' },
  { from: 12, to: 24, name: '上午 06:00–12:00' },
  { from: 24, to: 36, name: '下午 12:00–18:00' },
  { from: 36, to: 48, name: '晚上 18:00–24:00' },
]

function ListView({ grid, wins, onEdit }) {
  const [who, setWho] = useState('all')
  const keys = who === 'all' ? ['benny', 'carol', 'popo', 'helper'] : [who]
  // 同一時段、同一任務嘅人合併做一行
  const events = useMemo(() => {
    const m = new Map()
    keys.forEach((k) => segsOf(grid[k]).forEach((s) => {
      if (!s.task || s.task === 'sleep') return
      const id = s.from + '-' + s.to + '-' + s.task
      if (!m.has(id)) m.set(id, { ...s, people: [] })
      m.get(id).people.push(k)
    }))
    if (who === 'all' || who === 'benny') wins.forEach((w) => m.set('free' + w.from, { from: w.from, to: w.to, task: '__free', people: ['benny'] }))
    return [...m.values()].sort((a, b) => a.from - b.from || a.to - b.to)
  }, [grid, who, wins]) // eslint-disable-line react-hooks/exhaustive-deps
  const nm = (k) => TRACKS.find((t) => t.key === k)
  return (
    <>
      <div className="chips">
        <button className={'chip' + (who === 'all' ? ' on' : '')} onClick={() => setWho('all')}>全部人</button>
        {TRACKS.map((t) => (
          <button key={t.key} className={'chip' + (who === t.key ? ' on' : '')} onClick={() => setWho(t.key)}>{t.name}</button>
        ))}
      </div>
      {PARTS.map((p) => {
        const list = events.filter((e) => e.from >= p.from && e.from < p.to)
        if (!list.length) return null
        return (
          <section key={p.name}>
            <div className="agh">{p.name}</div>
            <div className="agenda">
              {list.map((e) => {
                if (e.task === '__free') {
                  return (
                    <button key={'f' + e.from} className="ag free" onClick={() => onEdit('benny', { from: e.from, to: e.to, task: '' })}>
                      <span className="agt">{hm(e.from)}–{endHm(e.to)}</span>
                      <span className="agb">★ 自由時間</span>
                      <span className="agp"><em style={{ '--p': '#f2774b' }}>{dur(e.to - e.from)}</em></span>
                    </button>
                  )
                }
                const c = e.task.split('+').includes('me') ? '#f2774b' : e.people.includes('benny') ? '#2f4a6b' : '#c3cfdc'
                return (
                  <button key={e.from + '-' + e.to + e.task} className="ag" onClick={() => onEdit(e.people[0], e)} style={{ '--c': c }}>
                    <span className="agt">{e.to - e.from === 1 ? hm(e.from) : hm(e.from) + '–' + endHm(e.to)}</span>
                    <span className="agb"><i />{label(e.task)}</span>
                    <span className="agp">{who === 'all' ? e.people.map((k) => <em key={k} style={{ '--p': nm(k).color }}>{nm(k).name}</em>) : null}</span>
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}
      {events.length === 0 && <div className="empty muted">呢個日子類型未有安排。</div>}
    </>
  )
}

function DayView({ grid, onEdit }) {
  return (
    <div className="bdwrap">
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
              className={'bdseg' + (s.task ? '' : ' blank') + (!s.task && t.key === 'benny' && s.from >= WAKE_FROM && s.to <= WAKE_TO ? ' bfree' : '')}
              style={{ gridRow: `${s.from + 2} / ${s.to + 2}`, gridColumn: c + 2, ...(s.task ? style(s.task, t.key) : {}) }}
              onClick={() => onEdit(t.key, s)}
            >
              {s.task ? label(s.task) : t.key === 'benny' && s.from >= WAKE_FROM && s.to <= WAKE_TO ? '★ 自由' : ''}
            </button>
          ))
        )}
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
