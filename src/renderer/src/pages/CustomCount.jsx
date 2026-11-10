import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUi } from '../i18n'
import { useDatabaseRevision } from '../web/useDatabaseRevision'

const PRESET_COUNTS = [100, 200, 500]

export default function CustomCount() {
  const [total, setTotal] = useState(null)
  const [attemptPrompt, setAttemptPrompt] = useState(null)
  const navigate = useNavigate()
  const t = useUi()
  const databaseRevision = useDatabaseRevision()

  useEffect(() => {
    window.api.catalog.totalQuestions().then(setTotal)
  }, [databaseRevision])

  function launch(count, resumeAttemptId) {
    navigate('/run', {
      state: {
        mode: 'custom',
        count,
        untimed: true,
        ...(resumeAttemptId ? { resumeAttemptId } : {}),
      },
    })
  }

  async function start(count) {
    if (count <= 0) return
    const attempt = await window.api.tests.activeAttempt({
      mode: 'custom',
      count,
    })
    if (attempt) {
      setAttemptPrompt({ count, attempt })
      return
    }
    launch(count)
  }

  function resolveAttemptPrompt(resume) {
    if (!attemptPrompt) return
    launch(attemptPrompt.count, resume ? attemptPrompt.attempt.id : undefined)
    setAttemptPrompt(null)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t('customTitle')}</h1>
        </div>
      </div>

      <div
        className="menu-grid menu-grid-list count-options"
        role="group"
        aria-label={t('pickCount')}
      >
        {PRESET_COUNTS.map((preset) => (
          <button
            key={preset}
            type="button"
            className="glass menu-card count-option"
            onClick={() => start(preset)}
            disabled={total === null || total < preset}
          >
            <strong>{preset}</strong>
          </button>
        ))}
        <button
          type="button"
          className="glass menu-card count-option count-option-all"
          onClick={() => start(total)}
          disabled={total === null || total === 0}
        >
          <strong>{t('all')}</strong>
        </button>
      </div>
      {attemptPrompt && (
        <div
          className="modal-overlay confirm-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAttemptPrompt(null)
          }}
        >
          <section
            className="glass confirm-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="custom-prompt-title"
            aria-describedby="custom-prompt-message"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation()
                setAttemptPrompt(null)
              }
            }}
          >
            <button
              type="button"
              className="confirm-modal-close"
              aria-label={t('close')}
              title={t('close')}
              onClick={() => setAttemptPrompt(null)}
            >
              <span aria-hidden="true">×</span>
            </button>
            <div className="confirm-modal-icon" aria-hidden="true">
              ?
            </div>
            <div className="confirm-modal-copy">
              <h2 id="custom-prompt-title">{t('generalTest')}</h2>
              <p id="custom-prompt-message">{t('unfinishedGeneralTest')}</p>
            </div>
            <div className="confirm-modal-actions">
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => resolveAttemptPrompt(false)}
              >
                {t('restartTest')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                autoFocus
                onClick={() => resolveAttemptPrompt(true)}
              >
                {t('continueExam')}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
