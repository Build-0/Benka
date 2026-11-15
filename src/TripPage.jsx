import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase.js'
import './trip.css'

// 公開行程頁(唔使登入):網址 #/t/<slug>。版面固定,內容全部來自 trips.data(JSON)。
// 定位:資訊清晰嘅旅行手冊 —— 文字同時間表為主,相片只係點綴(細圖),唔用全幅大圖。
// 次序:標題+封面 → 摘要(住宿/景點/交通) → 每日時間表 → 交通+地圖 → 酒店 → 預算 → 出發前確認+資料來源
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
// 圖下面嘅相片說明用精簡版;完整來源(連同「Wikimedia Commons」等)集中放喺「相片來源」
const shortCredit = (c) => String(c || '').replace(/\s*\/\s*(Wikimedia Commons|Pexels|Unsplash|Pixabay)/i, '')
const isTbd = (v) => /待定|待確認|待查/.test(String(v))

const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

const BASE = window.location.origin + window.location.pathname.replace(/[^/]*$/, '')
let IMGMAP = {}
let mapP
// 建置時 gen-share.mjs 會將行程相片鏡像到 trip-img/,map.json 係「原網址 → 本站副本」
const loadImgMap = () => (mapP ||= fetch(BASE + 'trip-img/map.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((m) => { IMGMAP = m }))

// 同一張相只出現一次(封面 → 每日 → 項目 → 酒店 → 交通),重複嘅自動拎走
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

// 圖片:先用本站副本 → 失敗退返原網址 → 再失敗顯示柔和底色 + 標題
// 冇指定 pos 時按相片方向自動揀裁切:直幅放入橫框 → 取偏上;橫幅放入直框 → 取中間
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

// 「詳細」:較長介紹、注意事項、連結全部收埋,撳開先見
const SHORT = 44
function Detail({ text, tips, item }) {
  const mu = mapUrl(item.map)
  const ls = item.links || []
  if (!text && !(tips && tips.length) && !mu && !ls.length) return null
  return (
    <details className="tp-more">
      <summary>詳細</summary>
      {text && <p>{text}</p>}
      {tips && tips.length > 0 && <ul>{tips.map((t, i) => <li key={i}>{t}</li>)}</ul>}
      <Links item={item} />
    </details>
  )
}

// kind: core 核心體驗 | transport 交通 | meal 餐飲 | note 注意事項
// importance: 3 主要(粗體 + 有相就顯示縮圖) | 2 次要(有相就顯示縮圖) | 1 一般
const importanceOf = (it) => {
  if (it.importance) return it.importance
  if (it.level === 'feature') return 3
  if (it.level === 'minor') return 1
  if (['transport', 'meal', 'note'].includes(it.kind)) return 1
  return it.image ? 3 : 1
}

// 時間表一行:左邊時間、右邊活動名稱 + 一兩句說明;有相就放右上角細縮圖(唔佔行高)
function Row({ it }) {
  const imp = importanceOf(it)
  const k = it.kind || 'core'
  const mu = mapUrl(it.map)
  // 冇提示、說明唔長 → 直接顯示(地圖連結接喺句尾),唔使撳「詳細」
  const inline = !!it.text && it.text.length <= SHORT && !(it.tips && it.tips.length)
  return (
    <li className={'tp-row k-' + k + ' i' + imp}>
      <span className="tp-rt">{it.time}{it.end && <small>– {it.end}</small>}{it.verify && <em className="tp-verify">待確認</em>}</span>
      <div className="tp-rb">
        <h3>{it.icon && <i>{it.icon}</i>}{it.title}</h3>
        {inline ? <p>{it.text}{mu && <> <a className="tp-ilink" href={mu} target="_blank" rel="noopener noreferrer">地圖 ↗</a></>}{(it.links || []).map((l, i) => <a key={i} className="tp-ilink" href={l.url} target="_blank" rel="noopener noreferrer"> {l.label} ↗</a>)}</p> : <Detail text={it.text && it.text.length > SHORT ? it.text : ''} tips={it.tips} item={it} />}
      </div>
      {it.image && imp >= 2 && <Pic src={it.image} alt={it.title} cls="tp-th" ratio="1 / 1" pos={it.pos} />}
    </li>
  )
}

function Day({ day, n, id }) {
  const all = day.items || []
  // 每日代表相:只用 day.image(細縮圖),唔再借項目嘅相,避免重複
  return (
    <section id={id} className="tp-day">
      <div className="tp-day-head">
        <div className="tp-day-t">
          <span className="tp-daydate">DAY {n}{day.date && !isTbd(day.date) ? ' · ' + day.date : ''}</span>
          <h2>{day.theme || day.title}</h2>
          {day.theme && <small>{day.title}</small>}
        </div>
        {day.image && <Pic src={day.image} alt={day.title} cls="tp-day-th" ratio="4 / 3" pos={day.pos} />}
      </div>
      {day.intro && <p className="tp-dayintro">{day.intro}</p>}
      <ol className="tp-sched">{all.map((it, i) => <Row key={i} it={it} />)}</ol>
    </section>
  )
}

const money = (n, cur) => (n == null ? '待查' : (cur || '¥') + n.toLocaleString())

// 第二部分:住宿 / 主要景點 / 交通方式 —— 三行精簡摘要,撳入去跳到對應位置
function Summary({ d }) {
  const days = d.days || []
  const sights = []
  days.forEach((day, i) => (day.items || []).forEach((x) => { if (importanceOf(x) >= 3 || (x.kind === 'core' && importanceOf(x) >= 2 && !['入住'].some((w) => x.title.startsWith(w)))) sights.push({ t: x.title, d: i + 1 }) }))
  const trans = (d.transport || []).map((t) => t.title.replace(/\(.*?\)/g, '').trim())
  // 三格並排:優先用 cover.tiles([{k,t,to}]),冇寫就自動由酒店/景點/交通拎
  const auto = [
    ...(d.hotel ? [{ id: 'tp-hotel', k: '住宿', t: d.hotel.name.replace(/\s*[A-Za-z][A-Za-z\s.&-]*$/, '').trim() || d.hotel.name }] : []),
    ...(sights.length ? [{ id: 'tp-d' + sights[0].d, k: '景點', t: sights.map((x) => x.t).join('、') }] : []),
    ...(trans.length ? [{ id: 'tp-tr', k: '交通', t: trans.join('、') }] : []),
  ]
  const rows = (d.cover?.tiles || []).length ? d.cover.tiles.map((x) => ({ id: x.to || 'tp-top', k: x.k, t: x.t })) : auto
  if (!rows.length) return null
  return (
    <div className="tp-tiles">
      {rows.map((r) => (
        <button key={r.k} type="button" onClick={() => go(r.id)}>
          <span className="tp-tile-k">{r.k}</span>
          <b>{r.t}</b>
        </button>
      ))}
    </div>
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
    }, { rootMargin: '-20% 0px -70% 0px' })
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
  // 標題有「｜」就分做小標 + 主標
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
  const allTbd = d.budget && d.budget.items.every((x) => x.amount == null)
  const factsShown = (d.summary || []).filter((s) => !isTbd(s.value))
  const pending = [...(d.checks || []), ...(d.summary || []).filter((s) => isTbd(s.value)).map((s) => `${s.label}:${s.value}`)]
  // 相片來源清單(完整授權資訊)
  const credits = []
  const addCr = (where, o) => { if (o && o.image && o.credit) credits.push({ where, credit: o.credit }) }
  addCr('封面', cov)
  days.forEach((day, i) => { addCr(`Day ${i + 1}`, day); (day.items || []).forEach((it) => addCr(`Day ${i + 1}・${it.title}`, it)) })
  addCr('酒店', d.hotel)
  ;(d.transport || []).forEach((t) => addCr(`交通・${t.title}`, t))
  const hasL3 = (d.tips || []).length > 0 || (d.links || []).length > 0 || (d.sources || []).length > 0 || credits.length > 0
  const navItems = [
    { id: 'tp-top', label: '摘要' },
    ...days.map((_, i) => ({ id: 'tp-d' + (i + 1), label: 'Day ' + (i + 1) })),
    ...((d.transport || []).length ? [{ id: 'tp-tr', label: '交通' }] : []),
    ...(d.hotel ? [{ id: 'tp-hotel', label: '酒店' }] : []),
    ...(d.budget ? [{ id: 'tp-budget', label: '預算' }] : []),
    ...(pending.length || hasL3 ? [{ id: 'tp-check', label: '確認' }] : []),
  ]
  // 每個行程可以有自己嘅主色(cover.accent),冇寫就用預設
  const theme = {}
  if (cov.accent) theme['--coral'] = cov.accent
  if (cov.dark) theme['--navy'] = cov.dark

  return (
    <div className="trip" style={theme}>
      {trip.published === false && <div className="tp-draft">草稿預覽 · 未公開,只有你登入後睇到</div>}
      <header id="tp-top" className="tp-head">
        <div className="tp-wrap">
          <div className="tp-head-top">
            {cov.tags && <div className="tp-tags">{cov.tags.map((t) => <span key={t}>{t}</span>)}</div>}
            <div className="tp-share">
              <button type="button" onClick={share}>分享</button>
              <button type="button" onClick={copy}>{copied ? '已複製 ✓' : '複製連結'}</button>
            </div>
          </div>
          <h1>{tparts.length > 1 && <small className="tp-kicker">{tparts[0]}</small>}<span>{tparts.length > 1 ? tparts.slice(1).join(' · ') : trip.title}</span></h1>
          {cov.subtitle && <p className="tp-sub1">{cov.subtitle}</p>}
          {cov.image && <Pic src={cov.image} alt={trip.title} cls="tp-cover" ratio="2 / 1" pos={cov.pos} credit={cov.credit} />}
          {factsShown.length > 0 && (
            <dl className="tp-facts">
              {factsShown.map((s, i) => <div key={i}><dt>{s.label}</dt><dd>{s.value}</dd></div>)}
            </dl>
          )}
          <Summary d={d} />
        </div>
      </header>

      <Nav items={navItems} />

      <div className="tp-wrap">
        {days.map((day, i) => <Day key={i} day={day} n={i + 1} id={'tp-d' + (i + 1)} />)}

        {d.transport && d.transport.length > 0 && (
          <section id="tp-tr" className="tp-sec">
            <h2 className="tp-h">交通安排</h2>
            {d.transport.map((t, i) => (
              <div key={i} className={"tp-tr" + (t.image ? " has-img" : "")}>
                <div className="tp-tr-b"><h3>{t.title}<Verify show={t.verify} /></h3>
                {t.text && <p>{t.text}</p>}
                {t.steps && <ol>{t.steps.map((s, k) => <li key={k}>{s}</li>)}</ol>}
                <Links item={t} /></div>
                {t.image && <Pic src={t.image} alt={t.title} cls="tp-th" ratio="4 / 3" pos={t.pos} />}
              </div>
            ))}
          </section>
        )}

        {d.hotel && (
          <section id="tp-hotel" className="tp-sec">
            <h2 className="tp-h">酒店</h2>
            <div className={'tp-hotel' + (d.hotel.image ? ' has-img' : '')}>
              <div>
                {(() => { const m = d.hotel.name.match(/^(.*?)\s+([A-Za-z].*)$/); return <h3>{m ? m[1] : d.hotel.name}<Verify show={d.hotel.verify} />{m && <small className="tp-en">{m[2]}</small>}</h3> })()}
                {d.hotel.text && <p>{d.hotel.text}</p>}
              </div>
              {d.hotel.image && <Pic src={d.hotel.image} alt={d.hotel.name} cls="tp-th" ratio="4 / 3" pos={d.hotel.pos} />}
            </div>
            {d.hotel.highlights && d.hotel.highlights.length > 0 && (
              <ul className="tp-bul">{d.hotel.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul>
            )}
            {osmEmbed(d.hotel.map) && <iframe className="tp-map" title="酒店位置" loading="lazy" src={osmEmbed(d.hotel.map)} />}
            <Links item={{ map: d.hotel.map, links: d.hotel.links }} />
            {osmEmbed(d.hotel.map) && <p className="tp-cap">地圖 © OpenStreetMap</p>}
          </section>
        )}

        {d.budget && (
          <section id="tp-budget" className="tp-sec">
            <h2 className="tp-h">預算{allTbd ? '(價格待核實)' : ''}</h2>
            {allTbd ? (
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

        {(pending.length > 0 || hasL3) && (
          <section id="tp-check" className="tp-sec">
            <h2 className="tp-h">出發前確認</h2>
            {pending.length > 0 && <ul className="tp-todo">{pending.map((c, i) => <li key={i}>{c}</li>)}</ul>}
            {(d.tips || []).length > 0 && (
              <details className="tp-acc"><summary>小提醒<em className="tp-count">{d.tips.length}</em></summary><div><ul>{d.tips.map((t, i) => <li key={i}>{t}</li>)}</ul></div></details>
            )}
            {(d.links || []).length > 0 && (
              <details className="tp-acc"><summary>有用連結<em className="tp-count">{d.links.length}</em></summary><div><p className="tp-act">{d.links.map((l, i) => <a key={i} href={l.url} target="_blank" rel="noopener noreferrer">{l.label} ↗</a>)}</p></div></details>
            )}
            {(d.sources || []).length > 0 && (
              <details className="tp-acc"><summary>資料來源<em className="tp-count">{d.sources.length}</em></summary><div><ul>{d.sources.map((s, i) => <li key={i}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a></li>)}</ul></div></details>
            )}
            {credits.length > 0 && (
              <details className="tp-acc"><summary>相片來源<em className="tp-count">{credits.length}</em></summary><div><ul>{credits.map((c, i) => <li key={i}><b>{c.where}</b>:{c.credit}</li>)}</ul></div></details>
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
