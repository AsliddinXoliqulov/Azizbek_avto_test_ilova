import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import { useLanguage, useUi } from '../i18n'
import { useDatabaseRevision } from '../web/useDatabaseRevision'

export default function Lessons({ teacher = false }) {
  const { sectionId } = useParams()
  const navigate = useNavigate()
  const [sectionName, setSectionName] = useState('')
  const [lessons, setLessons] = useState(null)
  const [activeAttempts, setActiveAttempts] = useState(null)
  const [attemptPrompt, setAttemptPrompt] = useState(null)
  const { language } = useLanguage()
  const t = useUi()
  const databaseRevision = useDatabaseRevision()

  useEffect(() => {
    let active = true
    Promise.all([
      window.api.catalog.sections(),
      window.api.catalog.lessons(Number(sectionId)),
      ...(teacher
        ? []
        : [20, 50].map((count) =>
            window.api.tests.activeAttempt({
              mode: 'section-exam',
              sectionId: Number(sectionId),
              count,
            })
          )),
    ]).then(([sections, rows, attempt20, attempt50]) => {
      if (!active) return
      const section = sections.find((item) => String(item.id) === sectionId)
      setSectionName(
        teacher
          ? `${t('teacher')} - ${t('sectionNumber', { count: section?.order || '' })}`
          : section?.name || t('lesson')
      )
      setLessons(rows)
      if (!teacher) setActiveAttempts({ 20: attempt20, 50: attempt50 })
    })

    return () => {
      active = false
    }
  }, [sectionId, language, t, teacher, databaseRevision])

  const sectionQuestionCount =
    lessons?.reduce((total, lesson) => total + lesson.questionCount, 0) || 0

  function startIntermediate(count, resumeAttemptId) {
    navigate('/run', {
      state: {
        mode: 'section-exam',
        sectionId: Number(sectionId),
        sectionTitle: sectionName,
        count,
        ...(resumeAttemptId ? { resumeAttemptId } : {}),
      },
    })
  }

  function chooseIntermediate(count) {
    const attempt = activeAttempts?.[count]
    if (attempt?.status === 'active' || attempt?.status === 'expired') {
      setAttemptPrompt({ count, attempt })
      return
    }
    startIntermediate(count)
  }

  function resolveAttemptPrompt(resume) {
    if (!attemptPrompt) return
    startIntermediate(
      attemptPrompt.count,
      resume ? attemptPrompt.attempt.id : undefined
    )
    setAttemptPrompt(null)
  }

  return (
    <div>
      <div className="page-header section-page-header">
        <div>
          <h1>{sectionName || t('lessons')}</h1>
          <div className="sub">
            {teacher
              ? t('teacherTopicsDesc')
              : lessons == null
                ? t('chooseLesson')
                : t('topicCount', { count: lessons.length })}
          </div>
        </div>
      </div>

      {lessons == null ? null : lessons.length === 0 ? (
        <EmptyState emoji="" title={t('noLessons')} />
      ) : (
        <>
          {!teacher && (
            <div className="menu-grid section-exam-cards">
              {[20, 50].map((count) => {
                const activeAttempt = activeAttempts?.[count]
                return (
                  <div className="section-exam-card-item" key={count}>
                    <button
                      type="button"
                      className="glass menu-card section-exam-card"
                      disabled={
                        activeAttempts === null || sectionQuestionCount < count
                      }
                      onClick={() => chooseIntermediate(count)}
                    >
                      <strong>{t('intermediate')}</strong>
                      <span>{count === 20 ? t('exam20') : t('exam50')}</span>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
          <div className="menu-grid menu-grid-list section-list-cards">
            {lessons.map((lesson) => (
              <button
                key={lesson.id}
                type="button"
                className="glass menu-card"
                onClick={() =>
                  navigate('/run', {
                    state: teacher
                      ? {
                          mode: 'lesson',
                          lessonId: lesson.id,
                          teacherMode: true,
                          untimed: true,
                          showExplanations: true,
                        }
                      : { mode: 'lesson', lessonId: lesson.id },
                  })
                }
                disabled={lesson.questionCount === 0}
              >
                <h3>{lesson.title}</h3>
                <p>{t('questionCount', { count: lesson.questionCount })}</p>
              </button>
            ))}
          </div>
        </>
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
            aria-labelledby="intermediate-prompt-title"
            aria-describedby="intermediate-prompt-message"
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
              <h2 id="intermediate-prompt-title">{t('intermediate')}</h2>
              <p id="intermediate-prompt-message">
                {t('unfinishedIntermediate')}
              </p>
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
