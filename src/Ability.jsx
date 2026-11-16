import { useEffect, useState } from 'react'
import { cget, cset } from './cache.js'
import Hero from './Hero.jsx'

// 鍛煉:能力建造表(來源:Notion「d.鍛煉與精力」表2)。動作名稱連去示範影片。
// k:ok = 已驗證有效、wait = 待測 / 測試中、off = 暫不處理
const yt = (id) => 'https://www.youtube.com/watch?v=' + id
const ROWS = [
  { pos: '久走｜腳掌', issue: '酸、脹、累',
    relief: [{ t: '筋膜槍／震動泡沫軸' }], build: [],
    status: [{ t: '舒緩已驗證有效', k: 'ok' }] },
  { pos: '久走｜小腿', issue: '酸、脹、累',
    relief: [{ t: '比目魚肌伸展', u: yt('zV4TFmtSmkc') }], build: [{ t: '坐姿提踵', u: yt('BxfKOyI8sUg') }],
    status: [{ t: '舒緩已驗證有效', k: 'ok' }] },
  { pos: '單側右手向下｜右肩胛', issue: '酸、累',
    relief: [{ t: '肩胛後收', u: yt('9tJTdqUXW14') }], build: [{ t: '牆面滑手', u: yt('rw35lIr2LjA') }],
    status: [{ t: '舒緩待測', k: 'wait' }, { t: '能力建立有效', k: 'ok' }] },
  { pos: '身體轉動｜腰方肌', issue: '酸、累',
    relief: [{ t: '地面側屈＋輕旋轉', u: 'https://youtu.be/SCTCiqEW07k' }],
    build: [{ t: '死蟲式', u: yt('GbSC02oU3To') }, { t: '彈力帶划船', u: yt('PDenXfaX6pU') }],
    status: [{ t: '舒緩已驗證有效', k: 'ok' }] },
  { pos: '彎腰｜臀中肌', issue: '酸、累',
    relief: [{ t: '臀肌伸展', u: yt('4MHs4H9UfQs') }, { t: '髖屈肌伸展', u: yt('mzPvzMivukw') }],
    build: [{ t: '髖鉸鏈', u: yt('2W_gXhut5S8') }, { t: '臀橋', u: yt('PusbZuBgeug') }],
    status: [{ t: '臀肌驗證有效', k: 'ok' }, { t: '髖屈肌待測', k: 'wait' }] },
  { pos: '反覆起蹲｜腰胸椎', issue: '僵硬、累',
    relief: [{ t: '貓牛式', u: 'https://youtu.be/1Y0YjXS9sKI' }], build: [],
    status: [{ t: '舒緩已驗證有效', k: 'ok' }] },
  { pos: '心肺／跑步', issue: '精力、耐力;跑後腳底／小腿負荷',
    relief: [{ t: '跑前動態熱身', u: yt('8UTPZ2wJ0QM') }, { t: '跑後拉伸', u: yt('RtO-EDVQpgI') }, { t: '比目魚肌伸展', u: yt('zV4TFmtSmkc') }],
    build: [{ t: '跑步' }],
    status: [{ t: '跑後有效', k: 'ok' }, { t: '比目魚有效', k: 'ok' }, { t: '跑前熱身待測', k: 'wait' }] },
  { pos: '膝蓋｜跪下', issue: '酸、脹',
    relief: [], build: [],
    status: [{ t: '暫不處理', k: 'off' }] },
  { pos: '拉力繩其他動作', issue: '',
    relief: [], build: [{ t: '前夾胸／側抬腿等' }],
    status: [{ t: '測試中', k: 'wait' }] },
]

const hasOk = (r) => r.status.some((s) => s.k === 'ok')

// 身體部位對照圖:頁頂兩張縮圖,撳開大圖(再撳圖放大,可左右拖)
const BASE = import.meta.env.BASE_URL
const MAPS = [
  { key: 'back', label: '背面 · 骨骼與肌肉', thumb: BASE + 'body/back-s.jpg', full: BASE + 'body/back.jpg' },
  { key: 'foot', label: '腳底 · 肌肉與表面', thumb: BASE + 'body/foot-s.jpg', full: BASE + 'body/foot.jpg' },
]

function BodyMaps() {
  const [open, setOpen] = useState(null)
  const [zoom, setZoom] = useState(false)
  const close = () => { setOpen(null); setZoom(false) }
  useEffect(() => {
    if (!open) return
    const k = (e) => e.key === 'Escape' && close()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open])
  const m = MAPS.find((x) => x.key === open)
  return (
    <>
      <div className="ab-maps">
        {MAPS.map((x) => (
          <button key={x.key} className="ab-map" onClick={() => setOpen(x.key)}>
            <img src={x.thumb} alt={x.label} loading="lazy" />
            <span>{x.label}</span>
          </button>
        ))}
      </div>
      {m && (
        <div className="ab-lb" onClick={close}>
          <div className="ab-lb-bar" onClick={(e) => e.stopPropagation()}>
            <span>{m.label}</span>
            <button onClick={() => setZoom((z) => !z)}>{zoom ? '縮小' : '放大'}</button>
            <button onClick={close} aria-label="關閉">✕</button>
          </div>
          <div className="ab-lb-body" onClick={(e) => e.stopPropagation()}>
            <img src={m.full} alt={m.label} style={{ width: zoom ? '240%' : '100%' }} onClick={() => setZoom((z) => !z)} />
          </div>
        </div>
      )}
    </>
  )
}

