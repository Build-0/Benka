// 建置後執行(npm run build):
//  1. 將所有「已發布」行程嘅相片鏡像到 dist/trip-img/(縮細、轉 JPEG),避免外部網址失效/限制引用;
//     dist/trip-img/map.json 係「原網址 → 本站副本」,行程頁優先用副本,失敗先退返原網址。
//  2. 為每個行程生成 dist/t/<slug>/index.html(WhatsApp 預覽卡 OG 標籤)+ og.jpg(1200×630)。
//  3. 寫 dist/share-manifest.json(行程資料 hash),定時工作流程用佢偵測行程有冇改過 → 自動重新部署。
// 任何一步失敗都唔會令建置失敗。
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import sharp from 'sharp'

const SITE = process.env.SITE_URL || 'https://build-0.github.io/Benka/'
const UA = 'benka-trips/1.0 (https://build-0.github.io/Benka/)'
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex')

// 同 .github/workflows/deploy.yml 嘅 check 步驟用同一條查詢,hash 先會一致
export const QUERY = 'trips?select=slug,title,data,updated_at&published=eq.true&order=slug'

// 搵出所有 image 欄位(任何深度),連同同層嘅 credit,用嚟鏡像同檢查來源
function collectImages(node, trail, out) {
  if (Array.isArray(node)) node.forEach((x, i) => collectImages(x, `${trail}[${i}]`, out))
  else if (node && typeof node === 'object') {
    if (typeof node.image === 'string' && node.image) out.push({ url: node.image, credit: node.credit, where: `${trail}.image` })
    for (const [k, v] of Object.entries(node)) if (v && typeof v === 'object') collectImages(v, `${trail}.${k}`, out)
  }
}

async function download(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return Buffer.from(await res.arrayBuffer())
}

async function mirror(url) {
  const buf = await download(url)
  const name = 'trip-img/' + sha(url).slice(0, 16) + '.jpg'
  await sharp(buf).rotate().resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toFile(path.join('dist', name))
  return { name, buf }
}

async function makeOg(buf, pos, out) {
  const meta = await sharp(buf).metadata()
  const [px, py] = String(pos || '50% 50%').split(/\s+/).map((v) => Math.min(100, Math.max(0, parseFloat(v))) / 100)
  const W = 1200, H = 630
  const scale = Math.max(W / meta.width, H / meta.height)
  const rw = Math.round(meta.width * scale), rh = Math.round(meta.height * scale)
  const left = Math.round((rw - W) * (isNaN(px) ? 0.5 : px)), top = Math.round((rh - H) * (isNaN(py) ? 0.5 : py))
  await sharp(buf).resize(rw, rh).extract({ left, top, width: W, height: H }).jpeg({ quality: 82 }).toFile(out)
}

async function main() {
  // 直接用 REST(建置機 Node 20 冇原生 WebSocket,唔用 supabase-js)
  const src = fs.readFileSync('src/supabase.js', 'utf8')
  const url = src.match(/SUPABASE_URL\s*=\s*'([^']+)'/)[1]
  const key = src.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/)[1]
  const r = await fetch(`${url}/rest/v1/${QUERY}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  if (!r.ok) throw new Error('trips ' + r.status)
  const text = await r.text()
  const data = JSON.parse(text)

  fs.mkdirSync('dist/trip-img', { recursive: true })
  const report = { builtAt: new Date().toISOString(), trips: {} }

  // 1) 鏡像相片(去重,最多 4 張同時下載)
  const imgs = []
  for (const t of data) collectImages(t.data, t.slug, imgs)
  const unique = [...new Set(imgs.map((i) => i.url))].filter((u) => /^https?:/.test(u))
  const map = {}, bufs = {}
  let idx = 0
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (idx < unique.length) {
      const u = unique[idx++]
      try { const m = await mirror(u); map[u] = m.name; bufs[u] = m.buf } catch (e) { console.warn('mirror failed:', u.slice(0, 90), e.message); (report.failed ||= []).push(u) }
    }
  }))
  fs.writeFileSync('dist/trip-img/map.json', JSON.stringify(map))
  console.log(`mirrored ${Object.keys(map).length}/${unique.length} images`)

  // 2) 分享頁 + 預覽圖
  for (const t of data) {
    const dir = path.join('dist', 't', t.slug)
    fs.mkdirSync(dir, { recursive: true })
    const cov = t.data?.cover || {}
    let og = ''
    if (cov.image) {
      try {
        const buf = bufs[cov.image] || (await download(cov.image))
        await makeOg(buf, cov.ogPos || cov.pos, path.join(dir, 'og.jpg'))
        og = `${SITE}t/${t.slug}/og.jpg`
      } catch (e) { console.warn('og image failed:', t.slug, e.message) }
    }
    const desc = [cov.subtitle, (cov.tags || []).join(' · ')].filter(Boolean).join('\n')
    const page = `${SITE}t/${t.slug}/`
    const dest = `${SITE}#/t/${t.slug}`
    fs.writeFileSync(path.join(dir, 'index.html'), `<!doctype html>
<html lang="zh-HK"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t.title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="本家">
<meta property="og:title" content="${esc(t.title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(page)}">
${og ? `<meta property="og:image" content="${esc(og)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(og)}">` : ''}
<meta http-equiv="refresh" content="0; url=${esc(dest)}">
<script>location.replace(${JSON.stringify(dest)})</script>
</head><body style="font-family:sans-serif;padding:24px"><p><a href="${esc(dest)}">${esc(t.title)}</a></p></body></html>
`)
    const mine = imgs.filter((i) => i.where.startsWith(t.slug + '.'))
    report.trips[t.slug] = {
      images: mine.length,
      mirrored: mine.filter((i) => map[i.url]).length,
      missingCredit: mine.filter((i) => !i.credit).map((i) => i.where),
      og: !!og,
    }
    console.log('share page:', t.slug, og ? '(with og.jpg)' : '(no og image)', report.trips[t.slug].missingCredit.length ? '⚠ 缺相片來源: ' + report.trips[t.slug].missingCredit.join(', ') : '')
  }

  // 3) 行程資料 hash(跟工作流程 check 步驟一致)
  fs.writeFileSync('dist/share-manifest.json', JSON.stringify({ hash: sha(text).slice(0, 16), count: data.length, builtAt: report.builtAt }))
  fs.writeFileSync('dist/share-report.json', JSON.stringify(report, null, 1))
}

try {
  await main()
} catch (e) {
  console.warn('gen-share skipped:', e.message)
  try { fs.mkdirSync('dist', { recursive: true }); fs.writeFileSync('dist/share-debug.txt', String((e && e.stack) || e)) } catch { /* 忽略 */ }
}
process.exit(0)
