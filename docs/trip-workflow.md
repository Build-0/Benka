# 行程發布流程(ChatGPT → Benka → 分享)

1. **ChatGPT 研究**:喺「行程」頁撳「複製 ChatGPT 指示」,貼去 ChatGPT,後面寫旅行需求。ChatGPT 核實資料同相片授權,輸出一個 JSON(格式見 `trip-schema.md`)。
2. **匯入**:將 JSON 貼落「行程」頁 →「檢查」(會列出錯誤同缺失,例如相片冇 credit)→「存為草稿」。
3. **確認**:撳「預覽」(只有你登入先睇到草稿,頂部有橙色「草稿預覽」條),滿意就「發布」。
4. **自動同步**:行程內容即時更新。WhatsApp 預覽卡(封面、標題)同本站相片副本由 GitHub Actions 每 15 分鐘偵測行程改動,有改就自動重新建置部署,唔使手動。
5. **分享**:喺「行程」頁撳「複製分享連結」(`…/Benka/t/<slug>/`),傳畀家人。

## 自動化嘅位置
- `.github/workflows/deploy.yml`:push / 手動 / 每 15 分鐘。定時嗰次先比較行程資料 hash(`share-manifest.json`),冇改就唔建置。
- `scripts/gen-share.mjs`:建置後將行程相片鏡像到 `trip-img/`(縮細轉 JPEG)、生成 `/t/<slug>/` 預覽頁同 `og.jpg`、寫 `share-report.json`(相片數量、缺 credit 嘅位置)。
- 行程頁優先用本站相片副本,失敗退返原網址,再失敗顯示備用底色。

## 限制
- 預覽卡最多約 15 分鐘(加 GitHub 排程延遲)先更新;WhatsApp 自己會快取舊預覽,改咗之後要用新連結或等佢過期。
- 相片仍然要有可轉載授權;搵唔到合法相就唔放(冇相會用文字版面)。

## 相片來源(AI 處理,唔使人手逐張搵)
- `node scripts/find-images.mjs "關鍵字" 8`:搜 Wikimedia Commons(只收 CC0 / 公有領域 / CC BY / CC BY-SA,解像度 ≥ 1200 寬),直接輸出可貼入行程 JSON 嘅 `image` 同 `credit`(作者 / 來源,授權)。設咗 `PEXELS_KEY` 環境變數會同時搜 Pexels。
- 揀相後要核對「相片真係對應嗰個地點」;唔係該地點本身(鄰近海灘、示意)要喺 credit 註明。
- 相片會喺建置時自動鏡像到本站,頁面唔會因為外部網址失效而爛圖。
- 新開幕嘅酒店/景點(例如 MGM 深圳、深圳自然博物館,2026 年開幕)暫時冇開放授權相片:Commons、Flickr CC 都搵唔到。要用真相只有兩條路:官方授權(寄申請信)或擁有者自己拍。