// 由 YouTube 連結攞影片 id
const vid = (u) => (u || '').match(/(?:v=|youtu\.be\/)([\w-]{11})/)?.[1] || ''

// 動作卡:有影片 → 縮圖+播放掣,撳一下就地播放(撳先載入,唔拖慢頁面);冇影片 → 純文字卡
function Actions({ scope, items, playing, setPlaying }) {
  // 舒緩同能力建立放喺同一個兩欄格,左右並排;每張卡有類別標籤
  return (
    <div className="ab-acts">
      {items.map((x) => {
        const id = vid(x.u)
        const tag = <span className={'ab-tag ' + x.kind}>{x.kind === 'relief' ? '舒緩' : '能力建立'}</span>
        if (!id) return <div key={x.kind + x.t} className="ab-act plain">{tag}<span className="ab-t">{x.t}</span></div>
        const key = scope + x.kind + x.t
        const on = playing === key
        return (
          <div key={x.kind + x.t} className={'ab-act' + (on ? ' on' : '')}>
            <div className="ab-vid">
              {on ? (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`}
                  title={x.t}
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              ) : (
                <button className="ab-thumb" onClick={() => setPlaying(key)} aria-label={'播放 ' + x.t}>
                  <img src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" loading="lazy" />
                  <span className="ab-play" aria-hidden="true">▶</span>
                </button>
              )}
            </div>
            <div className="ab-cap">
              {tag}
              <span className="ab-t">{x.t}</span>
              <a className="ab-yt" href={x.u} target="_blank" rel="noopener noreferrer">YouTube ↗</a>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function Ability() {
  const [playing, setPlaying] = useState('')
  const [kind, setKind] = useState(() => cget('ab-kind') || 'all')
  const [part, setPart] = useState(() => cget('ab-part') || 'all')
  const pickKind = (v) => { setKind(v); cset('ab-kind', v) }
  const pickPart = (v) => { setPart(v); cset('ab-part', v) }
  const nRelief = ROWS.reduce((n, r) => n + r.relief.length, 0)
  const nBuild = ROWS.reduce((n, r) => n + r.build.length, 0)
  // 篩選:類別(舒緩/能力建立)只留該類動作,冇該類動作嘅部位隱藏;部位只留揀咗嗰個
  const shown = ROWS.filter((r) => (part === 'all' || r.pos === part) && (kind === 'all' || (kind === 'relief' ? r.relief : r.build).length > 0))
  const ok = ROWS.filter(hasOk).length
  const wait = ROWS.filter((r) => r.status.some((s) => s.k === 'wait')).length
  return (
    <>
      <Hero
        title="能力建造"
        icon="barbell"
        sub="哪裡累 → 舒緩 + 能力建立"
        stats={[{ n: ROWS.length, label: '部位' }, { n: ok, label: '有效' }, { n: wait, label: '待測' }]}
      />
      <BodyMaps />
      <div className="filters ab-filters">
        <select value={kind} onChange={(e) => pickKind(e.target.value)} aria-label="類別">
          <option value="all">全部 {nRelief + nBuild}</option>
          <option value="relief">舒緩 {nRelief}</option>
          <option value="build">能力建立 {nBuild}</option>
        </select>
        <select value={part} onChange={(e) => pickPart(e.target.value)} aria-label="身體部位">
          <option value="all">所有部位</option>
          {ROWS.map((r) => <option key={r.pos} value={r.pos}>{r.pos}</option>)}
        </select>
      </div>
      {shown.length === 0 && <div className="empty muted">冇符合嘅項目。</div>}
      <div className="ab-list">
        {shown.map((r) => (
          <section key={r.pos} className="card ab-card">
            <div className="ab-head">
              <b>{r.pos}</b>
              {r.issue && <span className="muted ab-issue">{r.issue}</span>}
            </div>
            {(kind === 'all' ? r.relief.length + r.build.length : (kind === 'relief' ? r.relief : r.build).length) > 0 && (
              <Actions scope={r.pos} items={[...(kind === 'build' ? [] : r.relief.map((x) => ({ ...x, kind: 'relief' }))), ...(kind === 'relief' ? [] : r.build.map((x) => ({ ...x, kind: 'build' })))]} playing={playing} setPlaying={setPlaying} />
            )}
            <div className="ab-status">
              {r.status.map((s) => <span key={s.t} className={'ab-badge ' + s.k}>{s.t}</span>)}
            </div>
          </section>
        ))}
      </div>
    </>
  )
}
