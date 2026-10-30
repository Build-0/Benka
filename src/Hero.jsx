import Icon from './Icon.jsx'

// 頁頂漸變橫幅:標題、副題、數據小格,右上角淡色大圖示做點綴
export default function Hero({ title, sub, icon, stats = [], action, compact }) {
  return (
    <header className={"hero" + (compact ? " compact" : "")}>
      <Icon n={icon} className="deco" />
      <div className="hero-top">
        <div>
          <h1>{title}</h1>
          <div className="sub">{sub}</div>
        </div>
        {action}
      </div>
      {stats.length > 0 && (
        <div className="stats">
          {stats.map((s) => (
            <div key={s.label} className="stat"><b>{s.n}</b><span>{s.label}</span></div>
          ))}
        </div>
      )}
    </header>
  )
}
