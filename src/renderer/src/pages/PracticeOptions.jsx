import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import MenuCard from '../components/MenuCard'
import { useUi } from '../i18n'
import { useDatabaseRevision } from '../web/useDatabaseRevision'

export default function PracticeOptions({ teacher = false, unified = false }) {
  const { mode: routeMode } = useParams()
  const navigate = useNavigate()
  const t = useUi()
  const databaseRevision = useDatabaseRevision()
  const [count, setCount] = useState(null)
  const [categoryCounts, setCategoryCounts] = useState(null)
  const [countPrompt, setCountPrompt] = useState(null)
  const [attemptPrompt, setAttemptPrompt] = useState(null)
  const [error, setError] = useState('')
  const mode = routeMode
  const validMode = unified || mode === 'similar' || mode === 'numeric'

  useEffect(() => {
    if (!unified && !validMode) {
      navigate('/', { replace: true })
      return
    }
    let active = true
    setError('')
    if (unified) {
      setCategoryCounts(null)
      Promise.all([
        window.api.catalog.questionCounts(),
        window.api.catalog.newQuestionCount(),
      ])
        .then(([counts, newCount]) => {
          if (active) {
            setCategoryCounts({
              similar: counts.similar,
              numeric: counts.numeric,
              'new-questions': newCount,
            })
          }
        })
        .catch((reason) => {
          if (active) setError(reason.message || String(reason))
        })
    } else {
      setCount(null)
      const request =
        mode === 'new-questions'
          ? window.api.catalog.newQuestionCount()
          : window.api.catalog.questionCounts().then((counts) => counts[mode])
      request
        .then((value) => {
          if (active) setCount(value)
        })
        .catch((reason) => {
          if (active) setError(reason.message || String(reason))
        })
    }
    return () => {
      active = false
    }
  }, [mode, navigate, unified, validMode, databaseRevision])

  useEffect(() => {
    if (teacher && count > 0) {
      navigate('/run', {
        replace: true,
        state:
          mode === 'new-questions'
            ? { mode, count, untimed: true, showExplanations: true }
            : { mode, untimed: true, showExplanations: true },
      })
    }
  }, [teacher, count, mode, navigate])

  if (error) return <div className="error-text">{error}</div>
  if (!validMode) return null
  if (!unified && count === null) return null
  if (!unified && count === 0) {
    return (
      <EmptyState
        emoji="🗂️"
        title={
          mode === 'similar'
            ? t('noSimilarQuestions')
            : mode === 'numeric'
              ? t('noNumericQuestions')
              : t('noAdminNewQuestions')
        }
      />
    )
  }
  if (teacher) return null

  const title =
    mode === 'similar'
      ? t('similarQuestions')
      : mode === 'numeric'
        ? t('numericQuestions')
        : t('newQuestions')

  if (unified) {
    const categories = [
      {
        mode: 'similar',
        title: t('similarQuestions'),
      },
      {
        mode: 'numeric',
        title: t('numericQuestions'),
      },
      {
        mode: 'new-questions',
        title: t('newQuestions'),
      },
    ]

    async function chooseCount(choice) {
      if (!countPrompt) return
      const { mode: selectedMode, count: available } = countPrompt
      const selectedCount = choice === 'all' ? available : 20
      const runState =
        selectedMode === 'new-questions'
          ? choice === 'all'
            ? {
                mode: selectedMode,
                count: selectedCount,
                showHelp: true,
                untimed: true,
              }
            : { mode: selectedMode, count: selectedCount, showHelp: false }
          : choice === 'all'
            ? { mode: selectedMode, count: selectedCount, untimed: true }
            : { mode: selectedMode, count: selectedCount }
      setCountPrompt(null)
      try {
        const attempt = await window.api.tests.activeAttempt({
          mode: selectedMode,
          count: selectedCount,
        })
        if (attempt) {
          setAttemptPrompt({ runState, attempt })
        } else {
          navigate('/run', { state: runState })
        }
      } catch (reason) {
        setError(reason.message || String(reason))
      }
    }

    function resolveAttempt(resume) {
      if (!attemptPrompt) return
      navigate('/run', {
        state: {
          ...attemptPrompt.runState,
          ...(resume ? { resumeAttemptId: attemptPrompt.attempt.id } : {}),
        },
      })
      setAttemptPrompt(null)
    }

    return (
      <div className="question-practice-page">
        {error && <div className="error-text">{error}</div>}
        {categoryCounts && (
          <div className="menu-grid menu-grid-list question-practice-categories">
            {categories.map((category) => (
              <button
                key={category.mode}
                type="button"
                className="glass menu-card question-practice-category"
                disabled={!categoryCounts[category.mode]}
                onClick={() =>
                  setCountPrompt({
                    mode: category.mode,
                    count: categoryCounts[category.mode],
                  })
                }
              >
                <h3>{category.title}</h3>
              </button>
            ))}
          </div>
        )}

        {countPrompt && (
          <div
            className="modal-overlay confirm-modal-overlay"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setCountPrompt(null)
            }}
          >
            <section
              className="glass confirm-modal practice-count-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="practice-count-title"
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.stopPropagation()
                  setCountPrompt(null)
                }
              }}
            >
              <button
                type="button"
                className="confirm-modal-close"
                aria-label={t('close')}
                title={t('close')}
                onClick={() => setCountPrompt(null)}
              >
                <span aria-hidden="true">×</span>
              </button>
              <div className="confirm-modal-copy">
                <h2 id="practice-count-title">
                  {
                    categories.find(
                      (category) => category.mode === countPrompt.mode
                    )?.title
                  }
                </h2>
              </div>
              <div className="exam-count-options">
                <button
                  type="button"
                  className="glass exam-count-card"
                  disabled={countPrompt.count < 20}
                  onClick={() => void chooseCount(20)}
                >
                  <strong>
                    <span>{t('practiceTimed20Count')}</span>
                    <span className="practice-timed-extra">
                      {t('practiceTimed20Suffix')}
                    </span>
                  </strong>
                </button>
                <button
                  type="button"
                  className="glass exam-count-card"
                  disabled={countPrompt.count === 0}
                  onClick={() => void chooseCount('all')}
                >
                  <strong>{t('practiceAll')}</strong>
                </button>
              </div>
            </section>
          </div>
        )}

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
              aria-labelledby="practice-attempt-title"
              aria-describedby="practice-attempt-message"
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
                <h2 id="practice-attempt-title">{t('questions')}</h2>
                <p id="practice-attempt-message">
                  {attemptPrompt.attempt.status === 'expired'
                    ? t('expiredPracticePrompt')
                    : t('unfinishedPracticePrompt')}
                </p>
              </div>
              <div className="confirm-modal-actions">
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => resolveAttempt(false)}
                >
                  {t('restartTest')}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  autoFocus
                  onClick={() => resolveAttempt(true)}
                >
                  {attemptPrompt.attempt.status === 'expired'
                    ? t('reviewResult')
                    : t('continueExam')}
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          <div className="sub">{t('practiceChooseMode', { count })}</div>
        </div>
      </div>
      <div className="menu-grid menu-grid-list practice-options-grid">
        <MenuCard
          to="/run"
          state={{ mode, count: 20 }}
          title={t('practiceTimed20')}
        />
        <MenuCard to="/run" state={{ mode }} title={t('practiceAll')} />
      </div>
    </div>
  )
}
