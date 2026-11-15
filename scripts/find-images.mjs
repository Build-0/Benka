// 搵可合法使用嘅相片(畀 AI 同行程製作用):node scripts/find-images.mjs "關鍵字" [數量]
// - Wikimedia Commons:只收 CC0 / 公有領域 / CC BY / CC BY-SA(可轉載,要標註作者同授權),解像度 ≥ 1200 寬。
// - 設咗環境變數 PEXELS_KEY 就同時搜 Pexels(免費授權,毋須標註但我哋照樣標註攝影師)。
// 輸出每張相嘅:網址、尺寸/方向、授權、貼落行程 JSON 用嘅 credit 字串。要人手確認「相片真係對應嗰個地點」先用。
const q = process.argv[2]
const n = +(process.argv[3] || 8)
if (!q) { console.log('用法: node scripts/find-images.mjs "Xiaomeisha beach" 8'); process.exit(1) }
const UA = { 'User-Agent': 'benka-trips/1.0 (family site; https://build-0.github.io/Benka/)' }
const OK = /^(CC0|Public domain|PD|CC BY(-SA)?( \d\.\d)?)/i
const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim()

async function commons() {
  const u = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
    action: 'query', generator: 'search', gsrsearch: q + ' filetype:bitmap', gsrnamespace: '6', gsrlimit: String(n * 4),
    prop: 'imageinfo', iiprop: 'url|extmetadata|size', iiurlwidth: '1600', format: 'json',
  })
  const j = await (await fetch(u, { headers: UA })).json()
  const out = []
  for (const p of Object.values(j.query?.pages || {})) {
    const i = p.imageinfo?.[0]; if (!i) continue
    const m = i.extmetadata || {}
    const lic = strip(m.LicenseShortName?.value)
    if (!OK.test(lic) || i.width < 1200) continue
    const who = strip(m.Artist?.value) || '作者不詳'
    out.push({
      source: 'Wikimedia Commons', title: p.title.replace('File:', ''), size: `${i.width}x${i.height}`, shape: i.width >= i.height ? '橫幅' : '直幅',
      license: lic, image: 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(p.title.replace('File:', '')) + '?width=1600',
      credit: `${who} / Wikimedia Commons, ${lic}`, page: i.descriptionurl,
    })
  }
  return out
}

async function pexels() {
  const key = process.env.PEXELS_KEY
  if (!key) return []
  const j = await (await fetch('https://api.pexels.com/v1/search?per_page=' + n + '&query=' + encodeURIComponent(q), { headers: { Authorization: key } })).json()
  return (j.photos || []).map((p) => ({
    source: 'Pexels', title: p.alt || p.url, size: `${p.width}x${p.height}`, shape: p.width >= p.height ? '橫幅' : '直幅', license: 'Pexels License',
    image: p.src.large2x || p.src.large, credit: `${p.photographer} / Pexels`, page: p.url,
  }))
}

const res = [...(await commons()).slice(0, n), ...(await pexels())]
if (!res.length) console.log('冇搵到符合授權同解像度嘅相。可以試其他關鍵字(英文通常搵到多啲),或者請擁有者提供官方授權相。')
res.forEach((r, i) => console.log(`${i + 1}. [${r.source}] ${r.title}\n   ${r.size} ${r.shape} | ${r.license}\n   image : ${r.image}\n   credit: ${r.credit}\n   頁面  : ${r.page}\n`))
