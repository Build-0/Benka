import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import './trip.css'

// 公開行程頁(唔使登入):網址 #/t/<slug>。版面固定,內容全部來自 trips.data(JSON)。
// 版面會按內容自動調整:有圖 → 大圖編排;冇圖 → 文字版面;次要項目 → 精簡時間軸。
export const tripSlug = () => {
  const m = window.location.hash.match(/^#\/t\/([^/?]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

const mapUrl = (m) => {
  if (!m) return ''
  if (m.url) return m.url
  const q = m.lat != null && m.lng != null ? `${m.lat},${m.lng}` : m.q
  return q ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q) : ''
}

const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

// 圖片:載入失敗就顯示柔和底色 + 標題;相片來源放喺圖下面,唔遮住畫面
function Pic({ src, alt, credit, cls = '', ratio, pos }) {
  const [bad, setBad] = useState(false)
  if (!src) return null
  return (
    <figure className={'tp-fig ' + cls}>
      <div className="tp-img" style={ratio ? { aspectRatio: ratio } : undefined}>
        {bad ? <div className="tp-ph"><span>{alt}</span></div> : <img src={src} alt={alt || ''} loading="lazy" referrerPolicy="no-referrer" style={pos ? { objectPosition: pos } : undefined} onError={() => setBad(true)} />}
      </div>
      {credit && !bad && <figcaption>{credit}</figcaption>}
    </figure>
  )
}

const Verify = ({ show }) => (show ? <em className="tp-verify">待確認</em> : null)

const Links = ({ item }) => {
  const mu = mapUrl(item.map)
  const ls = item.links || []
  if (!mu && !ls.length) return null
  return (
    <p className="tp-act">
      {mu && <a href={mu} target="_blank" rel="noopener noreferrer">地圖 ↗</a>}
      {ls.map((l, i) => <a key={i} href={l.url} target="_blank" rel="noopener noreferrer">{l.label} ↗</a>)}
    </p>
  )
}

const Detail = ({ tips }) =>
  tips && tips.length ? (
    <details className="tp-more">
      <summary>詳細資料</summary>
      <ul>{tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
    </details>
  ) : null

// 重點項目:有圖 → 大圖 + 簡介;冇圖 → 文字重點
function Feature({ it }) {
  return (
    <article className={'tp-feat' + (it.image ? ' has-img' : '')}>
      <Pic src={it.image} alt={it.title} credit={it.credit} ratio="4 / 3" pos={it.pos} />
      <div className="tp-feat-b">
        <span className="tp-when">{it.time}{it.end ? ' – ' + it.end : ''}</span>
        <h3>{it.title}<Verify show={it.verify} /></h3>
        {it.text && <p>{it.text}</p>}
        <Links item={it} />
        <Detail tips={it.tips} />
      </div>
    </article>
  )
}

// 次要項目:精簡時間軸
function Timeline({ items }) {
  return (
    <ol className="tp-tl">
      {items.map((it, i) => (
        <li key={i}>
          <span className="tp-tl-t">{it.time}</span>
          <div>
            <b>{it.icon && <i>{it.icon}</i>}{it.title}<Verify show={it.verify} /></b>
            {it.text && <p>{it.text}</p>}
            <Links item={it} />
            <Detail tips={it.tips} />
          </div>
        </li>
      ))}
    </ol>
  )
}

const levelOf = (it) => it.level || (it.image ? 'feature' : 'minor')

// 連續嘅同類項目歸做一組,保持原本次序
const groupItems = (items) => {
  const out = []
  for (const it of items) {
    const feat = levelOf(it) === 'feature'
    const last = out[out.length - 1]
    if (feat) out.push({ feat: true, it })
    else if (last && !last.feat) last.items.push(it)
    else out.push({ feat: false, items: [it] })
  }
  return out
}

const dayImage = (day) => day.image || (day.items || []).find((x) => x.image)?.image || ''

function Day({ day, n, id }) {
  const img = dayImage(day)
  const heroItem = !day.image ? (day.items || []).find((x) => x.image) : null
  const gal = (day.gallery || []).filter((g) => g.image)
  const items = (day.items || []).filter((x) => !(heroItem && x === heroItem && !x.level))
  return (
    <section id={id} className="tp-day">
      <div className={'tp-dayhero' + (img ? '' : ' plain')}>
        {img && <Pic src={img} alt={day.title} ratio="4 / 5" pos={day.image ? day.pos : heroItem?.pos} />}
        <div className="tp-dayhero-t">
          <span>DAY {String(n).padStart(2, '0')}{day.date ? ' · ' + day.date : ''}</span>
          <h2>{day.theme || day.title}</h2>
          {day.theme && <small>{day.title}</small>}
        </div>
      </div>
      {(day.credit || (img && heroItem?.credit) || (day.image && day.credit)) && <p className="tp-cred">相片:{day.credit || heroItem?.credit}</p>}
      {day.intro && <p className="tp-lead">{day.intro}</p>}
      {gal.length > 0 && (
        <div className={'tp-mosaic m' + Math.min(gal.length, 3)}>
          {gal.slice(0, 3).map((g, i) => <Pic key={i} src={g.image} alt={g.caption || day.title} pos={g.pos} />)}
          <p className="tp-cred">{gal.slice(0, 3).map((g) => g.credit).filter(Boolean).join(' ‧ ')}</p>
        </div>
      )}
      <div className="tp-flow">
        {groupItems(items).map((g, i) => (g.feat ? <Feature key={i} it={g.it} /> : <Timeline key={i} items={g.items} />))}
      </div>
    </section>
  )
}

const money = (n, cur) => (n == null ? '待查' : (cur || '¥') + n.toLocaleString())

export default function TripPage({ slug }) {
  const [trip, setTrip] = useState(undefined)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    supabase.from('trips').select('slug,title,data,updated_at').eq('slug', slug).eq('published', true).maybeSingle()
      .then(({ data }) => { if (alive) setTrip(data || null) })
    return () => { alive = false }
  }, [slug])

  useEffect(() => { if (trip) document.title = trip.title }, [trip])

  if (trip === undefined) return <div className="tp-center">載入行程中…</div>
  if (trip === null) return <div className="tp-center">搵唔到呢個行程,或者未發布。</div>

  const d = trip.data || {}
  const cov = d.cover || {}
  const days = d.days || []
  // 分享用靜態預覽頁(有封面圖預覽卡),人打開會自動跳返呢頁
  const url = window.location.origin + window.location.pathname.replace(/[^/]*$/, '') + 't/' + slug + '/'
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: trip.title, url }); return } catch { /* 取消 */ } }
    window.open('https://wa.me/?text=' + encodeURIComponent(`${trip.title}\n${url}`), '_blank')
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* 忽略 */ }
  }

  // 亮點:所有大圖重點,最多 6 張,橫向捲動
  const highlights = days.flatMap((day, di) => [
    ...(day.image ? [{ src: day.image, label: day.theme || day.title, day: di, pos: day.pos }] : []),
    ...(day.items || []).filter((x) => x.image).map((x) => ({ src: x.image, label: x.title, day: di, pos: x.pos })),
  ]).slice(0, 6)

  const pending = [
    ...(d.checks || []),
  ]
  const total = (d.budget?.items || []).reduce((a, x) => a + (x.amount || 0), 0)
  const unknown = (d.budget?.items || []).some((x) => x.amount == null)

  return (
    <div className="trip">
      <header className={'tp-cover' + (cov.image ? '' : ' plain')}>
        {cov.image && <Pic src={cov.image} alt={trip.title} cls="tp-cover-img" pos={cov.pos} />}
        <div className="tp-cover-shade" />
        <div className="tp-cover-top">
          <button type="button" onClick={share}>WhatsApp 分享</button>
          <button type="button" onClick={copy}>{copied ? '已複製 ✓' : '複製連結'}</button>
        </div>
        <div className="tp-cover-t">
          {cov.tags && <div className="tp-tags">{cov.tags.map((t) => <span key={t}>{t}</span>)}</div>}
          <h1>{trip.title}</h1>
          {cov.subtitle && <p>{cov.subtitle}</p>}
        </div>
      </header>
      {cov.image && cov.credit && <p className="tp-cred tp-cred-cover">相片:{cov.credit}</p>}

      <div className="tp-wrap">
        {d.summary && (
          <dl className="tp-facts">
            {d.summary.map((s, i) => <div key={i}><dt>{s.label}</dt><dd>{s.value}</dd></div>)}
          </dl>
        )}

        {pending.length > 0 && (
          <details className="tp-pending">
            <summary>出發前仍有 {pending.length} 項資料要確認</summary>
            <ul>{pending.map((c, i) => <li key={i}>{c}</li>)}</ul>
          </details>
        )}

        {highlights.length >= 2 && (
          <section className="tp-hl">
            <h2 className="tp-h">行程亮點</h2>
            <div className="tp-hl-row">
              {highlights.map((h, i) => (
                <button key={i} type="button" onClick={() => go('tp-d' + (h.day + 1))}>
                  <Pic src={h.src} alt={h.label} ratio="3 / 4" pos={h.pos} />
                  <span>{h.label}</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      <nav className="tp-nav">
        {days.map((x, i) => <button key={i} type="button" onClick={() => go('tp-d' + (i + 1))}>Day {i + 1}</button>)}
        {d.hotel && <button type="button" onClick={() => go('tp-hotel')}>酒店</button>}
        {d.transport && d.transport.length > 0 && <button type="button" onClick={() => go('tp-tr')}>交通</button>}
        {d.budget && <button type="button" onClick={() => go('tp-budget')}>預算</button>}
      </nav>

      {days.map((day, i) => <Day key={i} day={day} n={i + 1} id={'tp-d' + (i + 1)} />)}

      <div className="tp-wrap">
        {d.hotel && (
          <section id="tp-hotel" className="tp-hotel">
            <span className="tp-kick">STAY</span>
            <h2>{d.hotel.name}<Verify show={d.hotel.verify} /></h2>
            {d.hotel.image && <Pic src={d.hotel.image} alt={d.hotel.name} credit={d.hotel.credit} ratio="16 / 10" pos={d.hotel.pos} />}
            {d.hotel.text && <p className="tp-lead">{d.hotel.text}</p>}
            {d.hotel.highlights && <ul className="tp-hi">{d.hotel.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul>}
            <Links item={{ map: d.hotel.map, links: d.hotel.links }} />
          </section>
        )}

        {d.transport && d.transport.length > 0 && (
          <section id="tp-tr" className="tp-sec">
            <h2 className="tp-h">交通</h2>
            {d.transport.map((t, i) => (
              <details key={i} className="tp-acc">
                <summary>{t.title}<Verify show={t.verify} /></summary>
                <div>
                  <Pic src={t.image} alt={t.title} credit={t.credit} ratio="16 / 9" pos={t.pos} />
                  {t.text && <p>{t.text}</p>}
                  {t.steps && <ol>{t.steps.map((s, k) => <li key={k}>{s}</li>)}</ol>}
                  <Links item={t} />
                </div>
              </details>
            ))}
          </section>
        )}

        {d.budget && (
          <section id="tp-budget" className="tp-sec">
            <h2 className="tp-h">預算</h2>
            <table className="tp-table">
              <tbody>
                {d.budget.items.map((x, i) => (
                  <tr key={i}>
                    <td>{x.label}{x.note && <small>{x.note}</small>}</td>
                    <td className={x.amount == null ? 'na' : ''}>{money(x.amount, d.budget.currency)}</td>
                  </tr>
                ))}
                {total > 0 && <tr className="sum"><td>已知小計{unknown ? '(未計「待查」項目)' : ''}</td><td>{money(total, d.budget.currency)}</td></tr>}
              </tbody>
            </table>
            {d.budget.note && <p className="tp-note">{d.budget.note}</p>}
          </section>
        )}

        {d.tips && d.tips.length > 0 && (
          <section className="tp-sec">
            <h2 className="tp-h">小提醒</h2>
            <ul className="tp-hi">{d.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </section>
        )}

        {d.links && d.links.length > 0 && (
          <section className="tp-sec">
            <h2 className="tp-h">有用連結</h2>
            <p className="tp-act">{d.links.map((l, i) => <a key={i} href={l.url} target="_blank" rel="noopener noreferrer">{l.label} ↗</a>)}</p>
          </section>
        )}

        <footer className="tp-foot">
          {d.sources && d.sources.length > 0 && (
            <details>
              <summary>資料來源</summary>
              <ul>{d.sources.map((s, i) => <li key={i}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a></li>)}</ul>
            </details>
          )}
          <p>票價、班次、開放時間可能更改,出發前請以官方公告為準。</p>
          {trip.updated_at && <p>更新於 {new Date(trip.updated_at).toLocaleDateString('zh-HK')}</p>}
        </footer>
      </div>
    </div>
  )
}
