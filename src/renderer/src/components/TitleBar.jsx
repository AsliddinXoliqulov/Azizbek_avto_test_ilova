import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'
import {
  IconBookmark,
  IconChevronDown,
  IconHome,
  IconUser,
  IconWarn,
} from './Icons'
import { useLanguage, useUi } from '../i18n'
import darkBrand from '../../../logo-dark.png'
import lightBrand from '../../../logo-light.png'

// Menyu tashqarisiga bosilganda yoki Escape bosilganda yopiladi.
function useDismiss(ref, open, close) {
  useEffect(() => {
    if (!open) return undefined
    const onPointer = (event) => {
      if (!ref.current?.contains(event.target)) close()
    }
    const onKey = (event) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [ref, open, close])
}

export default function TitleBar() {
  const t = useUi()
  const { language, setLanguage } = useLanguage()
  const location = useLocation()
  const navigate = useNavigate()
  const isHome = location.pathname === '/'

  const [langOpen, setLangOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const langRef = useRef(null)
  const profileRef = useRef(null)
  useDismiss(langRef, langOpen, () => setLangOpen(false))
  useDismiss(profileRef, profileOpen, () => setProfileOpen(false))

  const languages = [
    { code: 'uz-Latn', label: 'UZ', title: t('latin') },
    { code: 'uz-Cyrl', label: 'ЎЗ', title: t('cyrillic') },
    { code: 'ru', label: 'RU', title: t('russian') },
  ]
  const current = languages.find((option) => option.code === language) || languages[0]

  async function selectLanguage(code) {
    setLangOpen(false)
    await window.api.settings.setLanguage(code)
    setLanguage(code)
  }

  function openSection(path) {
    setProfileOpen(false)
    navigate(path)
  }

  return (
    <header className={`titlebar${isHome ? ' is-home' : ''}`}>
      <div className="titlebar-start">
        <button
          type="button"
          className="brand"
          onClick={() => navigate('/')}
          aria-label={t('mainMenu')}
        >
          <span className="brand-mark">
            <img className="brand-logo-dark" src={darkBrand} alt="" />
            <img className="brand-logo-light" src={lightBrand} alt="" />
          </span>
          <span className="brand-copy">
            <strong>AZIZBEK PRAVA</strong>
            <em>AKADEMIYASI</em>
          </span>
        </button>
      </div>

      <button
        className="titlebar-home-btn"
        type="button"
        onClick={() => navigate('/')}
        disabled={isHome}
        aria-label={t('mainMenu')}
        title={t('mainMenu')}
      >
        <IconHome className="titlebar-home-icon" />
        <span>{t('mainMenu')}</span>
      </button>

      <div className="titlebar-actions">
        <div className="titlebar-menu-wrap lang-wrap" ref={langRef}>
          <button
            type="button"
            className={`titlebar-lang-btn${langOpen ? ' is-open' : ''}`}
            onClick={() => {
              setProfileOpen(false)
              setLangOpen((open) => !open)
            }}
            aria-label={`${t('language')}: ${current.title}`}
            aria-expanded={langOpen}
            aria-haspopup="menu"
          >
            <span>{current.label}</span>
            <IconChevronDown className="chev" />
          </button>
          {langOpen && (
            <div className="titlebar-popover" role="menu">
              {languages.map((option) => (
                <button
                  key={option.code}
                  type="button"
                  role="menuitemradio"
                  aria-checked={option.code === current.code}
                  className={option.code === current.code ? 'active' : ''}
                  onClick={() => void selectLanguage(option.code)}
                >
                  <b>{option.label}</b>
                  <span>{option.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <ThemeToggle />

        <div className="titlebar-menu-wrap profile-wrap" ref={profileRef}>
          <button
            type="button"
            className={`titlebar-profile-btn${profileOpen ? ' is-open' : ''}`}
            onClick={() => {
              setLangOpen(false)
              setProfileOpen((open) => !open)
            }}
            aria-label={t('profile')}
            aria-expanded={profileOpen}
            aria-haspopup="menu"
            title={t('profile')}
          >
            <span className="titlebar-profile-avatar">
              <IconUser />
            </span>
          </button>
          {profileOpen && (
            <div className="titlebar-popover profile-popover" role="menu">
              <button type="button" role="menuitem" onClick={() => openSection('/errors')}>
                <IconWarn />
                <span>{t('profileErrors')}</span>
              </button>
              <button type="button" role="menuitem" onClick={() => openSection('/saved')}>
                <IconBookmark />
                <span>{t('savedQuestions')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
