import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase.js'
import { cget, cset } from './cache.js'
import Icon from './Icon.jsx'
import Hero from './Hero.jsx'
import TaskManager from './TaskManager.jsx'
import { tname, ticon, tcolor, catList, catOf, pickableTasks, tasksInCat, getCfg, setCfg } from './boardcfg.js'

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
  { key: 'sat', label: '週六' },
  { key: 'sun', label: '週日/公假' },
  { key: 'off', label: '休息日' },
]
const BENNY_DAYS = [
  { key: 'wk', label: '工作日' },
  { key: 'off', label: '休息日' },
]
const OTHER_DAYS = DAYS.filter((d) => d.key !== 'off')

const hm = (i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`
const endHm = (i) => (i >= 48 ? '24:00' : hm(i))
const isFlex = (task) => task.split('+').includes('flex')
const label = (task) => (isFlex(task) ? '~ ' : '') + task.split('+').filter((c) => c !== 'flex').map(tname).join(' ＋ ')
const baseStyle = (task, track) => {
  const first = task.split('+')[0]
  if (first === 'sleep') return { background: '#eef2f7', color: '#8da2b8' }
  if (task.split('+').includes('me')) return { background: '#f2774b', color: '#fff' }
  if (track === 'benny') return { background: '#2f4a6b', color: '#fff' }
  return { background: '#e3eaf2', color: '#3b4f66' }
}
const style = (task, track) => {
  const s = baseStyle(task, track)
  return isFlex(task) ? { ...s, opacity: 0.75, outline: '1.5px dashed currentColor', outlineOffset: -4 } : s
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
// 'me' = 真自由(★私人時間);空白 = 冇指定責任嘅待命(喺屋企隨時要照應);其他 = 責任
const kindOf = (t) => (!t ? 'open' : t.split('+').includes('me') ? 'me' : '')
// Benny 清醒時段(06:00–22:00)內,連續同類嘅自由 / 待命時段
const freeWins = (arr) => {
  const out = []
  let i = WAKE_FROM
  while (i < WAKE_TO) {
    const k = kindOf(arr[i])
    if (!k) { i++; continue }
    let j = i
    while (j + 1 < WAKE_TO && kindOf(arr[j + 1]) === k) j++
    out.push({ from: i, to: j + 1, kind: k })
    i = j + 1
  }
  return out
}
const dur = (slots) => { const m = slots * 30; return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? (m % 60) + 'm' : ''}` : `${m}分` }

