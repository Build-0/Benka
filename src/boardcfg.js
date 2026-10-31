import { cget, cset } from './cache.js'

// 內置任務。d = 淺色底用深字;old = 舊資料,揀任務時唔再出現;mod = 修飾(唔係獨立任務)
export const TASKS = [
  { k: 'feed', l: '餵奶換片', c: '#3f7fbf' },
  { k: 'pump', l: '泵奶', c: '#6a58a8' },
  { k: 'wash', l: '洗奶樽', c: '#4a8fa8' },
  { k: 'routine', l: '起身流程', c: '#6b9bd1', d: 1 },
  { k: 'school', l: '學校接送', c: '#2f9e9a' },
  { k: 'cookf', l: '煮飯', c: '#5a6fc0' },
  { k: 'chore', l: '家務', c: '#5a6fc0' },
  { k: 'cook', l: '煮飯家務(未分)', c: '#5a6fc0', old: 1 },
  { k: 'work', l: '返工', c: '#2f4a6b' },
  { k: 'go', l: '通勤', c: '#8da2b8', d: 1 },
  { k: 'rest', l: '休息', c: '#b4c3d3', d: 1 },
  { k: 'nap', l: '午睡', c: '#7f8fd0' },
  { k: 'bath', l: '沖涼', c: '#3aa0c8' },
  { k: 'edu', l: '閱讀教育', c: '#2f9e7a' },
  { k: 'screen', l: '屏幕', c: '#a07fc0' },
  { k: 'play', l: '玩／活動', c: '#d9a441', d: 1 },
  { k: 'class', l: '課外班', c: '#c0709a' },
  { k: 'eat', l: '食飯', c: '#b08a5a' },
  { k: 'bed', l: '陪睡', c: '#5b6aa8' },
  { k: 'sleep', l: '睡眠', c: '#34456b' },
  { k: 'kidr', l: '照顧仁仁', c: '#7aa7c7', d: 1 },
  { k: 'kidd', l: '照顧德德', c: '#7aa7c7', d: 1 },
  { k: 'kid', l: '照顧(未指明)', c: '#7aa7c7', d: 1, old: 1 },
  { k: 'mass', l: '彌撒', c: '#6a58a8' },
  { k: 'sport', l: '運動', c: '#3a9e6a' },
  { k: 'cate', l: '慕道班', c: '#a07fc0' },
  { k: 'me', l: '★ 私人時間', c: '#f2774b' },
  { k: 'flex', l: '~ 大約／彈性', c: '#8da2b8', mod: 1 },
]
export const TASK = Object.fromEntries(TASKS.map((t) => [t.k, t]))

const TICON = { feed: '🍼', pump: '🥛', wash: '🫧', routine: '🌅', school: '🚌', cookf: '🍳', chore: '🧹', cook: '🍳', work: '💼', go: '🚇', rest: '🛋️', nap: '😴', bath: '🛁', edu: '📖', screen: '📺', play: '🧸', class: '🎨', eat: '🍚', bed: '🌙', sleep: '💤', kidr: '🧒', kidd: '👶', kid: '🧒', mass: '⛪', sport: '🏃', cate: '✝️', me: '⭐', flex: '〰️' }

// 內置任務預設所屬分類
const DEFCAT = {
  me: 'general', mass: 'general', sport: 'general', cate: 'general', sleep: 'general', rest: 'general', eat: 'general', go: 'general', routine: 'general',
  feed: 'care', pump: 'care', wash: 'care', bath: 'care', nap: 'care', bed: 'care', kid: 'care', kidr: 'care', kidd: 'care',
  school: 'school', class: 'school', edu: 'school', screen: 'school', play: 'school',
  cookf: 'home', chore: 'home', cook: 'home',
  work: 'work',
}
// 內置分類(可改名、改圖標,唔可以刪);「其他」永遠排最尾
const BASE_CATS = [
  { key: 'general', n: '通用', e: '🔁' },
  { key: 'care', n: '照顧孩子', e: '🍼' },
  { key: 'school', n: '接送學習', e: '🎒' },
  { key: 'home', n: '家務日常', e: '🏠' },
  { key: 'work', n: '返工通勤', e: '💼' },
]

