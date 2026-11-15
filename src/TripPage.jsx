import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase.js'
import './trip.css'

// 公開行程頁(唔使登入):網址 #/t/<slug>。版面固定,內容全部來自 trips.data(JSON)。
// 版面按內容自動調整:有圖 → 大圖編排;冇圖 → 文字版面;次要項目 → 精簡時間軸;一日或多日、圖多圖少都適用。
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

// 有座標就用 OpenStreetMap 內嵌小地圖(免金鑰,所有手機都開到)
const osmEmbed = (m) => {
  if (!m || m.lat == null || m.lng == null) return ''
  const d = 0.007
  return `https://www.openstreetmap.org/export/embed.html?bbox=${m.lng - d},${m.lat - d * 0.7},${m.lng + d},${m.lat + d * 0.7}&layer=mapnik&marker=${m.lat},${m.lng}`
}
// 圖下面嘅相片說明用精簡版;完整來源(連同「Wikimedia Commons」等)集中放喺詳細資訊
const shortCredit = (c) => String(c || '').replace(/\s*\/\s*(Wikimedia Commons|Pexels|Unsplash|Pixabay)/i, '')
const isTbd = (v) => /待定|待確認|待查/.test(String(v))

const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

const BASE = window.location.origin + window.location.pathname.replace(/[^/]*$/, '')
let IMGMAP = {}
let mapP
// 建置時 gen-share.mjs 會將行程相片鏡像到 trip-img/,map.json 係「原網址 → 本站副本」
const loadImgMap = () => (mapP ||= fetch(BASE + 'trip-img/map.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((m) => { IMGMAP = m }))

// 同一張相只出現一次(封面 → 每日 → 項目 → 酒店 → 交通),重複嘅自動拎走,版面唔會見到同一張圖反覆出現
function dedupeImages(d) {
  const c = JSON.parse(JSON.stringify(d || {}))
  const seen = new Set()
  const take = (o) => {
    if (!o || !o.image) return
    if (seen.has(o.image)) { delete o.image; delete o.credit } else seen.add(o.image)
  }
  take(c.cover)
  for (const day of c.days || []) {
    take(day)
    for (const g of day.gallery || []) take(g)
    for (const it of day.items || []) take(it)
  }
  take(c.hotel)
  for (const t of c.transport || []) take(t)
  return c
}

// 圖片:先用本站副本 → 失敗退返原網址 → 再失敗顯示柔和底色 + 標題;相片來源放喺圖下面,唔遮住畫面
// 冇指定 pos 時按相片方向自動揀裁切:直幅放入橫框 → 取偏上(人物、建築通常喺上半部);橫幅放入直框 → 取中間
function Pic({ src, alt, credit, cls = '', ratio, pos }) {
  const [bad, setBad] = useState(false)
  const [cur, setCur] = useState(() => (src && IMGMAP[src] ? BASE + IMGMAP[src] : src))
  const [auto, setAuto] = useState('')
  if (!src) return null
  const slotW = ratio ? (() => { const [a, b] = String(ratio).split('/').map(Number); return b ? a / b : 0 })() : 0
  const onLoad = (e) => {
    if (pos) return
    const im = e.currentTarget
    const ir = im.naturalWidth / im.naturalHeight
    if (slotW && ir < slotW) setAuto('50% 30%')
  }
  return (
    <figure className={'tp-fig ' + cls}>
      <div className="tp-img" style={ratio ? { aspectRatio: ratio } : undefined}>
        {bad ? <div className="tp-ph"><span>{alt}</span></div> : <img src={cur} alt={alt || ''} loading="lazy" referrerPolicy="no-referrer" style={pos || auto ? { objectPosition: pos || auto } : undefined} onLoad={onLoad} onError={() => (cur !== src ? setCur(src) : setBad(true))} />}
      </div>
      {credit && !bad && <figcaption>{shortCredit(credit)}</figcaption>}
    </figure>
  )
}

const Verify = ({ show }) => (show ? <em className="tp-verify">待確認</em> : null)

const RATIOS = { wide: '16 / 9', standard: '3 / 2', square: '1 / 1', tall: '4 / 5' }
const ratioOf = (r, d) => RATIOS[r] || r || d

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

// 核心體驗(importance 3):大圖 + 簡介;多個核心項目會交替「全幅」同「縮入」兩種排法,版面有節奏
function Feature({ it, alt }) {
  return (
    <article className={'tp-feat' + (it.image ? ' has-img' : '') + (alt ? ' inset' : '')}>
      <Pic src={it.image} alt={it.title} credit={it.credit} ratio={ratioOf(it.ratio, alt ? '4 / 5' : '3 / 2')} pos={it.pos} />
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

// 次重點(importance 2):小圖喺左、文字喺右,唔佔成個畫面
function Compact({ it }) {
  return (
    <article className={'tp-cmp' + (it.image ? ' has-img' : '')}>
      {it.image && <Pic src={it.image} alt={it.title} ratio={ratioOf(it.ratio, '1 / 1')} pos={it.pos} />}
      <div className="tp-cmp-b">
        <span className="tp-when">{it.time}{it.end ? ' – ' + it.end : ''}</span>
        <h3>{it.title}<Verify show={it.verify} /></h3>
        {it.text && <p>{it.text}</p>}
        <Links item={it} />
        <Detail tips={it.tips} />
        {it.image && it.credit && <small className="tp-cmp-c">相片:{shortCredit(it.credit)}</small>}
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

// kind: core 核心體驗 | transport 交通 | meal 餐飲 | note 注意事項
// importance: 3 大圖 | 2 小圖並排 | 1 精簡時間軸(冇寫就按 level / kind / 有冇相自動揀)
const importanceOf = (it) => {
  if (it.importance) return it.importance
  if (it.level === 'feature') return 3
  if (it.level === 'minor') return 1
  if (['transport', 'meal', 'note'].includes(it.kind)) return 1
  return it.image ? 3 : 1
}

// 連續嘅精簡項目歸做一組,保持原本次序;核心項目記低次序用嚟交替排法
const groupItems = (items) => {
  const out = []
  let f = 0
  for (const it of items) {
    const imp = importanceOf(it)
    const last = out[out.length - 1]
    if (imp >= 3) out.push({ kind: 'feat', it, alt: f++ % 2 === 1 })
    else if (imp === 2) out.push({ kind: 'cmp', it })
    else if (last && last.kind === 'tl') last.items.push(it)
    else out.push({ kind: 'tl', items: [it] })
  }
  return out
}

const dayImage = (day) => day.image || (day.items || []).find((x) => x.image)?.image || ''

function Day({ day, n, id }) {
  const img = dayImage(day)
  const all = day.items || []
  // 冇指定 day.image 時,借第一個有圖項目嘅相做每日封面;項目本身照常顯示(時間、介紹、地圖),只係唔再重複放同一張圖
  const heroItem = !day.image ? all.find((x) => x.image) : null
  const heroCredit = day.image ? day.credit : heroItem?.credit
  const gal = (day.gallery || []).filter((g) => g.image)
  const items = all.map((x) => (x === heroItem ? { ...x, importance: importanceOf(x), image: undefined, credit: undefined } : x))
  return (
    <section id={id} className="tp-day">
      <div className="tp-day-head">
        <div className={'tp-dayhero' + (img ? '' : ' plain')}>
          {img && <Pic src={img} alt={day.title} ratio={ratioOf(day.ratio, '3 / 2')} pos={day.image ? day.pos : heroItem?.pos} />}
          <div className="tp-dayhero-t">
            <span className="tp-daynum">{String(n).padStart(2, '0')}</span>
            <span className="tp-daydate">DAY {n}{day.date ? ' · ' + day.date : ''}</span>
            <h2>{day.theme || day.title}</h2>
            {day.theme && <small>{day.title}</small>}
          </div>
        </div>
        {img && heroCredit && <p className="tp-cred">相片:{shortCredit(heroCredit)}</p>}
        {day.intro && <p className="tp-lead">{day.intro}</p>}
        {gal.length > 0 && (
          <div className={'tp-mosaic m' + Math.min(gal.length, 3)}>
            {gal.slice(0, 3).map((g, i) => <Pic key={i} src={g.image} alt={g.caption || day.title} pos={g.pos} />)}
            <p className="tp-cred">{gal.slice(0, 3).map((g) => shortCredit(g.credit)).filter(Boolean).join(' ‧ ')}</p>
          </div>
        )}
      </div>
      <div className="tp-flow">
        {groupItems(items).map((g, i) => (g.kind === 'feat' ? <Feature key={i} it={g.it} alt={g.alt} /> : g.kind === 'cmp' ? <Compact key={i} it={g.it} /> : <Timeline key={i} items={g.items} />))}
      </div>
    </section>
  )
}

const money = (n, cur) => (n == null ? '待查' : (cur || '¥') + n.toLocaleString())

// 第一層:一頁睇晒全程(每日主題 + 主要安排、酒店、交通、預算),每行撳入去跳到該位置。純文字,唔重複放相
function Overview({ d }) {
  const days = d.days || []
  const keyTitles = (day) => (day.items || []).filter((x) => importanceOf(x) >= 2).map((x) => x.title).slice(0, 3).join(' · ')
  const rows = [
    ...days.map((day, i) => ({ id: 'tp-d' + (i + 1), k: String(i + 1).padStart(2, '0'), t: day.theme || day.title, s: keyTitles(day) || day.title })),
    ...(d.hotel ? [{ id: 'tp-hotel', k: '宿', t: d.hotel.name, s: (d.hotel.highlights || [])[0] || d.hotel.text || '' }] : []),
  ]
  return (
    <section id="tp-ov" className="tp-ov">
      <h2 className="tp-h">旅程一覽</h2>
      <ol>
        {rows.map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => go(r.id)}>
              <span className="tp-ov-k">{r.k}</span>
              <span className="tp-ov-t"><b>{r.t}</b>{r.s && <small>{r.s}</small>}</span>
              <i>›</i>
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}

// 導航:貼頂;捲到邊度就標示邊個,並自動將標示項移入視野
function Nav({ items }) {
  const [active, setActive] = useState(items[0]?.id)
  useEffect(() => {
    const els = items.map((x) => document.getElementById(x.id)).filter(Boolean)
    if (!els.length || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver((es) => {
      const vis = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (vis) setActive(vis.target.id)
    }, { rootMargin: '-30% 0px -60% 0px' })
    els.forEach((e) => io.observe(e))
    return () => io.disconnect()
  }, [items])
  // 只橫向捲動導航列本身,唔會郁到成個頁面
  useEffect(() => {
    const nav = document.querySelector('.tp-nav')
    const btn = nav && nav.querySelector('button.on')
    if (nav && btn) nav.scrollTo({ left: btn.offsetLeft - (nav.clientWidth - btn.clientWidth) / 2, behavior: 'smooth' })
  }, [active])
  return (
    <nav className="tp-nav" aria-label="行程導航">
      {items.map((x) => <button key={x.id} type="button" className={active === x.id ? 'on' : ''} onClick={() => go(x.id)}>{x.label}</button>)}
    </nav>
  )
}

export default function TripPage({ slug }) {
  const [st, setSt] = useState({ s: 'loading' }) // loading | ok | missing | error
  const [tick, setTick] = useState(0)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    setSt({ s: 'loading' })
    ;(async () => {
      let last = ''
      for (let a = 0; a < 3; a++) {
        try {
          // 匿名用戶只見到已發布行程;登入嘅主人亦見到自己嘅草稿(RLS 控制)
          const [{ data, error }] = await Promise.all([
            supabase.from('trips').select('slug,title,data,updated_at,published').eq('slug', slug).maybeSingle(),
            loadImgMap(),
          ])
          if (!alive) return
          if (!error) { setSt(data ? { s: 'ok', trip: data } : { s: 'missing' }); return }
          last = error.message
        } catch (e) { last = e.message }
        if (a < 2) await new Promise((r) => setTimeout(r, 900 * (a + 1)))
      }
      if (alive) setSt({ s: 'error', msg: last })
    })()
    return () => { alive = false }
  }, [slug, tick])

  const trip = st.s === 'ok' ? st.trip : null
  useEffect(() => { if (trip) document.title = trip.title }, [trip])
  const d = useMemo(() => dedupeImages(trip?.data), [trip])

  if (st.s === 'loading') return <div className="tp-center">載入行程中…</div>
  if (st.s === 'missing') return <div className="tp-center"><div><p>搵唔到呢個行程。</p><p className="tp-sub">網址可能有誤,或者行程仲未公開。</p></div></div>
  if (st.s === 'error') return (
    <div className="tp-center"><div>
      <p>載入行程失敗,可能係網絡問題。</p>
      <p className="tp-sub">{st.msg}</p>
      <button type="button" className="tp-retry" onClick={() => setTick((x) => x + 1)}>重試</button>
    </div></div>
  )

  const cov = d.cover || {}
  const days = d.days || []
  // 標題有「｜」就分做小標 + 主標,斷行自然啲
  const tparts = trip.title.split(/\s*[｜|]\s*/)
  // 分享用靜態預覽頁(有封面圖預覽卡),人打開會自動跳返呢頁
  const url = window.location.origin + window.location.pathname.replace(/[^/]*$/, '') + 't/' + slug + '/'
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: trip.title, url }); return } catch { /* 取消 */ } }
    window.open('https://wa.me/?text=' + encodeURIComponent(`${trip.title}\n${url}`), '_blank')
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* 忽略 */ }
  }
  const total = (d.budget?.items || []).reduce((a, x) => a + (x.amount || 0), 0)
  const unknown = (d.budget?.items || []).some((x) => x.amount == null)
  const factsShown = (d.summary || []).filter((s) => !isTbd(s.value))
  const pending = [...(d.checks || []), ...(d.summary || []).filter((s) => isTbd(s.value)).map((s) => `${s.label}:${s.value}`)]
  // 相片來源清單(完整授權資訊),收埋喺詳細資訊
  const credits = []
  const addCr = (where, o) => { if (o && o.image && o.credit) credits.push({ where, credit: o.credit }) }
  addCr('封面', cov)
  days.forEach((day, i) => { addCr(`Day ${i + 1}`, day); (day.gallery || []).forEach((g) => addCr(`Day ${i + 1}`, g)); (day.items || []).forEach((it) => addCr(`Day ${i + 1}・${it.title}`, it)) })
  addCr('酒店', d.hotel)
  ;(d.transport || []).forEach((t) => addCr(`交通・${t.title}`, t))
  const navItems = [
    { id: 'tp-ov', label: '一覽' },
    ...days.map((_, i) => ({ id: 'tp-d' + (i + 1), label: 'Day ' + (i + 1) })),
    ...(d.hotel ? [{ id: 'tp-hotel', label: '酒店' }] : []),
    ...((d.transport || []).length ? [{ id: 'tp-tr', label: '交通' }] : []),
    ...(d.budget ? [{ id: 'tp-budget', label: '預算' }] : []),
  ]
  // 每個行程可以有自己嘅主色(cover.accent)同深色(cover.dark),冇寫就用預設
  const theme = {}
  if (cov.accent) theme['--coral'] = cov.accent
  if (cov.dark) theme['--navy'] = cov.dark

  return (
    <div className="trip" style={theme}>
      {trip.published === false && <div className="tp-draft">草稿預覽 · 未公開,只有你登入後睇到</div>}
      <header className={'tp-cover' + (cov.image ? '' : ' plain')}>
        {cov.image && <Pic src={cov.image} alt={trip.title} cls="tp-cover-img" pos={cov.pos} />}
        <div className="tp-cover-shade" />
        <div className="tp-cover-top">
          <button type="button" onClick={share}>WhatsApp 分享</button>
          <button type="button" onClick={copy}>{copied ? '已複製 ✓' : '複製連結'}</button>
        </div>
        <div className="tp-cover-t">
          {cov.tags && <div className="tp-tags">{cov.tags.map((t) => <span key={t}>{t}</span>)}</div>}
          <h1>{tparts.length > 1 && <small className="tp-kicker">{tparts[0]}</small>}<span>{tparts.length > 1 ? tparts.slice(1).join(' · ') : trip.title}</span></h1>
          {cov.subtitle && <p>{cov.subtitle}</p>}
        </div>
      </header>
      {cov.image && cov.credit && <p className="tp-cred tp-cred-cover">相片:{shortCredit(cov.credit)}</p>}

      <div className="tp-wrap">
        {factsShown.length > 0 && (
          <dl className="tp-facts">
            {factsShown.map((s, i) => <div key={i}><dt>{s.label}</dt><dd>{s.value}</dd></div>)}
          </dl>
        )}
        <Overview d={d} />
      </div>

      <Nav items={navItems} />

      {days.map((day, i) => <Day key={i} day={day} n={i + 1} id={'tp-d' + (i + 1)} />)}

      <div className="tp-wrap">
        {d.hotel && (
          <section id="tp-hotel" className="tp-hotel">
            <div className="tp-hotel-a">
              <span className="tp-kick">STAY</span>
              <h2>{d.hotel.name}<Verify show={d.hotel.verify} /></h2>
              {d.hotel.image && <Pic src={d.hotel.image} alt={d.hotel.name} credit={d.hotel.credit} ratio="16 / 10" pos={d.hotel.pos} />}
              {d.hotel.text && <p className="tp-lead">{d.hotel.text}</p>}
              <Links item={{ map: d.hotel.map, links: d.hotel.links }} />
              {osmEmbed(d.hotel.map) && <iframe className="tp-map" title="酒店位置" loading="lazy" src={osmEmbed(d.hotel.map)} />}
            </div>
            {d.hotel.highlights && d.hotel.highlights.length > 0 && (
              <ul className="tp-tiles">{d.hotel.highlights.map((h, i) => <li key={i}><span>{String(i + 1).padStart(2, '0')}</span>{h}</li>)}</ul>
            )}
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
            <h2 className="tp-h">預算{d.budget.items.every((x) => x.amount == null) ? '(價格待核實)' : ''}</h2>
            {d.budget.items.every((x) => x.amount == null) ? (
              <ul className="tp-bud">
                {d.budget.items.map((x, i) => <li key={i}><span>{x.label}</span>{x.note && <small>{x.note}</small>}</li>)}
              </ul>
            ) : (
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
            )}
            {d.budget.note && <p className="tp-note">{d.budget.note}</p>}
          </section>
        )}

        {/* 第三層:詳細資訊全部收埋,要睇先展開 */}
        {(pending.length > 0 || (d.tips || []).length > 0 || (d.links || []).length > 0 || (d.sources || []).length > 0 || credits.length > 0) && (
          <section className="tp-sec tp-l3">
            <h2 className="tp-h">詳細資訊</h2>
            {pending.length > 0 && (
              <details className="tp-acc"><summary>待確認事項<em className="tp-count">{pending.length}</em></summary><div><ul>{pending.map((c, i) => <li key={i}>{c}</li>)}</ul></div></details>
            )}
            {(d.tips || []).length > 0 && (
              <details className="tp-acc"><summary>小提醒<em className="tp-count">{d.tips.length}</em></summary><div><ul>{d.tips.map((t, i) => <li key={i}>{t}</li>)}</ul></div></details>
            )}
            {(d.links || []).length > 0 && (
              <details className="tp-acc"><summary>有用連結<em className="tp-count">{d.links.length}</em></summary><div><p className="tp-act">{d.links.map((l, i) => <a key={i} href={l.url} target="_blank" rel="noopener noreferrer">{l.label} ↗</a>)}</p></div></details>
            )}
            {credits.length > 0 && (
              <details className="tp-acc"><summary>相片來源<em className="tp-count">{credits.length}</em></summary><div><ul>{credits.map((c, i) => <li key={i}><b>{c.where}</b>:{c.credit}</li>)}</ul></div></details>
            )}
            {(d.sources || []).length > 0 && (
              <details className="tp-acc"><summary>資料來源<em className="tp-count">{d.sources.length}</em></summary><div><ul>{d.sources.map((s, i) => <li key={i}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a></li>)}</ul></div></details>
            )}
          </section>
        )}

        <footer className="tp-foot">
          <p>票價、班次、開放時間可能更改,出發前請以官方公告為準。</p>
          {trip.updated_at && <p>更新於 {new Date(trip.updated_at).toLocaleDateString('zh-HK')}</p>}
        </footer>
      </div>
    </div>
  )
}
