import { NavLink, useLocation } from 'react-router-dom'
import { IconBook, IconExam, IconGrid, IconHome, IconList } from './Icons'
import { useUi } from '../i18n'

const matches = (pathname, prefixes) =>
  prefixes.some((p) => (p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(`${p}/`)))

export default function BottomNav() {
  const t = useUi()
  const { pathname } = useLocation()

  const items = [
    { to: '/', label: t('navHome'), Icon: IconHome, match: ['/'] },
    { to: '/topics', label: t('lessons'), Icon: IconBook, match: ['/topics', '/lessons', '/custom'] },
    { to: '/exam', label: t('realExam'), Icon: IconExam, match: ['/exam'] },
    {
      to: '/question-practice',
      label: t('questions'),
      Icon: IconList,
      match: ['/question-practice', '/practice', '/new-questions'],
    },
    { to: '/variants', label: t('variants'), Icon: IconGrid, match: ['/variants'] },
  ]

  return (
    <nav className="bottom-nav" aria-label={t('mainMenu')}>
      {items.map(({ to, label, Icon, match }) => {
        const active = matches(pathname, match)
        return (
          <NavLink
            key={to}
            to={to}
            className={`bottom-nav-item${active ? ' is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <span className="bottom-nav-icon">
              <Icon />
            </span>
            <span className="bottom-nav-label">{label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
