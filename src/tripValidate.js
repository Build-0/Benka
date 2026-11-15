// 行程 JSON 檢查:匯入前先睇有冇錯或者缺嘅資料。errors 一定要改,warnings 建議改。
// 頂層格式:{ slug, title, cover, summary, checks, days[], hotel, transport[], budget, tips, links, sources }
const SLUG = /^[a-z0-9][a-z0-9-]{2,60}$/
const IMPORTANCE = [1, 2, 3]
const KINDS = ['core', 'transport', 'meal', 'note']

export function validateTrip(raw) {
  const errors = [], warnings = []
  let j
  try { j = typeof raw === 'string' ? JSON.parse(raw) : raw } catch (e) { return { ok: false, errors: ['唔係有效嘅 JSON:' + e.message], warnings, trip: null } }
  if (!j || typeof j !== 'object' || Array.isArray(j)) return { ok: false, errors: ['最外層要係一個物件 { }'], warnings, trip: null }

  const { slug, title, ...data } = j
  if (!title || typeof title !== 'string') errors.push('缺少 title(行程標題)')
  if (slug && !SLUG.test(slug)) errors.push('slug 只可以用細階英文、數字同 -,3 至 60 個字,例如 sz-dino-7k3q')
  if (!slug) warnings.push('冇 slug,會按標題自動產生一個')
  if (!Array.isArray(data.days) || !data.days.length) errors.push('缺少 days(每日行程)')

  const imgs = []
  const walk = (n, where) => {
    if (Array.isArray(n)) n.forEach((x, i) => walk(x, `${where}[${i}]`))
    else if (n && typeof n === 'object') {
      if (typeof n.image === 'string' && n.image) imgs.push({ n, where })
      for (const [k, v] of Object.entries(n)) if (v && typeof v === 'object') walk(v, `${where}.${k}`)
    }
  }
  walk(data, '')
  for (const { n, where } of imgs) {
    if (!/^https:\/\//.test(n.image)) errors.push(`${where}.image 要係 https 網址`)
    if (!n.credit) warnings.push(`${where}:相片冇 credit(作者 + 授權),請補返`)
    else if (!/(CC|公有領域|Public Domain|PD|授權|licen|Unsplash|Pexels|Pixabay|官方|official|自攝|自己拍)/i.test(n.credit)) warnings.push(`${where}:credit 未見授權資訊(例如 CC BY-SA 4.0)`)
  }
  if (!data.cover?.image) warnings.push('冇封面相 cover.image,會用漸變色封面')
  const seen = new Set()
  for (const { n, where } of imgs) { if (seen.has(n.image)) warnings.push(`${where}:同一張相出現多次,頁面只會顯示第一次`); seen.add(n.image) }
  if (data.cover?.accent && !/^#[0-9a-f]{6}$/i.test(data.cover.accent)) errors.push('cover.accent 要係 #rrggbb 顏色')

  ;(data.days || []).forEach((d, i) => {
    const w = `days[${i}]`
    if (!d.title && !d.theme) warnings.push(`${w} 冇 title / theme`)
    if (!Array.isArray(d.items) || !d.items.length) warnings.push(`${w} 冇 items(行程項目)`)
    ;(d.items || []).forEach((it, k) => {
      const p = `${w}.items[${k}]`
      if (!it.title) errors.push(`${p} 缺少 title`)
      if (!it.time) warnings.push(`${p} 冇 time`)
      if (it.importance != null && !IMPORTANCE.includes(it.importance)) errors.push(`${p}.importance 只可以係 1、2、3`)
      if (it.kind && !KINDS.includes(it.kind)) errors.push(`${p}.kind 只可以係 ${KINDS.join(' / ')}`)
    })
  })
  for (const [i, x] of (data.budget?.items || []).entries()) {
    if (x.amount != null && typeof x.amount !== 'number') errors.push(`budget.items[${i}].amount 要係數字或 null`)
  }
  return { ok: !errors.length, errors, warnings, trip: errors.length ? null : { slug: slug || '', title, data } }
}

// 冇 slug 時用標題砌一個(中文標題會變成 trip-xxxx)
export const makeSlug = (title) => {
  const base = String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24)
  const rnd = Math.random().toString(36).slice(2, 6)
  return (base.length >= 3 ? base : 'trip') + '-' + rnd
}
