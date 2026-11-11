import { useEffect, useState } from 'react'
import { useUi } from '../i18n'
import logoDark from '../../../logo-dark.png'
import logoLight from '../../../logo-light.png'

export default function Activation({ onActivated, notice = '' }) {
  const t = useUi()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    window.api.activation.getSavedCode().then((saved) => {
      if (!active) return
      if (saved.code) setCode((current) => current.trim() ? current : saved.code)
      if (saved.error) setError(saved.error)
    }).catch((loadError) => {
      console.error('[activation] Saqlangan kodni olishda xatolik:', loadError)
      if (active) setError(t('activationError'))
    })
    return () => {
      active = false
    }
  }, [t])

  async function submit(e) {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await window.api.activation.activate(code.trim())
      if (res.ok) {
        onActivated?.()
        setCode('')
      } else {
        setError(res.message || t('activationError'))
      }
    } catch (submitError) {
      setError(submitError.message || t('activationError'))
    } finally {
      setLoading(false)
    }
  }

  async function retryDevice() {
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.activation.retryDeviceActivation(code)
      if (result.ok) onActivated?.()
      else setError(
        result.error === 'NO_SAVED_CODE'
          ? t('activationNoSavedCode')
          : result.message || t('activationError')
      )
    } catch (retryError) {
      setError(retryError.message || t('activationError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="activation-wrap">
      <form className="glass activation-card" onSubmit={submit}>
        <img className="activation-logo brand-logo-dark" src={logoDark} alt="AZIZBEK PRAVA AKADEMIYASI" />
        <img className="activation-logo brand-logo-light" src={logoLight} alt="" aria-hidden="true" />
        <strong className="activation-brand">AZIZBEK PRAVA AKADEMIYASI</strong>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 6px' }}>{t('activationTitle')}</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: 0 }}>
            {t('activationHint')}
          </p>
        </div>
        <div className="field">
          <input
            className="input code-input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="WEBXXXXXXXX"
            maxLength={11}
            autoFocus
          />
        </div>

        {notice && <div className="error-text">{t(notice)}</div>}
        {error && <div className="error-text">{error}</div>}

        <div className={`activation-actions${notice ? ' has-retry' : ''}`}>
          {notice && (
            <button
              type="button"
              className="btn btn-primary btn-lg btn-block"
              onClick={() => void retryDevice()}
              disabled={loading}
            >
              {loading ? t('activationChecking') : t('activationRetry')}
            </button>
          )}
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
            {loading
              ? t('activationChecking')
              : t(notice ? 'activateWithCode' : 'activate')}
          </button>
        </div>
      </form>
    </div>
  )
}
