import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import './trip.css'

// 公開行程頁(唔使登入):網址 #/t/<slug>。版面固定,內容全部來自 trips.data(JSON)。
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

const osmEmbed = (m) => {
  if (!m || m.lat == null || m.lng == null) return ''
  const d = 0.006
  return `https://www.openstreetmap.org/export/embed.html?bbox=${m.lng - d},${m.lat - d},${m.lng + d},${m.lat + d}&layer=mapnik&marker=${m.lat},${m.lng}`
}

const Photo = ({ src, credit, alt, cls }) => {
  if (!src) return null
  return (
    <figure className={'tp-photo ' + (cls || '')}>
      <img src={src} alt={alt || ''} loading="lazy" referrerPolicy="no-referrer" />
      {credit && <figcaption>{credit}</figcaption>}
    </figure>
  )
}

const Links = ({ links }) =>
  links && links.length ? (
    <div className="tp-links">
      {links.map((l, i) => (
        <a key={i} href={l.url} target="_blank" rel="noopener noreferrer">{l.label}</a>
      ))}
    </div>
  ) : null

const Verify = ({ show }) => (show ? <span className="tp-verify">待確認</span> : null)

function Item({ it }) {
  const mu = mapUrl(it.map)
  return (
    <li className="tp-item">
      <div className="tp-time">
        <b>{it.time}</b>
        {it.end && <span>{it.end}</span>}
      </div>
      <div className="tp-dot"><i>{it.icon || '•'}</i></div>
      <div className="tp-card">
        <Photo src={it.image} credit={it.credit} alt={it.title} />
        <h4>{it.title}<Verify show={it.verify} /></h4>
        {it.text && <p>{it.text}</p>}
        {it.tips && it.tips.length > 0 && <ul className="tp-mini">{it.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>}
        <div className="tp-links">
          {mu && <a href={mu} target="_blank" rel="noopener noreferrer">📍 地圖</a>}
          {(it.links || []).map((l, i) => <a key={i} href={l.url} target="_blank" rel="noopener noreferrer">{l.label}</a>)}
        </div>
      </div>
    </li>
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
  const url = window.location.href
  const share = async () => {
    const text = `${trip.title}\n${url}`
    if (navigator.share) { try { await navigator.share({ title: trip.title, url }); return } catch { /* 取消 */ } }
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank')
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* 忽略 */ }
  }
  const total = (d.budget?.items || []).reduce((a, x) => a + (x.amount || 0), 0)
  const unknown = (d.budget?.items || []).some((x) => x.amount == null)

  return (
    <div className="trip">
      <header className="tp-hero" style={cov.image ? { backgroundImage: `linear-gradient(180deg, rgba(10,25,45,.15), rgba(10,25,45,.78)), url("${cov.image}")` } : undefined}>
        <div className="tp-hero-in">
          {cov.tags && <div className="tp-tags">{cov.tags.map((t) => <span key={t}>{t}</span>)}</div>}
          <h1>{trip.title}</h1>
          {cov.subtitle && <p>{cov.subtitle}</p>}
          {cov.dates && <div className="tp-dates">{cov.dates}</div>}
        </div>
        {cov.credit && <small className="tp-credit">{cov.credit}</small>}
      </header>

      <div className="tp-wrap">
        <div className="tp-share">
          <button type="button" className="wa" onClick={share}>WhatsApp 分享</button>
          <button type="button" onClick={copy}>{copied ? '已複製 ✓' : '複製連結'}</button>
        </div>

        {d.summary && (
          <section className="tp-sum">
            {d.summary.map((s, i) => (
              <div key={i}><span>{s.label}</span><b>{s.value}</b></div>
            ))}
          </section>
        )}

        {d.checks && d.checks.length > 0 && (
          <section className="tp-check">
            <h3>出發前要確認</h3>
            <ul>{d.checks.map((c, i) => <li key={i}>{c}</li>)}</ul>
          </section>
        )}

        <nav className="tp-nav">
          {(d.days || []).map((x, i) => <a key={i} href={'#/t/' + slug + '/d' + (i + 1)} onClick={(e) => { e.preventDefault(); document.getElementById('tp-d' + (i + 1))?.scrollIntoView({ behavior: 'smooth' }) }}>{x.label}</a>)}
          {d.hotel && <a href="#hotel" onClick={(e) => { e.preventDefault(); document.getElementById('tp-hotel')?.scrollIntoView({ behavior: 'smooth' }) }}>酒店</a>}
          {d.budget && <a href="#budget" onClick={(e) => { e.preventDefault(); document.getElementById('tp-budget')?.scrollIntoView({ behavior: 'smooth' }) }}>預算</a>}
        </nav>

        {(d.days || []).map((day, i) => (
          <section key={i} id={'tp-d' + (i + 1)} className="tp-day">
            <div className="tp-dayhead">
              <span>{day.label}</span>
              <h2>{day.title}</h2>
              {day.date && <small>{day.date}</small>}
            </div>
            {day.intro && <p className="tp-intro">{day.intro}</p>}
            <ol className="tp-line">{(day.items || []).map((it, k) => <Item key={k} it={it} />)}</ol>
          </section>
        ))}

        {d.hotel && (
          <section id="tp-hotel" className="tp-block">
            <h2>住喺邊</h2>
            <Photo src={d.hotel.image} credit={d.hotel.credit} alt={d.hotel.name} />
            <h3>{d.hotel.name}<Verify show={d.hotel.verify} /></h3>
            {d.hotel.text && <p>{d.hotel.text}</p>}
            {d.hotel.highlights && <ul className="tp-mini">{d.hotel.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul>}
            {d.hotel.map && osmEmbed(d.hotel.map) && <iframe className="tp-map" title="地圖" src={osmEmbed(d.hotel.map)} loading="lazy" />}
            <div className="tp-links">
              {mapUrl(d.hotel.map) && <a href={mapUrl(d.hotel.map)} target="_blank" rel="noopener noreferrer">📍 Google 地圖</a>}
              {(d.hotel.links || []).map((l, i) => <a key={i} href={l.url} target="_blank" rel="noopener noreferrer">{l.label}</a>)}
            </div>
          </section>
        )}

        {d.transport && d.transport.length > 0 && (
          <section className="tp-block">
            <h2>交通</h2>
            {d.transport.map((t, i) => (
              <div key={i} className="tp-tr">
                <h3>{t.title}<Verify show={t.verify} /></h3>
                {t.text && <p>{t.text}</p>}
                {t.steps && <ol className="tp-mini">{t.steps.map((s, k) => <li key={k}>{s}</li>)}</ol>}
                <Links links={t.links} />
              </div>
            ))}
          </section>
        )}

        {d.budget && (
          <section id="tp-budget" className="tp-block">
            <h2>預算</h2>
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
          <section className="tp-block">
            <h2>小提醒</h2>
            <ul className="tp-mini">{d.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </section>
        )}

        {d.links && d.links.length > 0 && (
          <section className="tp-block">
            <h2>有用連結</h2>
            <Links links={d.links} />
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
