import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'
import {
  IconBookmark,
  IconGlobe,
  IconHome,
  IconLogOut,
  IconTrash,
  IconUser,
  IconWarn,
} from './Icons'
import { useLanguage, useUi } from '../i18n'
import { useConfirm } from './ConfirmProvider'
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

export default function TitleBar({
  showProgressLinks = true,
  showLogout = true,
}) {
  const t = useUi()
  const confirm = useConfirm()
  const { language, setLanguage } = useLanguage()
  const location = useLocation()
  const navigate = useNavigate()
  const isHome = location.pathname === '/'

  const [profileOpen, setProfileOpen] = useState(false)
  const [clearError, setClearError] = useState('')
  const [logoutError, setLogoutError] = useState('')
  const profileRef = useRef(null)
  useDismiss(profileRef, profileOpen, () => setProfileOpen(false))

  const languages = [
    { code: 'uz-Latn', label: 'UZ', title: t('latin') },
    { code: 'uz-Cyrl', label: 'ЎЗ', title: t('cyrillic') },
    { code: 'ru', label: 'RU', title: t('russian') },
  ]
  const currentLanguage =
    languages.find((option) => option.code === language) || languages[0]

  async function selectLanguage(code) {
    await window.api.settings.setLanguage(code)
    setLanguage(code)
  }

  function cycleLanguage() {
    const currentIndex = languages.findIndex(
      (option) => option.code === currentLanguage.code
    )
    const nextLanguage = languages[(currentIndex + 1) % languages.length]
    void selectLanguage(nextLanguage.code)
  }

  function openSection(path) {
    setProfileOpen(false)
    navigate(path)
  }

  async function clearQuestions(kind) {
    const saved = kind === 'saved'
    const title = saved ? 'clearSavedQuestions' : 'clearErrors'
    const confirmed = await confirm({
      title: t(title),
      message: t(saved ? 'clearSavedQuestionsConfirm' : 'clearErrorsConfirm'),
      confirmLabel: t('clear'),
      cancelLabel: t('cancel'),
      danger: true,
    })
    if (!confirmed) return

    try {
      setClearError('')
      if (saved) await window.api.saved.clear()
      else await window.api.errors.clear()
    } catch (reason) {
      setClearError(reason.message || String(reason))
    }
  }

  async function logout() {
    const confirmed = await confirm({
      title: t('exitApp'),
      message: t('exitConfirm'),
      confirmLabel: t('exitApp'),
      cancelLabel: t('cancel'),
      danger: true,
    })
    if (!confirmed) return

    try {
      setLogoutError('')
      await window.api.activation.logout()
    } catch (reason) {
      setLogoutError(reason.message || String(reason))
    }
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
        <div className="titlebar-menu-wrap profile-wrap" ref={profileRef}>
          <button
            type="button"
            className={`titlebar-profile-btn${profileOpen ? ' is-open' : ''}`}
            onClick={() => setProfileOpen((open) => !open)}
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
              {showProgressLinks && (
                <>
                  <div className="profile-menu-action">
                    <button
                      type="button"
                      className="profile-menu-link"
                      role="menuitem"
                      onClick={() => openSection('/errors')}
                    >
                      <IconWarn />
                      <span>{t('profileErrors')}</span>
                    </button>
                    <button
                      type="button"
                      className="profile-clear-button"
                      role="menuitem"
                      aria-label={t('clearErrors')}
                      title={t('clearErrors')}
                      onClick={() => void clearQuestions('errors')}
                    >
                      <IconTrash />
                    </button>
                  </div>
                  <div className="profile-menu-action">
                    <button
                      type="button"
                      className="profile-menu-link"
                      role="menuitem"
                      onClick={() => openSection('/saved')}
                    >
                      <IconBookmark />
                      <span>{t('savedQuestions')}</span>
                    </button>
                    <button
                      type="button"
                      className="profile-clear-button"
                      role="menuitem"
                      aria-label={t('clearSavedQuestions')}
                      title={t('clearSavedQuestions')}
                      onClick={() => void clearQuestions('saved')}
                    >
                      <IconTrash />
                    </button>
                  </div>
                </>
              )}
              {clearError && (
                <p className="titlebar-popover-note" role="alert">
                  {clearError}
                </p>
              )}
              {logoutError && (
                <p className="titlebar-popover-note" role="alert">
                  {logoutError}
                </p>
              )}
              <div className="profile-menu-divider" />
              <button
                type="button"
                className="profile-setting-button"
                onClick={cycleLanguage}
                aria-label={`${t('language')}: ${currentLanguage.title}`}
                title={`${t('language')}: ${currentLanguage.title}`}
              >
                <IconGlobe aria-hidden="true" />
                <span>{t('language')}</span>
                <span className="profile-setting-value">
                  {currentLanguage.label}
                </span>
              </button>
              <ThemeToggle menuItem />
              {showLogout && (
                <button
                  type="button"
                  className="profile-setting-button"
                  onClick={() => void logout()}
                  aria-label={t('exitApp')}
                  title={t('exitApp')}
                >
                  <IconLogOut aria-hidden="true" />
                  <span>{t('exitApp')}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
