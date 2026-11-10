import { useNavigate } from 'react-router-dom'

export default function MenuCard({ to, state, icon, title, description, badge, className = '', disabled = false }) {
  const navigate = useNavigate()
  return (
    <div
      className={`glass menu-card ${className}${disabled ? ' disabled' : ''}`}
      onClick={disabled ? undefined : () => navigate(to, state ? { state } : undefined)}
      aria-disabled={disabled}
    >
      {icon && <div className="icon">{icon}</div>}
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {badge != null && badge > 0 && <span className="badge">{badge}</span>}
    </div>
  )
}
