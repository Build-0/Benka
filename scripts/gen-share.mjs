// 建置後執行:為每個「已發布」行程生成 dist/t/<slug>/index.html(WhatsApp 預覽卡用嘅 OG 標籤)
// + og.jpg(1200×630 封面)。真人打開會即刻跳去 #/t/<slug>。失敗唔影響建置。
import fs from 'node:fs'
import path from 'node:path'

const SITE = process.env.SITE_URL || 'https://build-0.github.io/Benka/'
const UA = 'benka-trips/1.0 (https://build-0.github.io/Benka/)'
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

async function makeOg(url, pos, out) {
  const sharp = (await import('sharp')).default
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' })
  if (!res.ok) throw new Error('image ' + res.status)
  const buf = Buffer.from(await res.arrayBuffer())
  const meta = await sharp(buf).metadata()
  const [px, py] = String(pos || '50% 50%').split(/\s+/).map((v) => Math.min(100, Math.max(0, parseFloat(v))) / 100)
  const W = 1200, H = 630
  const scale = Math.max(W / meta.width, H / meta.height)
  const rw = Math.round(meta.width * scale), rh = Math.round(meta.height * scale)
  const left = Math.round((rw - W) * (isNaN(px) ? 0.5 : px)), top = Math.round((rh - H) * (isNaN(py) ? 0.5 : py))
  await sharp(buf).resize(rw, rh).extract({ left, top, width: W, height: H }).jpeg({ quality: 82 }).toFile(out)
}

try {
  const { supabase } = await import('../src/supabase.js')
  const { data, error } = await supabase.from('trips').select('slug,title,data').eq('published', true)
  if (error) throw error
  for (const t of data || []) {
    const dir = path.join('dist', 't', t.slug)
    fs.mkdirSync(dir, { recursive: true })
    const cov = t.data?.cover || {}
    let og = ''
    if (cov.image) {
      try { await makeOg(cov.image, cov.ogPos || cov.pos, path.join(dir, 'og.jpg')); og = `${SITE}t/${t.slug}/og.jpg` } catch (e) { console.warn('og image fallback to original:', t.slug, e.message); og = cov.image }
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
    console.log('share page:', t.slug, og ? '(with og.jpg)' : '(no image)')
  }
} catch (e) {
  console.warn('gen-share skipped:', e.message)
  try { fs.writeFileSync('dist/share-debug.txt', String(e && e.stack || e)) } catch { /* 忽略 */ }
}
process.exit(0)
