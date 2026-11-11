import { useEffect, useState } from 'react'
import EmptyState from '../components/EmptyState'
import { IconBookmark } from '../components/Icons'
import { useLanguage, useUi } from '../i18n'

export default function Saved() {
  const t = useUi()
  const { language } = useLanguage()
  const [questions, setQuestions] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    window.api.saved.list()
      .then((items) => {
        if (active) setQuestions(items)
      })
      .catch((reason) => {
        if (active) setError(reason.message || String(reason))
      })
    return () => {
      active = false
    }
  }, [language])

  async function removeQuestion(questionId) {
    try {
      await window.api.saved.toggle(questionId)
      setQuestions((items) => items.filter((question) => question.id !== questionId))
    } catch (reason) {
      setError(reason.message || String(reason))
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t('savedQuestions')}</h1>
        </div>
      </div>
      {error && <div className="error-text">{error}</div>}
      {questions == null ? null : questions.length === 0 ? (
        <EmptyState emoji="🔖" title={t('savedQuestionsEmpty')} />
      ) : (
        <div className="saved-question-list">
          {questions.map((question) => (
            <article key={question.id} className="glass saved-question-card">
              <div className="question-save-bar">
                <button
                  type="button"
                  className="btn question-save-btn is-saved"
                  onClick={() => void removeQuestion(question.id)}
                >
                  <IconBookmark />
                  {t('removeSavedQuestion')}
                </button>
              </div>
              <div className="question-text">{question.text}</div>
              {question.imageUrl && (
                <img
                  className="saved-question-image"
                  src={question.imageUrl}
                  alt={t('questionImage')}
                  loading="lazy"
                />
              )}
              <ol className="saved-question-options">
                {question.options.map((option, index) => (
                  <li key={index}>{option}</li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
