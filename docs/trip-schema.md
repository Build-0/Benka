# 行程資料格式(trips.data)

版面固定,內容全部喺 `trips` 表嘅 `data`(JSON)。網址 `#/t/<slug>`,分享連結用 `/t/<slug>/`(有 WhatsApp 預覽卡)。
`published=true` 先會公開。新增/更新行程後要重新部署(push 一次)先會更新分享預覽卡。

## 語氣
- 介紹性文字(`cover.subtitle`、`day.intro`、核心/次重點嘅 `text`、`hotel.text`):自然、精簡、有畫面感。
- 資訊性文字(交通、時間、價錢、預訂、注意事項、`tips`):準確、直接,唔修飾。

## 結構
```
cover: { image, credit, pos, ogPos, subtitle, tags[], accent, dark }   // accent/dark = 主色/深色(#rrggbb,選填)       // pos = object-position,例如 "35% 50%";ogPos 係預覽卡裁切
summary: [{label, value}]
checks: [待確認事項]                                          // 收埋喺頂部一行,可展開
days: [{
  label, theme, title, date, intro,
  image, credit, pos, ratio,                                   // 每日代表相(ratio 預設 4 / 3)
  gallery: [{image, credit, caption, pos}],
  items: [{
    time, end, title, text, icon,
    kind: core | transport | meal | note,
    importance: 3 | 2 | 1,                                     // 3 大圖 · 2 小圖並排 · 1 精簡時間軸
    image, credit, pos, ratio,                                 // ratio: wide | standard | square | tall 或 "16 / 9"
    map: {q | lat,lng | url}, links: [{label,url}],
    tips: [詳細資料,收入「詳細資料」], verify: true            // verify = 待確認
  }]
}]
hotel: { name, text, highlights[], image, credit, pos, map, links, verify }
transport: [{ title, text, steps[], image, credit, links, verify }]
budget: { currency, items: [{label, amount|null, note}], note }   // amount 為 null 顯示「待查」
tips[], links[], sources: [{label,url}]
```
不寫 `importance` 時:有相 → 3、冇相 → 1;`kind` 係 transport/meal/note → 1。
所有欄位都係選填,冇相就自動用文字版面,冇封面相就用漸變色封面。

## 相片規則
只用有授權嘅真實相(Wikimedia Commons、自己拍、官方授權)。`credit` 要寫作者 + 授權。
相片唔係該地點本身時,`credit` 要寫明(例如「鄰近海灘」「示意相片」)。唔用 AI 圖。

## 版面規則(自動)
- 頁面層次:第一層「旅程一覽」(每日主題 + 主要安排 + 酒店/交通/預算,純文字)→ 第二層每日行程 + 酒店 + 交通 + 預算 → 第三層「詳細資訊」(待確認、小提醒、連結、資料來源,全部收埋)。
- 同一張相只顯示一次(重複嘅自動拎走);冇指定 pos 時,直幅相放入橫框會取偏上位置。
- 標題用「｜」分隔會變成小標 + 主標。
- 桌面闊畫面每日會左右分欄(左邊標題/相貼頂,右邊行程)。