// 自訂設定:t[任務key] = { name, icon, cat };c[分類key] = { name, icon }(內置分類只存改動,自訂分類 key 以 g 開頭)
let CFG = cget('board-cfg')
if (!CFG) {
  // 由舊版(只改名 / 自訂任務)搬過嚟
  const names = cget('board-names') || {}
  const custom = cget('board-custom') || {}
  CFG = { t: {}, c: {} }
  Object.keys(names).forEach((k) => { CFG.t[k] = { name: names[k], ...(custom[k] ? { cat: custom[k].cat } : {}) } })
}
export const getCfg = () => CFG
export const setCfg = (c) => { CFG = c; cset('board-cfg', c) }

export const isCustomTask = (k) => k[0] === 'x'
export const tname = (k) => (CFG.t[k] && CFG.t[k].name) || (TASK[k] ? TASK[k].l : isCustomTask(k) ? '(已刪任務)' : k)
export const ticon = (k) => (CFG.t[k] && CFG.t[k].icon) || TICON[k] || '✨'
export const tcolor = (k) => (TASK[k] ? TASK[k].c : '#7a8fa8')

const cpos = (k, i) => (CFG.c[k] && CFG.c[k].pos != null ? CFG.c[k].pos : i)
export const catList = () => [
  ...[
    ...BASE_CATS.map((c, i) => ({ key: c.key, n: (CFG.c[c.key] && CFG.c[c.key].name) || c.n, e: (CFG.c[c.key] && CFG.c[c.key].icon) || c.e, custom: false, p: cpos(c.key, i) })),
    ...Object.keys(CFG.c).filter((k) => k[0] === 'g' && !BASE_CATS.some((x) => x.key === k)).sort().map((k, i) => ({ key: k, n: CFG.c[k].name, e: CFG.c[k].icon || '📁', custom: true, p: cpos(k, 100 + i) })),
  ].sort((a, b) => a.p - b.p),
]
export const tcat = (k) => {
  const c = (CFG.t[k] && CFG.t[k].cat) || DEFCAT[k]
  const cats = catList()
  return cats.some((x) => x.key === c) ? c : cats[0].key // 分類被刪走:歸去第一個分類
}
// 一段(可能 a+b)歸邊個分類:以第一個非彈性任務為準
export const catOf = (task) => {
  const t = task.split('+').find((x) => x !== 'flex')
  return t ? tcat(t) : catList()[0].key
}
// 揀得到嘅任務:內置(唔計舊資料同修飾)+ 自訂
export const pickableTasks = () => [
  ...TASKS.filter((t) => !t.old && !t.mod).map((t) => t.k),
  ...Object.keys(CFG.t).filter((k) => isCustomTask(k) && CFG.t[k].name),
]

// 某分類入面嘅任務,按自訂次序(未排過嘅喺最尾,保持預設次序)
export const tasksInCat = (cat) => {
  const all = pickableTasks()
  return all
    .map((k, i) => ({ k, p: CFG.t[k] && CFG.t[k].pos != null ? CFG.t[k].pos : 1000 + i }))
    .filter((x) => tcat(x.k) === cat)
    .sort((a, b) => a.p - b.p)
    .map((x) => x.k)
}

// 常用 emoji,畀揀圖標
export const EMOJIS = [
  '🍼', '👶', '🧒', '👧', '👦', '🧸', '🎨', '📖', '📺', '🎮', '🎵', '⚽', '🚌', '🚗', '🚇', '🚶',
  '🏠', '🧹', '🍳', '🍚', '🥗', '☕', '🛒', '🧺', '🪴', '🛁', '🚿', '🪥', '😴', '💤', '🌙', '🌅',
  '💼', '💻', '📞', '📝', '📚', '🏫', '🩺', '💊', '🏥', '🦷', '✂️', '🎂', '🎁', '✈️', '🛋️', '🧘',
  '🏃', '🏊', '🚴', '🥋', '🎤', '📷', '🎬', '🍜', '🍰', '🥛', '🫧', '👨‍👩‍👧', '❤️', '⭐', '🔁', '📁',
]
