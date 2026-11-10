import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import MenuCard from '../components/MenuCard'
import { useUi } from '../i18n'
import { useDatabaseRevision } from '../web/useDatabaseRevision'

export default function NewQuestions({ teacher = false }) {
  const [total, setTotal] = useState(null)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const t = useUi()
  const databaseRevision = useDatabaseRevision()

  useEffect(() => {
    let active = true
    window.api.catalog.newQuestionCount()
      .then((count) => {
        if (!active) return
        setTotal(count)
        if (teacher && count > 0) {
          navigate('/run', {
            replace: true,
            state: { mode: 'new-questions', count, showExplanations: true, untimed: true },
          })
        }
      })
      .catch((reason) => {
        if (active) setError(reason.message || String(reason))
      })
    return () => {
      active = false
    }
  }, [teacher, navigate, databaseRevision])

  function start(count, showHelp, untimed = false) {
    if (!count) return
    navigate('/run', {
      state: { mode: 'new-questions', count, showHelp, untimed },
    })
  }

  if (error) return <div className="error-text">{error}</div>
  if (total === null) return null
  if (total === 0) {
    return <EmptyState emoji="🆕" title={t('noAdminNewQuestions')} />
  }
  if (teacher) return null

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t('newQuestions')}</h1>
          <div className="sub">{t('practiceChooseMode', { count: total })}</div>
        </div>
      </div>

      <div className="menu-grid menu-grid-list practice-options-grid">
        <MenuCard
          to="/run"
          state={{ mode: 'new-questions', count: 20, showHelp: false }}
          title={t('practiceTimed20')}
        />
        <MenuCard
          to="/run"
          state={{ mode: 'new-questions', count: total, showHelp: true, untimed: true }}
          title={t('practiceAll')}
        />
      </div>
    </div>
  )
}
