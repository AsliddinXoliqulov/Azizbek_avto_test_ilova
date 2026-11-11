import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import { useLanguage, useUi } from '../i18n'

export default function DirectStart({ mode }) {
  const navigate = useNavigate()
  const t = useUi()
  const { language } = useLanguage()
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (mode === 'errors') {
      navigate('/run', { replace: true, state: { mode: 'errors' } })
      return
    }
    window.api.tests.history()
      .then(setResults)
      .catch((reason) => setError(reason.message || String(reason)))
  }, [mode, navigate])

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t('errors')}</h1>
          <div className="sub">{t('errorsDesc')}</div>
        </div>
      </div>
      {error && <div className="error-text">{error}</div>}
      {results == null ? null : results.length === 0 ? (
        <EmptyState emoji="📊" title={t('noExamResults')} />
      ) : (
        <div className="exam-results-list">
          {results.map((result) => (
            <article key={result.id} className="glass exam-result-card">
              <header>
                <div>
                  <h2>{result.mode === 'section-exam' ? t('intermediateResult') : t('result', { count: result.resultNumber })}</h2>
                  <p>{result.mode === 'section-exam' ? result.title || t('intermediate') : t('realExam')}</p>
                </div>
                <strong className={`exam-result-outcome ${result.percent >= 90 ? 'result-passed' : 'result-failed'}`}>
                  <span>
                    {result.percent >= 90
                      ? t('examPassedShort')
                      : t('examNotPassedShort')}
                  </span>
                  {result.percent}%
                </strong>
              </header>
              <div className="exam-result-times">
                <span>{t('started')}: {new Date(result.startedAt).toLocaleString(language)}</span>
                <span>{t('ended')}: {new Date(result.finishedAt).toLocaleString(language)}</span>
              </div>
              <div className="exam-result-stats">
                <span>{t('correct')}: <b>{result.correct}</b></span>
                <span>{t('wrong')}: <b>{result.wrong}</b></span>
                <span>{t('skipped')}: <b>{result.skipped}</b></span>
                <span>{t('total', { count: result.total })}</span>
              </div>
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => navigate('/run', {
                  state: { mode: 'review', attemptId: result.id, resultNumber: result.resultNumber },
                })}
              >
                {t('reviewResult')}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