export default function Board() {
  const [dayRaw, setDay] = useState(() => cget('board-day') || defaultDay())
  const [mode, setMode] = useState(() => (cget('board-mode') === 'all' ? 'all' : 'me')) // me = 我嘅時間;all = 全貌
  const [whoS, setWho] = useState(() => cget('board-who') || 'benny')
  const [viewS, setView] = useState(() => (['day', 'list'].includes(cget('board-view')) ? cget('board-view') : 'time'))
  // 「我嘅時間」永遠係 Benny、只有列表;「全貌」先有人物篩選同總表
  const who = mode === 'me' ? 'benny' : whoS
  const view = mode === 'me' && viewS === 'day' ? 'time' : viewS
  const [rows, setRows] = useState(() => cget('board')) // 全部日子嘅格
  const [err, setErr] = useState('')
  const [edit, setEdit] = useState(null)
  const [, bump] = useState(0)
  const [mgr, setMgr] = useState(null) // null | { start }

  const load = async () => {
    const { data, error } = await supabase.from('board_slots').select('day_type, track, slot, task').limit(2000)
    if (error) { setErr(error.message); setRows((r) => r || []) } else { setErr(''); setRows(data); cset('board', data) }
  }
  const loadCfg = async () => {
    let r = await supabase.from('board_task_names').select('task, name, cat, icon, pos')
    if (r.error) r = await supabase.from('board_task_names').select('task, name, cat, icon')
    if (r.error) r = await supabase.from('board_task_names').select('task, name, cat')
    if (r.error) r = await supabase.from('board_task_names').select('task, name')
    if (r.error) return // 未建表:淨係用本機
    const next = { t: {}, c: {} }
    r.data.forEach((x) => {
      if (x.task.startsWith('g:')) next.c[x.task.slice(2)] = { name: x.name, icon: x.icon || '', ...(x.pos != null ? { pos: x.pos } : {}) }
      else next.t[x.task] = { name: x.name, ...(x.cat ? { cat: x.cat } : {}), ...(x.icon ? { icon: x.icon } : {}), ...(x.pos != null ? { pos: x.pos } : {}) }
    })
    setCfg(next)
    bump((n) => n + 1)
  }
  useEffect(() => { load(); loadCfg() }, [])

  // 任務 / 分類設定:改名、圖標、歸類、新增、刪除(patch = null 即刪除 / 還原預設)
  const syncErr = (error) => error && setErr('任務庫只存咗喺呢部機(跨裝置同步要先喺 Supabase 跑 supabase/03_board_task_names.sql):' + error.message)
  const saveTask = async (k, patch) => {
    const c = getCfg()
    const t = { ...c.t }
    if (patch) t[k] = patch; else delete t[k]
    setCfg({ ...c, t })
    bump((x) => x + 1)
    const { error } = patch
      ? await supabase.from('board_task_names').upsert({ task: k, name: patch.name, cat: patch.cat || null, icon: patch.icon || null, pos: patch.pos ?? null }, { onConflict: 'user_id,task' })
      : await supabase.from('board_task_names').delete().eq('task', k)
    syncErr(error)
  }
  const saveCat = async (k, patch) => {
    const c = getCfg()
    const cc = { ...c.c }
    if (patch) cc[k] = patch; else delete cc[k]
    setCfg({ ...c, c: cc })
    bump((x) => x + 1)
    const { error } = patch
      ? await supabase.from('board_task_names').upsert({ task: 'g:' + k, name: patch.name, icon: patch.icon || null, pos: patch.pos ?? null }, { onConflict: 'user_id,task' })
      : await supabase.from('board_task_names').delete().eq('task', 'g:' + k)
    syncErr(error)
  }

  // 重新排次序:kind 'task' = 一個分類入面嘅任務;'cat' = 分類(冇固定分類)
  const reorder = async (kind, keys) => {
    const c = getCfg()
    const rows = []
    if (kind === 'task') {
      const t = { ...c.t }
      keys.forEach((k, i) => {
        t[k] = { ...(t[k] || {}), name: (t[k] && t[k].name) || tname(k), pos: i }
        rows.push({ task: k, name: t[k].name, cat: t[k].cat || null, icon: t[k].icon || null, pos: i })
      })
      setCfg({ ...c, t })
    } else {
      const cc = { ...c.c }
      const info = Object.fromEntries(catList().map((x) => [x.key, x]))
      keys.forEach((k, i) => {
        cc[k] = { name: info[k].n, icon: info[k].e, pos: i }
        rows.push({ task: 'g:' + k, name: info[k].n, icon: info[k].e, pos: i })
      })
      setCfg({ ...c, c: cc })
    }
    bump((x) => x + 1)
    const { error } = await supabase.from('board_task_names').upsert(rows, { onConflict: 'user_id,task' })
    syncErr(error)
  }

  // 全部日子嘅格:grids[day][track][slot]
  const grids = useMemo(() => {
    const all = {}
    DAYS.forEach((d) => { all[d.key] = Object.fromEntries(TRACKS.map((t) => [t.key, Array(48).fill('')])) })
    ;(rows || []).forEach((r) => { if (all[r.day_type] && all[r.day_type][r.track]) all[r.day_type][r.track][r.slot] = r.task })
    return all
  }, [rows])
  // Benny 淨係分工作日 / 休息日(週末都返工);其他人先有週六日
  const dayOpts = who === 'benny' ? BENNY_DAYS : who !== 'all' ? OTHER_DAYS : DAYS
  const day = (dayOpts.find((d) => d.key === dayRaw) || dayOpts[0]).key
  const grid = grids[day]

  const pickDay = (k) => { setDay(k); cset('board-day', k) }
  const pickMode = (k) => { setMode(k); cset('board-mode', k); if (k === 'all') { setView('day'); cset('board-view', 'day'); setWho('all'); cset('board-who', 'all') } }
  const pickWho = (k) => { setWho(k); cset('board-who', k) }
  const pickView = (k) => { setView(k); cset('board-view', k) }

  const wins = useMemo(() => freeWins(grid.benny), [grid])
  const meWins = wins.filter((w) => w.kind === 'me')
  const total = meWins.reduce((a, w) => a + w.to - w.from, 0)
  const standby = wins.filter((w) => w.kind === 'open').reduce((a, w) => a + w.to - w.from, 0)
  const longest = Math.max(0, ...meWins.map((w) => w.to - w.from))
  const summary = useMemo(() => dayOpts.map((d) => {
    const ws = freeWins(grids[d.key].benny).filter((w) => w.kind === 'me')
    return { key: d.key, total: ws.reduce((a, w) => a + w.to - w.from, 0) }
  }), [grids, dayOpts])
  // 今日 24 小時去向(按任務計,Benny 軌道):自由 / 待命 / 各項任務
  const breakdown = useMemo(() => {
    const m = new Map()
    grids[day === 'sat' || day === 'sun' ? 'wk' : day].benny.forEach((t, i) => {
      let k
      if (!t) k = i >= WAKE_FROM && i < WAKE_TO ? '__standby' : null
      else if (t.split('+').includes('me')) k = 'me'
      else k = t.split('+').find((x) => x !== 'flex')
      if (k) m.set(k, (m.get(k) || 0) + 1)
    })
    return [...m].map(([k, n]) => ({ k, n })).sort((a, c) => (a.k === 'me' ? -1 : c.k === 'me' ? 1 : c.n - a.n))
  }, [grids, day])
  const best = summary.reduce((a, s) => (s.total > a.total ? s : a), summary[0])
  const bestDay = best.total > 0 ? best.key : ''


  const saveRange = async ({ track, from, to, task, oldFrom = from, oldTo = to }) => {
    // 連同原本嗰段一齊清走,縮短時段先會真係縮短
    const base = supabase.from('board_slots').delete().eq('day_type', day).eq('track', track).gte('slot', Math.min(from, oldFrom)).lt('slot', Math.max(to, oldTo))
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
        tone={mode}
        title="24 小時看板"
        icon="calendar-time"
        sub={mode === 'all' ? '全家 6 個人嘅一日總覽' : rows ? `最長連續 ${dur(longest)}${standby ? ` · 待命 ${dur(standby)}` : ''}` : '我嘅時間'}
        stats={mode === 'me' && rows ? [{ n: total ? dur(total) : '—', label: '我嘅自由時間' }] : []}
      />

      <div className="modeseg" role="tablist">
        <button role="tab" aria-selected={mode === 'me'} className={'mode me' + (mode === 'me' ? ' on' : '')} onClick={() => pickMode('me')}><i>👤</i>我嘅時間</button>
        <button role="tab" aria-selected={mode === 'all'} className={'mode all' + (mode === 'all' ? ' on' : '')} onClick={() => pickMode('all')}><i>👨‍👩‍👧</i>全貌</button>
      </div>

      {err && (
        <div className="card errbox">
          讀取失敗:{err}
          {/relation|schema cache|does not exist/i.test(err) && <div className="muted">board_slots 表未建立,請先喺 Supabase SQL Editor 執行 supabase/02_board.sql。</div>}
        </div>
      )}
      {empty && <div className="card errbox">未有看板資料,請先執行 supabase/02_board.sql。</div>}

      {mode === 'all' && (
        <div className="chips">
          {TRACKS.map((t) => (
            <button key={t.key} className={'chip' + (who === t.key ? ' on' : '')} onClick={() => pickWho(t.key)}>{t.name}</button>
          ))}
          <button className={'chip' + (who === 'all' ? ' on' : '')} onClick={() => pickWho('all')}>全部人</button>
        </div>
      )}

      <div className="segc" role="tablist">
        {dayOpts.map((d) => (
          <button key={d.key} role="tab" aria-selected={day === d.key} className={'segi' + (day === d.key ? ' on' : '')} onClick={() => pickDay(d.key)}>
            {d.label}<small>{dur(summary.find((s) => s.key === d.key).total)}{d.key === bestDay ? ' ★' : ''}</small>
          </button>
        ))}
      </div>

      {mode === 'me' && rows && <Breakdown items={breakdown} />}

      <div className="segc" role="tablist">
        <button role="tab" aria-selected={view === 'time'} className={'segi' + (view === 'time' ? ' on' : '')} onClick={() => pickView('time')}>按時間</button>
        <button role="tab" aria-selected={view === 'list'} className={'segi' + (view === 'list' ? ' on' : '')} onClick={() => pickView('list')}>按類別</button>
        {mode === 'all' && <button role="tab" aria-selected={view === 'day'} className={'segi' + (view === 'day' ? ' on' : '')} onClick={() => pickView('day')}>總表</button>}
      </div>

      <div className="mebar"><button type="button" className="rnbtn" onClick={() => setMgr({})}>⚙ 任務庫</button></div>
      {rows && view !== 'day' && (
        <button className="fab bfab" onClick={() => setEdit({ track: who === 'all' ? 'benny' : who, from: 18, to: 19, task: '', isNew: true })} aria-label="新增安排"><Icon n="plus" /></button>
      )}
      {rows && view !== 'day' && <ListView mode={view} who={who} grid={grid} wins={wins} onEdit={(track, s) => setEdit({ track, ...s })} />}
      {rows && view === 'day' && <DayView who={who} grid={grid} onEdit={(track, s) => setEdit({ track, ...s })} />}

      {edit && (
        <SlotEditor
          init={edit}
          grid={grid}
          onClose={() => setEdit(null)}
          onManage={(o) => setMgr(o || {})}
          onSave={async (v) => { const m = await saveRange(v); if (!m) setEdit(null); return m }}
        />
      )}
      {mgr && <TaskManager start={mgr.start} focus={mgr.focus} onSaved={mgr.onSaved} onClose={() => setMgr(null)} onSaveTask={saveTask} onSaveCat={saveCat} onReorder={reorder} />}
    </>
  )
}

