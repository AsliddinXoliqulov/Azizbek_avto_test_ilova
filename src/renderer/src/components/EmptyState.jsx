export default function EmptyState({ emoji = '🗂️', title, hint }) {
  return (
    <div className="empty-state glass">
      {emoji && <div className="emoji">{emoji}</div>}
      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{title}</div>
      {hint && <div>{hint}</div>}
    </div>
  )
}
