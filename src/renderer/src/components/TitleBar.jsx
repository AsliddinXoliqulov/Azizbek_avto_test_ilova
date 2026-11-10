import ThemeToggle from './ThemeToggle'
import { useLanguage, useUi } from '../i18n'
import { useLocation, useNavigate } from 'react-router-dom'
import { useConfirm } from './ConfirmProvider'
import darkBrand from '../../../logobg1.png'
import lightBrand from '../../../logobg2.png'

export default function TitleBar() {
  const t = useUi()
  const { language, setLanguage } = useLanguage()
  const location = useLocation()
  const navigate = useNavigate()
  const confirm = useConfirm()

  const languages = [
    { code: 'uz-Latn', label: 'UZ', title: t('latin') },
    { code: 'uz-Cyrl', label: 'ЎЗ', title: t('cyrillic') },
    { code: 'ru', label: 'RU', title: t('russian') },
  ]
  const currentLanguage =
    languages.find((option) => option.code === language) || languages[0]

  async function selectLanguage(nextLanguage) {
    await window.api.settings.setLanguage(nextLanguage)
    setLanguage(nextLanguage)
  }

  function handleBack() {
    const historyIndex = window.history.state?.idx
    if (typeof historyIndex === 'number' && historyIndex > 0) navigate(-1)
    else navigate('/topics', { replace: true })
  }

  async function handleClose() {
    const confirmed = await confirm({
      title: t('exitApp'),
      message: t('exitConfirm'),
      confirmLabel: t('exitApp'),
      cancelLabel: t('cancel'),
      showClose: true,
      closeLabel: t('close'),
      danger: true,
    })
    if (confirmed) window.api.window.close()
  }

  return (
    <div className="titlebar">
      <div className="brand">
        <span className="brand-mark">
          <img
            className="brand-logo-dark"
            src={darkBrand}
            alt="AZIZBEK PRAVA AKADEMIYASI"
          />
          <img
            className="brand-logo-light"
            src={lightBrand}
            alt="AZIZBEK PRAVA AKADEMIYASI"
          />
        </span>
        <span className="brand-copy" aria-label="AZIZBEK PRAVA AKADEMIYASI">
          <strong>AZIZBEK PRAVA</strong>
          <em>AKADEMIYASI</em>
        </span>
      </div>
      <button
        className="titlebar-home-btn"
        type="button"
        onClick={() => navigate('/')}
        disabled={location.pathname === '/'}
        aria-label={t('mainMenu')}
        title={t('mainMenu')}
      >
        <svg className="titlebar-home-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
        </svg>
        <span>{t('mainMenu')}</span>
      </button>
      <div className="titlebar-actions">
        <button
          className="titlebar-back-btn"
          type="button"
          onClick={handleBack}
          disabled={location.pathname === '/'}
          aria-label={t('back')}
          title={t('back')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19 12H5m7 7-7-7 7-7" />
          </svg>
          <span>{t('back')}</span>
        </button>
        <div className="language-switch">
          {languages.map((option) => (
            <button
              key={option.code}
              type="button"
              className={option.code === currentLanguage.code ? 'active' : ''}
              onClick={() => void selectLanguage(option.code)}
              aria-label={option.title}
              aria-pressed={option.code === currentLanguage.code}
              title={option.title}
            >
              {option.label}
            </button>
          ))}
        </div>
        <ThemeToggle />
      </div>
      <div className="win-controls">
        <button
          className="win-btn maximize"
          onClick={() => window.api.window.maximize()}
          title={t('maximize')}
          aria-label={t('maximize')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="5" y="5" width="14" height="14" rx="1" />
          </svg>
        </button>
        <button
          className="win-btn close"
          onClick={() => void handleClose()}
          title={t('close')}
          aria-label={t('close')}
        >
          &#x2715;
        </button>
      </div>
    </div>
  )
}
