import { useState } from 'react'
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

// 由 YouTube 連結攞影片 id
const vid = (u) => (u || '').match(/(?:v=|youtu\.be\/)([\w-]{11})/)?.[1] || ''

// 動作卡:有影片 → 縮圖+播放掣,撳一下就地播放(撳先載入,唔拖慢頁面);冇影片 → 純文字卡
function Actions({ scope, items, playing, setPlaying }) {
  return (
    <div className="ab-acts">
      {items.map((x) => {
        const id = vid(x.u)
        if (!id) return <div key={x.t} className="ab-act plain"><span className="ab-t">{x.t}</span></div>
        const key = scope + x.t
        const on = playing === key
        return (
          <div key={x.t} className={'ab-act' + (on ? ' on' : '')}>
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
      <div className="ab-list">
        {ROWS.map((r) => (
          <section key={r.pos} className="card ab-card">
            <div className="ab-head">
              <b>{r.pos}</b>
              {r.issue && <span className="muted ab-issue">{r.issue}</span>}
            </div>
            {r.relief.length > 0 && (
              <div className="ab-sec"><div className="ab-lab">舒緩</div><Actions scope={r.pos + "relief"} items={r.relief} playing={playing} setPlaying={setPlaying} /></div>
            )}
            {r.build.length > 0 && (
              <div className="ab-sec"><div className="ab-lab">能力建立</div><Actions scope={r.pos + "build"} items={r.build} playing={playing} setPlaying={setPlaying} /></div>
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