// 24 小時去向:一條橫棒 + 每項用幾耐(自由時間珊瑚色,其他按時間長短深淺)
const SHADES = ['#2f4a6b', '#3f6490', '#5f84ad', '#86a3c4', '#aebfd6', '#cdd8e6']
function Breakdown({ items }) {
  const total = items.reduce((a, x) => a + x.n, 0) || 1
  let rank = 0
  const rows = items.map((x) => {
    const color = x.k === 'me' ? '#f2774b' : x.k === '__standby' ? '#e3eaf2' : SHADES[Math.min(rank++, SHADES.length - 1)]
    return { ...x, color, name: x.k === 'me' ? '自由時間' : x.k === '__standby' ? '待命(冇指定責任)' : tname(x.k), icon: x.k === 'me' ? '⭐' : x.k === '__standby' ? '⏳' : ticon(x.k) }
  })
  return (
    <section className="bkd">
      <div className="bkd-title">呢一日 24 小時去咗邊</div>
      <div className="bkd-bar">
        {rows.map((r) => <span key={r.k} style={{ width: (r.n / total) * 100 + '%', background: r.color }} title={r.name} />)}
      </div>
      <div className="bkd-list">
        {rows.map((r) => (
          <div key={r.k} className={'bkd-row' + (r.k === 'me' ? ' free' : '')}>
            <i style={{ background: r.color }} />
            <span className="bkd-n">{r.icon} {r.name}</span>
            <b>{dur(r.n)}</b>
          </div>
        ))}
      </div>
    </section>
  )
}

