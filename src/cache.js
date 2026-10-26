// 本機快取:開頁即刻有內容(先顯示上次資料,再背景更新),登出時清走
const P = 'bk:'
export const cget = (k) => { try { return JSON.parse(localStorage.getItem(P + k)) } catch { return null } }
export const cset = (k, v) => { try { localStorage.setItem(P + k, JSON.stringify(v)) } catch { /* 私隱模式略過 */ } }
export const cclear = () => {
  try { Object.keys(localStorage).filter((k) => k.startsWith(P)).forEach((k) => localStorage.removeItem(k)) } catch { /* ignore */ }
}
