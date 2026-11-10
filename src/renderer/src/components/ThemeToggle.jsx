import { useEffect, useState } from 'react'
import { useUi } from '../i18n'

export default function ThemeToggle() {
  const [theme, setThemeState] = useState('dark')
  const t = useUi()

  useEffect(() => {
    window.api.theme.get().then((savedTheme) => {
      const resolved = savedTheme === 'light' ? 'light' : 'dark'
      setThemeState(resolved)
      applyTheme(resolved)
    })
  }, [])

  function applyTheme(nextTheme) {
    document.documentElement.setAttribute('data-theme', nextTheme)
  }

  function chooseTheme(next) {
    setThemeState(next)
    applyTheme(next)
    window.api.theme.set(next)
  }

  const nextTheme = theme === 'light' ? 'dark' : 'light'
  const currentLabel = theme === 'light' ? t('themeDay') : t('themeNight')
  const currentIcon = theme === 'light' ? '☀' : '☾'

  return (
    <button
      className="titlebar-cycle-btn theme-cycle-btn"
      type="button"
      onClick={() => chooseTheme(nextTheme)}
      aria-label={t('theme')}
      title={`${t('theme')}: ${currentLabel}`}
    >
      {currentIcon}
    </button>
  )
}
