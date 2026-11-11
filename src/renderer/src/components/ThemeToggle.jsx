import { useEffect, useState } from 'react'
import { useUi } from '../i18n'
import { IconMoon, IconSun } from './Icons'

const THEME_COLORS = { dark: '#060b16', light: '#eef3fb' }

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
  document.documentElement.style.colorScheme = theme
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLORS[theme] || THEME_COLORS.dark)
  try {
    localStorage.setItem('pdd_theme', theme)
  } catch {
    /* localStorage mavjud emas */
  }
}

export default function ThemeToggle() {
  const [theme, setThemeState] = useState(
    () => document.documentElement.getAttribute('data-theme') || 'dark'
  )
  const t = useUi()

  useEffect(() => {
    window.api.theme.get().then((savedTheme) => {
      const resolved = savedTheme === 'light' ? 'light' : 'dark'
      setThemeState(resolved)
      applyTheme(resolved)
    })
  }, [])

  function chooseTheme(next) {
    setThemeState(next)
    applyTheme(next)
    window.api.theme.set(next)
  }

  const nextTheme = theme === 'light' ? 'dark' : 'light'
  const currentLabel = theme === 'light' ? t('themeDay') : t('themeNight')

  return (
    <button
      className="titlebar-cycle-btn theme-cycle-btn"
      type="button"
      onClick={() => chooseTheme(nextTheme)}
      aria-label={`${t('theme')}: ${currentLabel}`}
      title={`${t('theme')}: ${currentLabel}`}
    >
      {theme === 'light' ? <IconSun /> : <IconMoon />}
    </button>
  )
}
