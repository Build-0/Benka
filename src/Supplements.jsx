import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'

// 讀取照行 app 嘅保健品清單(同一個 supplements 表,只睇啟用中、只顯示品名同劑量)
export default function Supplements() {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    supabase
      .from('supplements')
      .select('id, name, dose_text')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data, error }) => {
        if (error) { setErr(error.message); setRows([]) } else setRows(data)
      })
  }, [])

  return (
    <>
      <div className="head">
        <div>
          <h1>保健品</h1>
          <div className="muted">{rows ? `共 ${rows.length} 項` : '載入中…'}</div>
        </div>
      </div>
      {err && <div className="card errbox">讀取失敗:{err}</div>}
      <div className="card list">
        {(rows || []).map((r) => (
          <div key={r.id} className="row">
            <span>{r.name}</span>
            <span className="muted">{r.dose_text || '—'}</span>
          </div>
        ))}
      </div>
    </>
  )
}
