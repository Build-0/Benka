import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'

// 時間軸:由起床到睡前,每個時段一粒色點 + 該時段要食嘅品名同劑量
const SLOTS = [
  { key: 'wake', label: '起床', color: '#6b9bd1', icon: 'ti-sunrise' },
  { key: 'morning', label: '早上', color: '#3f7fbf', icon: 'ti-sun' },
  { key: 'noon', label: '中午', color: '#2f9e9a', icon: 'ti-sun-high' },
  { key: 'evening', label: '晚上', color: '#5a6fc0', icon: 'ti-sunset-2' },
  { key: 'bedtime', label: '睡前', color: '#6a58a8', icon: 'ti-moon' },
]

// 讀取照行 app 嘅保健品清單(同一個 supplements 表,只睇啟用中、只顯示品名同劑量)
export default function Supplements() {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    supabase
      .from('supplements')
      .select('id, name, dose_text, time_slots')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data, error }) => {
        if (error) { setErr(error.message); setRows([]) } else setRows(data)
      })
  }, [])

  const groups = SLOTS
    .map((s) => ({ ...s, items: (rows || []).filter((r) => (r.time_slots || []).includes(s.key)) }))
    .filter((g) => g.items.length)

  return (
    <>
      <div className="head">
        <div>
          <h1>保健品</h1>
          <div className="muted">{rows ? `共 ${rows.length} 項` : '載入中…'}</div>
        </div>
      </div>
      {err && <div className="card errbox">讀取失敗:{err}</div>}

      <div className="tl">
        {groups.map((g) => (
          <section key={g.key} className="tl-item" style={{ '--c': g.color }}>
            <span className="tl-dot" />
            <div className="tl-head">
              <i className={'ti ' + g.icon} aria-hidden="true" />
              <b>{g.label}</b>
              <span className="tl-n">{g.items.length} 種</span>
            </div>
            <div className="tl-card">
              {g.items.map((r) => (
                <div key={r.id} className="tl-row">
                  <span>{r.name}</span>
                  <span className="dose">{r.dose_text || '—'}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  )
}
