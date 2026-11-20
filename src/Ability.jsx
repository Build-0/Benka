import { useEffect, useState } from 'react'
import { cget, cset } from './cache.js'
import Hero from './Hero.jsx'

// 鍛煉:能力建造表(來源:Notion「d.鍛煉與精力」表2)。動作名稱連去示範影片。
// k:ok = 已驗證有效、wait = 待測 / 測試中、off = 暫不處理
const yt = (id) => 'https://www.youtube.com/watch?v=' + id
const ROWS = [
  { pos: '久走｜腳掌', issue: '酸、脹、累',
    relief: [{ t: '筋膜槍／震動泡沫軸' }, { t: '足底筋膜伸展(大腳趾)', u: yt('Rcsd2frLJ78'), d: '每次 20–30 秒 × 3 次;前腳掌痛加劇就停' }],
    build: [{ t: '短足運動', u: 'https://youtube.com/shorts/7EQ_9LfUYcM', d: '每次維持 5 秒，重複 8 次;抬起足弓,唔好蜷腳趾' }],
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

// 做法:每個動作都寫明次數/時間(沒有逐項 d 時用呢度)。屬一般建議,按身體感覺調整,痛就停
const DOSE = {
  '筋膜槍／震動泡沫軸': '每個位置 30–60 秒,避開骨頭,力度以微酸為限',
  '比目魚肌伸展': '膝微屈、腳跟壓地,每次 30 秒 × 3 次',
  '坐姿提踵': '每組 12–15 下 × 3 組,慢升慢降',
  '肩胛後收': '夾緊肩胛骨 5 秒 × 10 次',
  '牆面滑手': '背貼牆,手臂沿牆上下滑 10 次 × 2 組',
  '地面側屈＋輕旋轉': '每邊 20–30 秒 × 2 次,慢慢做',
  '死蟲式': '每邊 8–10 下 × 2–3 組,腰貼地',
  '彈力帶划船': '每組 12–15 下 × 3 組,肩胛後收',
  '臀肌伸展': '每邊 30 秒 × 2–3 次',
  '髖屈肌伸展': '每邊 30 秒 × 2–3 次,骨盆收正',
  '髖鉸鏈': '每組 10–12 下 × 3 組,背打直、屈髖',
  '臀橋': '每組 12–15 下 × 3 組,頂點停 2 秒',
  '貓牛式': '慢慢來回 10 次 × 2 組',
  '跑前動態熱身': '5–10 分鐘,由慢到快',
  '跑後拉伸': '每個部位 30 秒 × 2 次',
  '跑步': '循序漸進,以可聊天嘅強度為準',
  '前夾胸／側抬腿等': '每組 12–15 下 × 2–3 組',
}

const hasOk = (r) => r.status.some((s) => s.k === 'ok')

// 身體部位對照圖:頁頂兩張縮圖,撳開大圖(再撳圖放大,可左右拖)
const BASE = import.meta.env.BASE_URL
const MAPS = [
  { key: 'back', ar: 0.8, label: '背面 骨骼肌肉', thumb: BASE + 'body/back-s.jpg', full: BASE + 'body/back.jpg' },
  { key: 'foot', ar: 1.5, label: '腳底 肌肉表面', thumb: BASE + 'body/foot-s.jpg', full: BASE + 'body/foot.jpg' },
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
            <img src={x.thumb} alt={x.label} loading="lazy" style={{ aspectRatio: x.ar }} />
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
const vid = (u) => (u || '').match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/)?.[1] || ''

// 動作卡:每個動作一張卡(影片縮圖 → 類別+「部位 動作」一行 → 問題 → YouTube → 狀態)。
// 撳縮圖就地播放(撳先載入,唔拖慢頁面);冇影片嘅動作同冇動作嘅部位係純文字卡。
function Card({ c, playing, setPlaying }) {
  const { r, x, kind } = c
  const id = vid(x?.u)
  const key = r.pos + (kind || '') + (x?.t || '')
  const on = playing === key
  const tag = kind && <span className={'ab-tag ' + kind}>{kind === 'relief' ? '舒緩' : '能力建立'}</span>
  return (
    <div className={'ab-act' + (on ? ' on' : '') + (id ? '' : ' plain')}>
      {id && (
        <div className="ab-vid">
          {on ? (
            <iframe
              src={`https://www.youtube.com/embed/${id}?autoplay=1&rel=0&playsinline=1`}
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
      )}
      <div className="ab-cap">
        {tag}
        <span className="ab-t">{r.pos}{x && <> <b>{x.t}</b></>}</span>
        {r.issue && <span className="ab-issue">{r.issue}</span>}
        {(x?.d || DOSE[x?.t]) && <span className="ab-issue">做法:{x.d || DOSE[x.t]}</span>}
        {id && <a className="ab-yt" href={x.u} target="_blank" rel="noopener noreferrer">YouTube ↗</a>}
        <div className="ab-status">
          {r.status.map((s) => <span key={s.t} className={'ab-badge ' + s.k}>{s.t}</span>)}
        </div>
      </div>
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
  // 攤平成一張張動作卡;類別只留該類動作;冇任何動作嘅部位只喺「全部」顯示
  const allCards = ROWS.filter((r) => part === 'all' || r.pos === part).flatMap((r) => {
    const items = [
      ...(kind === 'build' ? [] : r.relief.map((x) => ({ r, x, kind: 'relief' }))),
      ...(kind === 'relief' ? [] : r.build.map((x) => ({ r, x, kind: 'build' }))),
    ]
    return items.length || kind !== 'all' ? items : [{ r, x: null, kind: '' }]
  })
  // 有影片嘅排前面,冇影片(純文字)嘅放最後;各自保持原有次序
  const withVid = allCards.filter((c) => vid(c.x?.u))
  const noVid = allCards.filter((c) => !vid(c.x?.u))
  const cards = [...withVid, ...noVid]
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
      {cards.length === 0 && <div className="empty muted">冇符合嘅項目。</div>}
      {withVid.length > 0 && (
        <div className="ab-acts">
          {withVid.map((c) => <Card key={c.r.pos + c.kind + (c.x?.t || '')} c={c} playing={playing} setPlaying={setPlaying} />)}
        </div>
      )}
      {noVid.length > 0 && (
        <>
          <div className="ab-sep"><span>未有示範影片</span></div>
          <div className="ab-acts">
            {noVid.map((c) => <Card key={c.r.pos + c.kind + (c.x?.t || '')} c={c} playing={playing} setPlaying={setPlaying} />)}
          </div>
        </>
      )}
    </>
  )
}
