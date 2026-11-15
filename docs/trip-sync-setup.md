# 行程改動 → 自動重建分享預覽(即時觸發)

## 運作
行程(已發布)新增/修改/取消發布/刪除 → 資料庫觸發器 `trips_sync_after` → pg_net 非同步呼叫 Edge Function `trip-sync` →
函數比較「線上 `share-manifest.json` hash」同「最新行程資料 hash」:
- 一樣 → 記 `in_sync`,唔做嘢。
- 唔一樣 → 用 `GH_TOKEN` 派發 `deploy.yml`(main),然後每 10 秒輪詢線上 manifest,hash 一致先記 `verified`。
  建置失敗(run conclusion ≠ success)記錄 run 連結並自動重試,最多 3 次;5xx/限流派發重試 3 次;401/403/404 唔重試,直接記錄原因。
- 全部紀錄喺 `public.deploy_log`(只有登入嘅行程擁有者睇到),「行程」管理頁會顯示「已同步 ✓ / 同步中」同最近紀錄,並有「重新同步」。
- 備用:`deploy.yml` 仍然每 15 分鐘定時檢查一次(GitHub 排程可能延遲)。

## 權限與限制(點解唔需要共享密碼)
- 函數網址公開,但「可以做嘅事」固定:只可以令固定嘅 `deploy.yml`(main)喺「確實未同步」時重建;90 秒內唔重複派發,每小時最多 20 次。
- GitHub 憑證只放喺 Supabase Edge Function Secrets(`GH_TOKEN`),唔喺前端、資料庫、程式碼或 GitHub。
- 憑證應該係 Fine-grained token:Resource owner `Build-0`、Repository 只揀 `Benka`、權限只開 **Actions: Read and write**(其他全部 No access),有效期建議 90 天。
- 憑證過期/失效:紀錄會顯示「憑證失效或已過期」,管理頁會提示;重新建立 token 並更新 Secret 即可。

## 需要擁有者做嘅設定(一次性,唔使將 token 畀任何人)
1. GitHub → Settings → Developer settings → Fine-grained personal access tokens → Generate new token:
   - Repository access: Only select repositories → `Build-0/Benka`
   - Permissions → Repository permissions → **Actions: Read and write**(其餘留 No access;Metadata 會自動 Read)
   - Expiration: 90 days
2. Supabase Dashboard → 專案 → Edge Functions → Secrets → Add new secret:名 `GH_TOKEN`,值貼 token → Save。(只喺呢個欄位貼,唔好貼去聊天。)
3. 之後喺「行程」管理頁撳「重新同步」,應該見到「已同步 ✓」同紀錄 `已完成並確認`。

## 回復方法
```sql
drop trigger if exists trips_sync_after on public.trips;
drop function if exists public.trips_notify_sync();
drop table if exists public.deploy_log;
```
再喺 Supabase Dashboard 刪除 Edge Function `trip-sync`,並刪除 Secret `GH_TOKEN`、喺 GitHub 撤銷該 token。行程資料同其他模組唔受影響。
