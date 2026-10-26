import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import { cget, cset } from './cache.js'
import Icon from './Icon.jsx'

const SLOTS = [
  { key: 'wake', label: '起床', color: '#6b9bd1', icon: 'sunrise' },
  { key: 'morning', label: '早上', color: '#3f7fbf', icon: 'sun' },
  { key: 'noon', label: '中午', color: '#2f9e9a', icon: 'sun-high' },
  { key: 'evening', label: '晚上', color: '#5a6fc0', icon: 'sunset-2' },
  { key: 'bedtime', label: '睡前', color: '#6a58a8', icon: 'moon' },
]
const TABS = [{ key: 'all', label: '全部', color: '#2f4a6b', icon: 'layout-grid' }, ...SLOTS]

// 讀取照行 app 嘅保健品清單(同一個 supplements 表,只睇啟用中、只顯示品名同劑量)
export default function Supplements() {
  const [rows, setRows] = useState(() => cget('supp'))
  const [err, setErr] = useState('')
  const [slot, setSlot] = useState(() => cget('supp-slot') || 'all')
  const pick = (k) => { setSlot(k); cset('supp-slot', k) }

  useEffect(() => {
    supabase
      .from('supplements')
      .select('id, name, dose_text, time_slots')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data, error }) => {
        if (error) { setErr(error.message); setRows((r) => r || []) } else { setRows(data); cset('supp', data) }
      })
  }, [])

  const inSlot = (k) => (rows || []).filter((r) => (r.time_slots || []).includes(k))
  const shown = slot === 'all' ? SLOTS : SLOTS.filter((s) => s.key === slot)
  const cur = TABS.find((s) => s.key === slot)
  const total = (rows || []).length

  return (
    <>
      <div className="head">
        <div>
          <h1>保健品</h1>
          <div className="muted">{rows ? `共 ${total} 項${slot === 'all' ? '' : ` · ${cur.label} ${inSlot(slot).length} 種`}` : '載入中…'}</div>
        </div>
      </div>
      {err && <div className="card errbox">讀取失敗:{err}</div>}

      <div className="seg" role="tablist">
        {TABS.map((s) => (
          <button key={s.key} role="tab" aria-selected={slot === s.key} className={'sg' + (slot === s.key ? ' on' : '')} style={{ '--c': s.color }} onClick={() => pick(s.key)}>
            <Icon n={s.icon} />
            {s.label}
            <span className="n">{s.key === 'all' ? total : inSlot(s.key).length}</span>
          </button>
        ))}
      </div>

      {rows && total === 0 && <div className="empty muted">未有保健品。</div>}

      {shown.map((s) => {
        const items = inSlot(s.key)
        if (!items.length) return null
        return (
          <section key={s.key} style={{ '--c': s.color }}>
            {slot === 'all' && (
              <div className="grp"><Icon n={s.icon} />{s.label}<span className="gn">{items.length} 種</span></div>
            )}
            <div className="tiles">
              {items.map((r) => (
                <div key={r.id} className="tile">
                  <div className="pill"><Icon n="pill" /></div>
                  <b>{r.name}</b>
                  <span className="dose">{r.dose_text || '—'}</span>
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </>
  )
}
