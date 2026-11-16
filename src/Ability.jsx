import Icon from './Icon.jsx'
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

function Links({ items }) {
  return (
    <div className="ab-links">
      {items.map((x) => x.u
        ? <a key={x.t} className="ab-link" href={x.u} target="_blank" rel="noopener noreferrer">{x.t}<span aria-hidden="true"> ↗</span></a>
        : <span key={x.t} className="ab-link plain">{x.t}</span>)}
    </div>
  )
}

export default function Ability() {
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
              <div className="ab-row"><span className="ab-lab">舒緩</span><Links items={r.relief} /></div>
            )}
            {r.build.length > 0 && (
              <div className="ab-row"><span className="ab-lab">能力建立</span><Links items={r.build} /></div>
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
