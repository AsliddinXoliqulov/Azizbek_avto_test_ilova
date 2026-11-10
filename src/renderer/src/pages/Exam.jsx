import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage, useUi } from '../i18n'
import { useDatabaseRevision } from '../web/useDatabaseRevision'
import sectionOneIcon from '../images/1bolim.svg'
import sectionTwoIcon from '../images/2bolim.svg'
import sectionThreeIcon from '../images/3bolim.svg'
import sectionFourIcon from '../images/4bolim.svg'
import sectionFiveIcon from '../images/5bolim.svg'

const SECTION_ICONS = [
  sectionOneIcon,
  sectionTwoIcon,
  sectionThreeIcon,
  sectionFourIcon,
  sectionFiveIcon,
]

function ExamSectionIcon({ index, section }) {
  const order = Number(section?.order ?? index + 1)
  const imageSource = SECTION_ICONS[Math.max(0, Math.min(order - 1, SECTION_ICONS.length - 1))] ?? SECTION_ICONS[0]

  return (
    <img
      className="exam-section-icon"
      src={imageSource}
      alt=""
      aria-hidden="true"
      draggable="false"
    />
  )
}

export default function Exam() {
  const [settings, setSettings] = useState({
    exam_question_count: 20,
    exam_seconds: 1500,
  })
  const [total, setTotal] = useState(0)
  const [sections, setSections] = useState(null)
  const [countPrompt, setCountPrompt] = useState(null)
  const [attemptPrompt, setAttemptPrompt] = useState(null)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { language } = useLanguage()
  const t = useUi()
  const databaseRevision = useDatabaseRevision()

  useEffect(() => {
    let active = true
    Promise.all([
      window.api.settings.get(),
      window.api.catalog.totalQuestions(),
      window.api.catalog.sections(),
    ])
      .then(([nextSettings, questionTotal, sectionRows]) => {
        if (!active) return
        setSettings(nextSettings)
        setTotal(questionTotal)
        setSections(sectionRows)
      })
      .catch((reason) => {
        if (active) setError(reason.message || String(reason))
      })
    return () => {
      active = false
    }
  }, [language, databaseRevision])

  function startExam(scope, count, resumeAttemptId) {
    const section = scope.section
    navigate('/run', {
      state: {
        mode: section ? 'section-exam' : 'exam',
        count,
        isRealExam: true,
        ...(section
          ? { sectionId: section.id, sectionTitle: section.name }
          : {}),
        ...(resumeAttemptId ? { resumeAttemptId } : {}),
      },
    })
  }

  async function chooseCount(count) {
    const scope = countPrompt
    if (!scope) return
    setCountPrompt(null)
    setError('')
    try {
      const attempt = await window.api.tests.activeAttempt({
        mode: scope.section ? 'section-exam' : 'exam',
        ...(scope.section ? { sectionId: scope.section.id } : {}),
        count,
      })
      if (attempt) {
        setAttemptPrompt({ scope, count, attempt })
      } else {
        startExam(scope, count)
      }
    } catch (reason) {
      setError(reason.message || String(reason))
    }
  }

  function resolveAttempt(resume) {
    if (!attemptPrompt) return
    startExam(
      attemptPrompt.scope,
      attemptPrompt.count,
      resume ? attemptPrompt.attempt.id : undefined
    )
    setAttemptPrompt(null)
  }

  const secondsPerQuestion = Math.ceil(
    (settings.exam_seconds || 1500) / (settings.exam_question_count || 20)
  )

  return (
    <div className="exam-page">
      {error && <div className="error-text">{error}</div>}
      {sections && (
        <div className="exam-sections-wrap">
          <div className="menu-grid exam-sections-list">
            {sections.map((section, index) => (
              <button
                key={section.id}
                type="button"
                className="glass menu-card exam-section-card"
                onClick={() => setCountPrompt({ section })}
              >
                <ExamSectionIcon index={index} section={section} />
                <h3>
                  {t('sectionNumber', { count: section.order || index + 1 })}
                </h3>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="glass menu-card exam-all-card"
            onClick={() => setCountPrompt({ section: null })}
          >
            <h3>{t('all')}</h3>
          </button>
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
            className="glass confirm-modal exam-choice-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="exam-choice-title"
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
              <h2 id="exam-choice-title">{t('realExam')}</h2>
              <p>{countPrompt.section?.name || t('all')}</p>
            </div>
            <div className="exam-count-options">
              {[20, 50].map((option) => {
                const questionTotal = countPrompt.section
                  ? countPrompt.section.questionCount
                  : total
                return (
                  <button
                    key={option}
                    type="button"
                    className="glass exam-count-card"
                    disabled={questionTotal < option}
                    onClick={() => void chooseCount(option)}
                  >
                    <strong>{option === 20 ? t('exam20') : t('exam50')}</strong>
                    <span>
                      {t('minutes', {
                        count: Math.ceil((option * secondsPerQuestion) / 60),
                      })}
                    </span>
                  </button>
                )
              })}
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
            aria-labelledby="exam-attempt-title"
            aria-describedby="exam-attempt-message"
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
              <h2 id="exam-attempt-title">{t('realExam')}</h2>
              <p id="exam-attempt-message">
                {attemptPrompt.attempt.status === 'expired'
                  ? t('expiredExamPrompt')
                  : t('unfinishedExamPrompt')}
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
