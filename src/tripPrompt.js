// 畀 ChatGPT 嘅固定指示:佢按呢個格式輸出一個 JSON,貼入「行程」頁匯入。
export const TRIP_PROMPT = `你係旅遊行程編輯。請按以下規則,為我嘅旅行輸出「一個 JSON 物件」(只輸出 JSON,唔好加解釋,唔好用 markdown 代碼框)。

【內容規則】
- 所有資料(交通、班次、票價、開放時間、酒店、預訂條件)要上網核實。未能核實嘅,該項加 "verify": true,金額寫 null,唔好估。
- 介紹性文字(cover.subtitle、days[].intro、核心項目 text、hotel.text):自然、精簡、有畫面感。
- 資訊性文字(交通、時間、價錢、預訂、注意事項、tips):準確、直接,唔修飾。
- 用廣東話書面語氣。

【相片規則】
- 只用有授權、可轉載嘅真實相片:Wikimedia Commons、官方明確允許使用嘅宣傳相、免費授權圖庫(Unsplash / Pexels / Pixabay)。
- 每個 image 一定要有 credit:「作者 / 來源,授權(例如 CC BY-SA 4.0)」。
- 相片唔係該地點本身時(鄰近海灘、示意相),credit 要寫明「示意相片」或「鄰近…」。
- 優先:該酒店/景點本身嘅外觀、房間、泳池、設施相。唔好用 AI 生成相,唔好用其他地點嘅相冒充。
- image 要係可直接開啟嘅 https 圖片網址。
- 同一張相只用一次(封面、每日、項目唔好重複);每日 image 用嚟代表嗰日主題。
- 標題如果想分兩行,用「｜」分開,例如「深圳親子兩天一夜｜恐龍博物館 × 小梅沙美高梅」。
- 官方網站相片未獲授權就唔好放,只放連結(links)。

【JSON 格式】
{
  "slug": "細階英文-數字-連字號,例如 sz-dino-7k3q(加幾個隨機字,避免被估到)",
  "title": "行程標題",
  "cover": { "image": "https://…", "credit": "…", "pos": "50% 50%", "ogPos": "50% 50%", "subtitle": "一至兩句介紹", "tags": ["親子", "2 日 1 夜", "深圳"], "accent": "#d9582b(選填:主色,可按目的地配色)", "dark": "#14283f(選填:深色)" },
  "summary": [ { "label": "出發地", "value": "澳門" }, { "label": "日期", "value": "待定" } ],
  "checks": [ "出發前仍要確認嘅事項" ],
  "days": [
    {
      "label": "Day 1", "theme": "海濱度假", "title": "出發・坐船・入住", "date": "日期",
      "image": "https://…", "credit": "…", "pos": "50% 50%", "intro": "當日介紹",
      "gallery": [ { "image": "https://…", "credit": "…", "caption": "…" } ],
      "items": [
        { "time": "09:00", "end": "10:00", "kind": "core", "importance": 3, "title": "景點/活動",
          "text": "簡介", "image": "https://…", "credit": "…", "ratio": "standard",
          "map": { "q": "地點名稱" }, "links": [ { "label": "官網", "url": "https://…" } ],
          "tips": [ "詳細資料,會收入「詳細資料」" ], "verify": false }
      ]
    }
  ],
  "hotel": { "name": "…", "text": "…", "highlights": [ "…" ], "image": "https://…", "credit": "…", "map": { "q": "…" }, "links": [], "verify": false },
  "transport": [ { "title": "…", "text": "…", "steps": [ "…" ], "verify": true } ],
  "budget": { "currency": "¥", "items": [ { "label": "船票", "amount": null, "note": "往返,按人數" } ], "note": "…" },
  "tips": [ "…" ],
  "links": [ { "label": "…", "url": "https://…" } ],
  "sources": [ { "label": "資料來源名稱", "url": "https://…" } ]
}

kind:core 核心體驗 | transport 交通 | meal 餐飲 | note 注意事項。
importance:3 大圖重點 | 2 小圖並排 | 1 精簡時間軸(交通、餐飲用 1)。
ratio:wide | standard | square | tall。所有欄位都係選填,冇相就唔好寫 image。

我嘅旅行需求:`