// 按時間線:四個時段
const PARTS = [
  { key: 'p0', from: 0, to: 12, name: '凌晨 00:00–06:00' },
  { key: 'p1', from: 12, to: 24, name: '上午 06:00–12:00' },
  { key: 'p2', from: 24, to: 36, name: '下午 12:00–18:00' },
  { key: 'p3', from: 36, to: 48, name: '晚上 18:00–24:00' },
]

function ListView({ mode, who, grid, wins, onEdit }) {
  const keys = who === 'all' ? TRACKS.map((t) => t.key) : [who]
  // 同一時段、同一任務嘅人合併做一行
  const events = useMemo(() => {
    const m = new Map()
    keys.forEach((k) => segsOf(grid[k]).forEach((s) => {
      if (!s.task || s.task === 'me') return // 純私人時間由「★ 自由時間」嗰行代表
      const id = s.from + '-' + s.to + '-' + s.task
      if (!m.has(id)) m.set(id, { ...s, people: [] })
      m.get(id).people.push(k)
    }))
    if (who === 'all' || who === 'benny') wins.forEach((w) => m.set('free' + w.from, { from: w.from, to: w.to, task: w.kind === 'me' ? '__free' : '__open', people: ['benny'] }))
    return [...m.values()].sort((a, b) => a.from - b.from || a.to - b.to)
  }, [grid, who, wins]) // eslint-disable-line react-hooks/exhaustive-deps
  const nm = (k) => TRACKS.find((t) => t.key === k)
  return (
    <>
      {(mode === 'time' ? PARTS : [{ key: 'free', name: '★ 自由 / 待命' }, ...catList().map((c) => ({ key: c.key, name: c.e + ' ' + c.n }))]).map((p) => {
        const list = mode === 'time' ? events.filter((e) => e.from >= p.from && e.from < p.to) : events.filter((e) => (e.task === '__free' || e.task === '__open' ? 'free' : catOf(e.task)) === p.key)
        if (!list.length) return null
        return (
          <section key={p.key}>
            <div className="agh">{p.name}<span className="agn">{list.length}</span></div>
            <div className="agenda">
              {list.map((e) => {
                if (e.task === '__open') {
                  return (
                    <button key={'o' + e.from} className="ag open" onClick={() => onEdit('benny', { from: e.from, to: e.to, task: '' })}>
                      <span className="agt">{hm(e.from)}–{endHm(e.to)}</span>
                      <span className="agb">待命 · 冇指定責任</span>
                      <span className="agp"><em style={{ '--p': '#9aaabb' }}>{dur(e.to - e.from)}</em></span>
                    </button>
                  )
                }
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
                  <button key={e.from + '-' + e.to + e.task} className="ag" onClick={() => onEdit(e.people[0], e)} style={{ '--c': c, ...(isFlex(e.task) ? { borderStyle: 'dashed' } : {}) }}>
                    <span className="agt">{hm(e.from)}–{endHm(e.to)}</span>
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

function DayView({ who, grid, onEdit }) {
  const tracks = who === 'all' ? TRACKS : TRACKS.filter((t) => t.key === who)
  return (
    <div className="bdwrap">
      <div className="bdgrid" style={{ '--n': tracks.length, ...(tracks.length === 1 ? { minWidth: 0 } : {}) }}>
        <div className="bdh bdt" style={{ gridRow: 1, gridColumn: 1 }} />
        {tracks.map((t, c) => (
          <div key={t.key} className="bdh" style={{ gridRow: 1, gridColumn: c + 2, '--c': t.color }}>{t.name}</div>
        ))}
        {Array.from({ length: 48 }, (_, i) => (
          <div key={i} className={'bdt' + (i % 2 ? ' half' : '')} style={{ gridRow: i + 2, gridColumn: 1 }}>{i % 2 ? '' : hm(i)}</div>
        ))}
        {tracks.map((t, c) =>
          segsOf(grid[t.key]).map((s) => (
            <button
              key={t.key + s.from}
              className={'bdseg' + (s.task ? '' : ' blank') + (!s.task && t.key === 'benny' && s.from >= WAKE_FROM && s.to <= WAKE_TO ? ' bfree' : '')}
              style={{ gridRow: `${s.from + 2} / ${s.to + 2}`, gridColumn: c + 2, ...(s.task ? style(s.task, t.key) : {}) }}
              onClick={() => onEdit(t.key, s)}
            >
              {s.task ? label(s.task) : t.key === 'benny' && s.from >= WAKE_FROM && s.to <= WAKE_TO ? '待命' : ''}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

function SlotEditor({ init, grid, onClose, onSave, onManage }) {
  const [tab, setTab] = useState(() => (init.task ? catOf(init.task) : 'general'))
  const cats = catList()
  const [track, setTrack] = useState(init.track)
  const tr = TRACKS.find((t) => t.key === track)
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
    else if (k === 'flex') setPicked([...picked, k])
    else setPicked([...picked.filter((x) => x !== 'flex'), k].slice(-2).concat(picked.includes('flex') ? ['flex'] : [])) // 最多同時兩件事(彈性標記唔計,永遠排最尾)
  }
  const save = async (clearIt) => {
    if (to <= from) { setErr('「至」要遲過「由」'); return }
    setBusy(true); setErr('')
    const m = await onSave({ track, from, to, task: clearIt ? '' : picked.join('+'), oldFrom: init.isNew ? from : seg.from, oldTo: init.isNew ? to : seg.to })
    setBusy(false)
    if (m) setErr(m)
  }

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" style={{ '--c': tr.color }}>
        <div className="sheet-head">
          <h2>{tr.name} · {init.isNew ? '新增安排' : '改時段'}</h2>
          <button type="button" className="x" onClick={onClose} aria-label="關閉"><Icon n="x" /></button>
        </div>
        <div className="sheet-body">
          {init.isNew && (
            <div className="chips">
              {TRACKS.map((t) => (
                <button key={t.key} type="button" className={'chip' + (track === t.key ? ' on' : '')} onClick={() => setTrack(t.key)}>{t.name}</button>
              ))}
            </div>
          )}
          <div className="timepick">
            <label>由<select value={from} onChange={(e) => setFrom(+e.target.value)}>
              {Array.from({ length: 48 }, (_, i) => <option key={i} value={i}>{hm(i)}</option>)}
            </select></label>
            <label>至<select value={to} onChange={(e) => setTo(+e.target.value)}>
              {Array.from({ length: 48 }, (_, i) => i + 1).map((i) => <option key={i} value={i}>{endHm(i)}</option>)}
            </select></label>
          </div>
          <div className="pickhead">
            <b>揀任務</b><span className="muted">最多兩個,一齊做嘅事</span>
            <button type="button" className="rnbtn" onClick={() => onManage({ focus: tab })}>⚙ 任務庫</button>
          </div>
          {picked.length > 0 && <div className="pickedline">已揀:{label(picked.join('+'))}</div>}
          <div className="cattabs">
            {cats.map((c) => (
              <button key={c.key} type="button" className={'ctab' + (tab === c.key ? ' on' : '')} onClick={() => setTab(c.key)}><i>{c.e}</i><span>{c.n}</span></button>
            ))}
          </div>
          <div className="tilegrid">
            {[...tasksInCat(tab), ...picked.filter((k) => k !== 'flex' && !pickableTasks().includes(k) && catOf(k) === tab)]
              .map((k) => (
                <button key={k} type="button" className={'tile' + (picked.includes(k) ? ' on' : '')} style={{ '--tc': tcolor(k) }} onClick={() => toggle(k)}>
                  <i>{ticon(k)}</i><span>{tname(k)}</span>
                </button>
              ))}
            {picked.includes('flex') && <button type="button" className="tile on" style={{ '--tc': '#8da2b8' }} onClick={() => toggle('flex')}><i>〰️</i><span>取消「~ 大約」</span></button>}
            <button type="button" className="tile addtile" onClick={() => onManage({ start: { kind: 'task', key: 'x' + Date.now().toString(36), name: '', icon: '✨', cat: tab, isNew: true }, onSaved: (k) => setPicked((p) => [...p.filter((x) => x !== 'flex'), k].slice(-2).concat(p.includes('flex') ? ['flex'] : [])) })}><i>＋</i><span>新任務</span></button>
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
