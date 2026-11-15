// trip-sync:行程有改動時,確保「分享預覽卡 + 本站相片副本」重新建置並部署。
// (已部署喺 Supabase Edge Functions,verify_jwt = false;呢份係版本備份。)
//
// 安全設計(唔需要共享密碼):
//  - 任何人都可以「叫呢個函數檢查」,但函數只會喺「線上版本同最新行程資料唔同步」時先觸發部署,
//    而且有頻率上限(90 秒內唔重複派發、每小時最多 20 次)。可以觸發嘅永遠只係固定嘅 deploy.yml(main 分支),
//    唔可以做其他事。所以未授權者最多只係令一次「本來就需要嘅」重建提早發生。
//  - GitHub 憑證(GH_TOKEN)只存喺 Edge Function Secrets:唔喺前端、唔喺資料庫、唔喺程式碼。
//    建議用 Fine-grained token:只揀 Build-0/Benka,權限只開 Actions: Read and write。
//  - 確認真正完成:派發後輪詢線上 share-manifest.json,hash = 最新資料 hash 先記 verified;
//    建置失敗(run conclusion != success)會記錄 run 連結並自動重試,最多 3 次。
//  - 所有步驟寫入 public.deploy_log(只有行程擁有者登入後睇到)。
import { createClient } from 'npm:@supabase/supabase-js@2'

declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void }

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GH_TOKEN = Deno.env.get('GH_TOKEN') || ''
// 公開 anon 金鑰(同 src/supabase.js 一樣,本來就係公開)
const ANON = Deno.env.get('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkbmZsYXNkamNucWxkdHlxa2hhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5MjY4NjUsImV4cCI6MjA5OTUwMjg2NX0.NnVQ75pW5uYkoOwg365PILiAU7HfJCovukoBO9XNl-c'
const REPO = 'Build-0/Benka'
const WORKFLOW = 'deploy.yml'
const REF = 'main'
const SITE = 'https://build-0.github.io/Benka/'
// 要同 scripts/gen-share.mjs 同 deploy.yml check 步驟用同一條查詢,hash 先會一致
const QUERY = 'trips?select=slug,title,data,updated_at&published=eq.true&order=slug'

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const sha16 = async (t: string) => {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('').slice(0, 16)
}
const currentHash = async () => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${QUERY}`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } })
  if (!r.ok) throw new Error('讀取行程失敗 HTTP ' + r.status)
  return sha16(await r.text())
}
const liveHash = async (): Promise<string | null> => {
  try {
    const r = await fetch(`${SITE}share-manifest.json?t=${Date.now()}`, { cache: 'no-store' })
    return r.ok ? (await r.json()).hash ?? null : null
  } catch { return null }
}
const log = async (action: string, detail: string, reason = '') => {
  try { await sb.from('deploy_log').insert({ action, detail: detail.slice(0, 600), reason }) } catch { /* 記錄失敗唔影響流程 */ }
}

const gh = (path: string, init: RequestInit = {}) =>
  fetch(`https://api.github.com/repos/${REPO}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'benka-trip-sync', ...(init.headers || {}) },
  })

// 派發 deploy.yml;401/403/404/422 係設定問題,唔重試;5xx/限流重試最多 3 次
async function dispatch(): Promise<{ ok: boolean; status: number; detail: string }> {
  for (let a = 1; a <= 3; a++) {
    const r = await gh(`actions/workflows/${WORKFLOW}/dispatches`, { method: 'POST', body: JSON.stringify({ ref: REF }) })
    if (r.status === 204) return { ok: true, status: 204, detail: '' }
    const detail = (await r.text()).slice(0, 300)
    if (r.status < 500 && r.status !== 429) return { ok: false, status: r.status, detail }
    await sleep(1500 * a)
  }
  return { ok: false, status: 0, detail: 'GitHub 5xx 或限流,重試 3 次仍失敗' }
}

async function latestRun() {
  const r = await gh(`actions/workflows/${WORKFLOW}/runs?event=workflow_dispatch&per_page=1`)
  if (!r.ok) return null
  return (await r.json()).workflow_runs?.[0] ?? null
}

async function sync(reason: string) {
  const t0 = Date.now()
  try {
    const cur0 = await currentHash()
    if (cur0 === (await liveHash())) { await log('in_sync', '線上版本已同步,冇需要部署', reason); return }

    const since = new Date(Date.now() - 90_000).toISOString()
    const { data: recent } = await sb.from('deploy_log').select('id').eq('action', 'dispatched').gte('created_at', since).limit(1)
    if (recent?.length) { await log('skipped', '90 秒內已派發部署,由該次追蹤結果', reason); return }
    const hour = new Date(Date.now() - 3_600_000).toISOString()
    const { count } = await sb.from('deploy_log').select('id', { count: 'exact', head: true }).eq('action', 'dispatched').gte('created_at', hour)
    if ((count ?? 0) >= 20) { await log('rate_limited', '每小時派發上限 20 次已到', reason); return }
    if (!GH_TOKEN) { await log('error', 'GH_TOKEN 未設定:未能觸發部署。請喺 Supabase → Edge Functions → Secrets 加入 GH_TOKEN', reason); return }

    for (let attempt = 1; attempt <= 3; attempt++) {
      const d = await dispatch()
      if (!d.ok) {
        const hint = d.status === 401 ? '(憑證失效或已過期,需重新建立)' : d.status === 403 || d.status === 404 ? '(憑證權限不足或唔包含此 repo,需要 Actions: Read and write)' : ''
        await log('error', `派發失敗 HTTP ${d.status}${hint}: ${d.detail}`, reason)
        return
      }
      await log('dispatched', `已派發部署(第 ${attempt} 次)`, reason)

      // 確認真正完成:輪詢線上 manifest,直到 hash = 最新資料 hash
      let retry = false
      while (Date.now() - t0 < 125_000) {
        await sleep(10_000)
        const cur = await currentHash()
        if (cur === (await liveHash())) { await log('verified', `部署完成並已確認(用咗 ${Math.round((Date.now() - t0) / 1000)} 秒)`, reason); return }
        const run = await latestRun()
        if (run?.status === 'completed') {
          if (run.conclusion !== 'success') { await log('error', `部署失敗:${run.conclusion} ${run.html_url}`, reason) }
          else { await log('info', '部署期間行程又有改動,會再派發一次', reason) }
          retry = true
          break
        }
      }
      if (!retry) { await log('pending', '125 秒內未能確認完成(可能仲喺建置),定時檢查會繼續跟進', reason); return }
    }
    await log('error', '重試 3 次後仍未同步,請睇 GitHub Actions 記錄', reason)
  } catch (e) {
    await log('error', String((e as Error)?.message || e), reason)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  const url = new URL(req.url)
  if (url.searchParams.has('status')) {
    try {
      const [cur, live] = await Promise.all([currentHash(), liveHash()])
      return json({ inSync: cur === live, configured: !!GH_TOKEN })
    } catch (e) { return json({ error: String((e as Error)?.message || e) }, 500) }
  }
  let reason = url.searchParams.get('reason') || ''
  try { const b = await req.json(); reason = b?.reason || reason } catch { /* 冇 body */ }
  EdgeRuntime.waitUntil(sync(reason.slice(0, 80)))
  return json({ accepted: true }, 202)
})
