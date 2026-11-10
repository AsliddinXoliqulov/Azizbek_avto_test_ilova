import { useState } from 'react'
import { useUi } from '../i18n'
import logo from '../../../logoilova2.png'

export default function Activation({ onActivated }) {
  const t = useUi()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

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

  return (
    <div className="activation-wrap">
      <form className="glass activation-card" onSubmit={submit}>
        <img className="activation-logo" src={logo} alt="AZIZBEK PRAVA AKADEMIYASI" />
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
            placeholder="XXXXXXXX"
            maxLength={10}
            autoFocus
          />
        </div>

        {error && <div className="error-text">{error}</div>}

        <div className="activation-actions">
          <button className="btn btn-primary btn-lg btn-block" disabled={loading}>
            {loading ? t('activationChecking') : t('activate')}
          </button>
        </div>
      </form>
    </div>
  )
}
